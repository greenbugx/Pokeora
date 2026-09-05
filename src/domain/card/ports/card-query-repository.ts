import type { CardVariantSummary } from '../../../domain/card/entities/card-variant';

/** Repository result for one catalog card, with its set and variants. */
export interface CardDetailsRecord {
  externalId: string;
  name: string;
  number: string;
  rarity: string;
  setExternalId: string;
  setName: string;
  setSeries: string;
  imageSmall: string;
  imageLarge: string;
  variants: CardVariantSummary[];
}

/** Repository result for one card in a search listing. */
export interface CardSearchRecord {
  externalId: string;
  name: string;
  number: string;
  rarity: string;
  setExternalId: string;
  setName: string;
  imageSmall: string;
}

export interface CardSearchQuery {
  /** Case-insensitive partial match on card name. */
  name?: string;
  /** Exact set external ID filter. */
  setExternalId?: string;
  /** Exact card number filter (card numbers are strings, e.g. "TG01"). */
  number?: string;
  /** Exact rarity filter against the stored source value. */
  rarity?: string;
  limit: number;
  offset: number;
}

/**
 * Read-only catalog access for cards. Search results never load variants;
 * detail lookups load set + variants in one query. Search ordering is
 * deterministic (name, number, externalId) so pagination is stable.
 */
export interface CardQueryRepository {
  findByExternalId(externalId: string): Promise<CardDetailsRecord | null>;
  search(query: CardSearchQuery): Promise<CardSearchRecord[]>;
}
