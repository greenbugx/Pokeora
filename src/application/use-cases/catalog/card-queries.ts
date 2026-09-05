import type {
  CardDetailsRecord,
  CardQueryRepository,
  CardSearchQuery,
  CardSearchRecord,
} from '../../../domain/card/ports/card-query-repository';
import type { CardVariantSummary } from '../../../domain/card/entities/card-variant';
import { CardNotFoundError, InvalidCardQueryError } from './catalog-errors';
import { pageToOffset } from './pagination';
import { translateRepositoryError } from './query-error';
import type { Logger } from '../../../infrastructure/logging/logger';

/** Application DTO shown for one exact card. */
export interface CardDetails {
  externalId: string;
  name: string;
  number: string;
  rarity: string;
  set: { externalId: string; name: string; series: string };
  imageSmall: string;
  imageLarge: string;
  variants: CardVariantSummary[];
}

/** Application DTO shown for one card in a search listing. */
export interface CardSummary {
  externalId: string;
  name: string;
  number: string;
  rarity: string;
  setExternalId: string;
  setName: string;
  imageSmall: string;
}

export interface CardSearchResult {
  items: CardSummary[];
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface SearchCardsInput {
  name?: string;
  setExternalId?: string;
  number?: string;
  rarity?: string;
  page?: number;
}

/** Exact card lookup by external ID. */
export class GetCard {
  private readonly repository: CardQueryRepository;

  constructor(repository: CardQueryRepository) {
    this.repository = repository;
  }

  async execute(externalId: string): Promise<CardDetails> {
    const trimmed = externalId.trim();
    if (trimmed.length === 0) throw new InvalidCardQueryError('A card ID is required');
    let record: CardDetailsRecord | null;
    try {
      record = await this.repository.findByExternalId(trimmed);
    } catch (error) {
      throw translateRepositoryError(error);
    }
    if (!record) throw new CardNotFoundError(trimmed);
    return toDetails(record);
  }
}

/** Bounded, database-side card search with deterministic ordering. */
export class SearchCards {
  private readonly repository: CardQueryRepository;

  constructor(repository: CardQueryRepository) {
    this.repository = repository;
  }

  async execute(input: SearchCardsInput): Promise<CardSearchResult> {
    const hasCriteria = [input.name, input.setExternalId, input.number, input.rarity].some(
      (value) => value !== undefined,
    );
    if (!hasCriteria) {
      throw new InvalidCardQueryError('Provide at least one of: card name, set, number, or rarity');
    }

    const { offset, limit } = pageToOffset(input.page ?? 1);
    const query: CardSearchQuery = {
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.setExternalId !== undefined ? { setExternalId: input.setExternalId.trim() } : {}),
      ...(input.number !== undefined ? { number: input.number.trim() } : {}),
      ...(input.rarity !== undefined ? { rarity: input.rarity.trim() } : {}),
      limit,
      offset,
    };

    let rows: CardSearchRecord[];
    try {
      // Fetch one extra row to compute hasMore without a count query.
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

function toDetails(record: CardDetailsRecord): CardDetails {
  return {
    externalId: record.externalId,
    name: record.name,
    number: record.number,
    rarity: record.rarity,
    set: { externalId: record.setExternalId, name: record.setName, series: record.setSeries },
    imageSmall: record.imageSmall,
    imageLarge: record.imageLarge,
    variants: record.variants,
  };
}

function toSummary(record: CardSearchRecord): CardSummary {
  return {
    externalId: record.externalId,
    name: record.name,
    number: record.number,
    rarity: record.rarity,
    setExternalId: record.setExternalId,
    setName: record.setName,
    imageSmall: record.imageSmall,
  };
}
