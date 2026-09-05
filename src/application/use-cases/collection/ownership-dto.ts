import type { CollectionEntryRecord, OwnershipRecord } from '../../../domain/collection/entities/ownership';

/** One rendered row of a player's collection. */
export interface CollectionEntry {
  ownershipId: string;
  variantId: string;
  cardExternalId: string;
  cardName: string;
  cardNumber: string;
  rarity: string;
  setExternalId: string;
  setName: string;
  variantType: string;
  finish: string;
  language: string;
  quantity: number;
  condition: string;
  imageSmall: string;
}

export interface CollectionResult {
  items: CollectionEntry[];
  page: number;
  pageSize: number;
  hasMore: boolean;
}

/** Full ownership record for internal/trusted consumers. */
export interface OwnershipDetails extends CollectionEntry {
  firstAcquiredAt: string;
  lastAcquiredAt: string;
}

export function toCollectionEntry(record: CollectionEntryRecord): CollectionEntry {
  return {
    ownershipId: record.id,
    variantId: record.variantId,
    cardExternalId: record.cardExternalId,
    cardName: record.cardName,
    cardNumber: record.cardNumber,
    rarity: record.rarity,
    setExternalId: record.setExternalId,
    setName: record.setName,
    variantType: record.variantType,
    finish: record.finish,
    language: record.language,
    quantity: record.quantity,
    condition: record.condition,
    imageSmall: record.imageSmall,
  };
}

export function toOwnershipDetails(record: OwnershipRecord & CollectionEntryRecord): OwnershipDetails {
  return {
    ...toCollectionEntry(record),
    firstAcquiredAt: record.firstAcquiredAt.toString(),
    lastAcquiredAt: record.lastAcquiredAt.toString(),
  };
}
