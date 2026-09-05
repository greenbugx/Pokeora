import type { CollectionEntryRecord, OwnershipRecord } from '../entities/ownership';

export type { CollectionEntryRecord };

export interface CollectionPageQuery {
  userId: string;
  limit: number;
  offset: number;
}

export interface AcquireOwnershipInput {
  userId: string;
  variantId: string;
  condition: string;
  quantity: number;
}

export type AcquireOwnershipOutcome =
  | { outcome: 'acquired'; record: CollectionEntryRecord }
  | { outcome: 'user-not-found' }
  | { outcome: 'variant-not-found' }
  | { outcome: 'not-collectible' };

export type ReleaseOwnershipOutcome = 'partial' | 'removed' | 'not-found' | 'insufficient';

/**
 * Authoritative persistence for CardOwnership.
 *
 * Reads: `findByIdForUser` retrieves one specific record (ownership-id
 * authorized by user); `findByUserAndVariant` returns ALL condition
 * specific records for a variant — the identity is (userId, variantId,
 * condition), so multiple rows per variant are valid and must never be
 * collapsed into one.
 *
 * Mutations: `acquire` is an atomic create-or-increment (single INSERT … ON
 * CONFLICT statement); `release` is an atomic conditional decrement that
 * deletes the record when it reaches zero (the schema's quantity > 0 CHECK
 * forbids zero-quantity rows). Both are transaction-compatible primitives:
 * they run on the ambient transaction when called inside
 * `unitOfWork.transactional(...)` and never open transactions themselves, so
 * future pack/trade/marketplace workflows can own the boundary.
 */
export interface OwnershipRepository {
  findByIdForUser(userId: string, ownershipId: string): Promise<CollectionEntryRecord | null>;
  findByUserAndVariant(userId: string, variantId: string): Promise<CollectionEntryRecord[]>;
  findCollectionPage(query: CollectionPageQuery): Promise<CollectionEntryRecord[]>;
  acquire(input: AcquireOwnershipInput): Promise<AcquireOwnershipOutcome>;
  release(input: { userId: string; ownershipId: string; quantity: number }): Promise<ReleaseOwnershipOutcome>;
}
