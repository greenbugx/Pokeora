import type { Temporal } from '@js-temporal/polyfill';

/**
 * One player's owned quantity of a collectible variant, at a specific
 * condition. The ownership identity in the locked schema is
 * (userId, variantId, condition) — database-enforced unique — so a user may
 * hold several records for the same variant across conditions, and each
 * record's `id` is the stable handle future systems (binder, marketplace,
 * trading) reference.
 */
export interface OwnershipRecord {
  id: string;
  userId: string;
  variantId: string;
  quantity: number;
  condition: string;
  firstAcquiredAt: Temporal.Instant;
  lastAcquiredAt: Temporal.Instant;
}

/** Ownership record enriched with the catalog metadata needed to render it. */
export interface CollectionEntryRecord extends OwnershipRecord {
  variantType: string;
  finish: string;
  language: string;
  cardExternalId: string;
  cardName: string;
  cardNumber: string;
  rarity: string;
  imageSmall: string;
  setExternalId: string;
  setName: string;
  setSeries: string;
}
