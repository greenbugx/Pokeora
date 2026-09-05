import type { Temporal } from '@js-temporal/polyfill';

/** Repository result for one catalog set. */
export interface SetDetailsRecord {
  externalId: string;
  name: string;
  series: string;
  releaseDate: Temporal.PlainDate;
  totalCards: number;
  logoUrl: string;
  symbolUrl: string;
}

/** Repository result for one set in a search listing. */
export interface SetSearchRecord {
  externalId: string;
  name: string;
  series: string;
}

export interface SetSearchQuery {
  /** Case-insensitive partial match on set name. */
  name?: string;
  /** Exact series filter against the stored source value. */
  series?: string;
  limit: number;
  offset: number;
}

/**
 * Read-only catalog access for sets. Search never dumps the whole catalog:
 * a query must carry a name or series filter. Ordering is deterministic
 * (name, externalId) for stable pagination.
 */
export interface SetQueryRepository {
  findByExternalId(externalId: string): Promise<SetDetailsRecord | null>;
  search(query: SetSearchQuery): Promise<SetSearchRecord[]>;
}
