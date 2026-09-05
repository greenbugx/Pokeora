import type {
  SetDetailsRecord,
  SetQueryRepository,
  SetSearchQuery,
  SetSearchRecord,
} from '../../../domain/set/ports/set-query-repository';
import { InvalidSetQueryError, SetNotFoundError } from './catalog-errors';
import { pageToOffset } from './pagination';
import { translateRepositoryError } from './query-error';

/** Application DTO shown for one exact set. */
export interface SetDetails {
  externalId: string;
  name: string;
  series: string;
  releaseDate: string;
  totalCards: number;
  logoUrl: string;
  symbolUrl: string;
}

/** Application DTO shown for one set in a search listing. */
export interface SetSummary {
  externalId: string;
  name: string;
  series: string;
}

export interface SetSearchResult {
  items: SetSummary[];
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface SearchSetsInput {
  name?: string;
  series?: string;
  page?: number;
}

/** Exact set lookup by external ID. */
export class GetSet {
  private readonly repository: SetQueryRepository;

  constructor(repository: SetQueryRepository) {
    this.repository = repository;
  }

  async execute(externalId: string): Promise<SetDetails> {
    const trimmed = externalId.trim();
    if (trimmed.length === 0) throw new InvalidSetQueryError('A set ID is required');
    let record: SetDetailsRecord | null;
    try {
      record = await this.repository.findByExternalId(trimmed);
    } catch (error) {
      throw translateRepositoryError(error);
    }
    if (!record) throw new SetNotFoundError(trimmed);
    return toDetails(record);
  }
}

/** Bounded, database-side set search with deterministic ordering. */
export class SearchSets {
  private readonly repository: SetQueryRepository;

  constructor(repository: SetQueryRepository) {
    this.repository = repository;
  }

  async execute(input: SearchSetsInput): Promise<SetSearchResult> {
    const hasCriteria = input.name !== undefined || input.series !== undefined;
    if (!hasCriteria) {
      throw new InvalidSetQueryError('Provide at least one of: set name or series');
    }

    const { offset, limit } = pageToOffset(input.page ?? 1);
    const query: SetSearchQuery = {
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.series !== undefined ? { series: input.series.trim() } : {}),
      limit,
      offset,
    };

    let rows: SetSearchRecord[];
    try {
      rows = await this.repository.search({ ...query, limit: limit + 1 });
    } catch (error) {
      throw translateRepositoryError(error);
    }
    const hasMore = rows.length > limit;
    return {
      items: rows.slice(0, limit).map(toSummary),
      page: input.page ?? 1,
      pageSize: limit,
      hasMore,
    };
  }
}

function toDetails(record: SetDetailsRecord): SetDetails {
  return {
    externalId: record.externalId,
    name: record.name,
    series: record.series,
    // ISO calendar-date string; no time or timezone applies to a release date.
    releaseDate: record.releaseDate.toString(),
    totalCards: record.totalCards,
    logoUrl: record.logoUrl,
    symbolUrl: record.symbolUrl,
  };
}

function toSummary(record: SetSearchRecord): SetSummary {
  return { externalId: record.externalId, name: record.name, series: record.series };
}
