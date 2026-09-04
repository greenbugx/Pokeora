/**
 * A page of source records. The sync use cases consume exactly one page at a
 * time so memory stays bounded regardless of catalog size.
 */
import { Temporal } from '@js-temporal/polyfill';

export interface SourcePage<T> {
  page: number;
  pageSize: number;
  totalCount: number;
  items: T[];
}

/**
 * The external catalog as the sync use cases see it: an async page stream.
 * Infrastructure adapters own HTTP, pagination metadata, and retries.
 */
export interface CatalogSource {
  sets(): AsyncGenerator<SourcePage<SourceSet>>;
  cards(): AsyncGenerator<SourcePage<SourceCard>>;
}

export interface SourceSet {
  externalId: string;
  name: string;
  series: string;
  releaseDate: Temporal.PlainDate;
  totalCards: number;
  logoUrl: string;
  symbolUrl: string;
}

export interface SourceCard {
  externalId: string;
  setExternalId: string;
  name: string;
  number: string;
  rarity: string;
  imageSmall: string;
  imageLarge: string;
  /** TCGPlayer pricing keys present for this card, used as variant evidence. */
  variantEvidenceKeys: string[];
}
