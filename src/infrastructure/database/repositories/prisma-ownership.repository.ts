import type { Temporal } from '@js-temporal/polyfill';
import { randomUUID } from 'node:crypto';
import { db, currentExecutor, executeRawPlan, isForeignKeyViolation } from '../prisma/client';
import type {
  AcquireOwnershipInput,
  AcquireOwnershipOutcome,
  CollectionEntryRecord,
  CollectionPageQuery,
  OwnershipRepository,
  ReleaseOwnershipOutcome,
} from '../../../domain/collection/ports/ownership-repository';

/*
 * Raw-lane mutation statements. These are deliberate, documented uses of raw
 * SQL: quantity arithmetic (`quantity = quantity + n`) and conditional
 * guards (`quantity >= n`) cannot be expressed as plain ORM update payloads,
 * and expressing them in SQL is what makes the mutations atomic under
 * concurrency. All values are bound parameters — nothing is
 * interpolated into the statement text.
 */

function acquirePlan(input: AcquireOwnershipInput): unknown {
  return db.raw.sql`
    INSERT INTO "cardOwnership" ("id", "userId", "variantId", "condition", "quantity", "firstAcquiredAt", "lastAcquiredAt")
    VALUES (${randomUUID()}, ${input.userId}, ${input.variantId}, ${input.condition}, ${input.quantity}, now(), now())
    ON CONFLICT ("userId", "variantId", "condition")
    DO UPDATE SET "quantity" = "cardOwnership"."quantity" + ${input.quantity}, "lastAcquiredAt" = now()
  `.affectedCount().build();
}

function releaseDecrementPlan(ownershipId: string, userId: string, quantity: number): unknown {
  return db.raw.sql`
    UPDATE "cardOwnership" SET "quantity" = "quantity" - ${quantity}
    WHERE "id" = ${ownershipId} AND "userId" = ${userId} AND "quantity" > ${quantity}
  `.affectedCount().build();
}

function releaseDeletePlan(ownershipId: string, userId: string, quantity: number): unknown {
  return db.raw.sql`
    DELETE FROM "cardOwnership"
    WHERE "id" = ${ownershipId} AND "userId" = ${userId} AND "quantity" = ${quantity}
  `.affectedCount().build();
}

const OWNERSHIP_COLUMNS = [
  'id', 'userId', 'variantId', 'quantity', 'condition', 'firstAcquiredAt', 'lastAcquiredAt',
] as const;

interface OwnershipRow {
  id: string;
  userId: string;
  variantId: string;
  quantity: number;
  condition: string;
  firstAcquiredAt: Temporal.Instant;
  lastAcquiredAt: Temporal.Instant;
  variant?: {
    variantType: string;
    finish: string;
    language: string;
    card?: {
      externalId: string;
      name: string;
      number: string;
      rarity: string;
      imageSmall: string;
      set?: { externalId: string; name: string; series: string };
    };
  };
}

function toEntryRecord(row: OwnershipRow): CollectionEntryRecord {
  const variant = row.variant;
  if (!variant?.card?.set) {
    // Ownership referencing unresolvable catalog data: surface a controlled
    // error, never fabricate metadata.
    throw new Error(`ownership ${row.id} references unresolvable catalog data`);
  }
  return {
    id: row.id,
    userId: row.userId,
    variantId: row.variantId,
    quantity: row.quantity,
    condition: row.condition,
    firstAcquiredAt: row.firstAcquiredAt,
    lastAcquiredAt: row.lastAcquiredAt,
    variantType: variant.variantType,
    finish: variant.finish,
    language: variant.language,
    cardExternalId: variant.card.externalId,
    cardName: variant.card.name,
    cardNumber: variant.card.number,
    rarity: variant.card.rarity,
    imageSmall: variant.card.imageSmall,
    setExternalId: variant.card.set.externalId,
    setName: variant.card.set.name,
    setSeries: variant.card.set.series,
  };
}


export class PrismaOwnershipRepository implements OwnershipRepository {
  async findByIdForUser(userId: string, ownershipId: string): Promise<CollectionEntryRecord | null> {
    const row = await currentExecutor()
      .orm.public.CardOwnership.where((ownership) => ownership.id.eq(ownershipId))
      .where((ownership) => ownership.userId.eq(userId))
      .select(...OWNERSHIP_COLUMNS)
      .include('variant', (variant) =>
        variant
          .select('variantType', 'finish', 'language')
          .include('card', (card) =>
            card
              .select('externalId', 'name', 'number', 'rarity', 'imageSmall')
              .include('set', (set) => set.select('externalId', 'name', 'series'))))
      .first();
    return row ? toEntryRecord(row as OwnershipRow) : null;
  }

  async findByUserAndVariant(userId: string, variantId: string): Promise<CollectionEntryRecord[]> {
    const rows = await currentExecutor()
      .orm.public.CardOwnership.where((ownership) => ownership.userId.eq(userId))
      .where((ownership) => ownership.variantId.eq(variantId))
      .select(...OWNERSHIP_COLUMNS)
      .include('variant', (variant) =>
        variant
          .select('variantType', 'finish', 'language')
          .include('card', (card) =>
            card
              .select('externalId', 'name', 'number', 'rarity', 'imageSmall')
              .include('set', (set) => set.select('externalId', 'name', 'series'))))
      .orderBy((ownership) => ownership.condition.asc())
      .all();
    return rows.map((row) => toEntryRecord(row as OwnershipRow));
  }

  /**
   * One bounded page of a user's collection: ownership joined to
   * variant -> card -> set via nested includes in a single query (no N+1).
   * Ordering is `firstAcquiredAt ASC, id ASC` — firstAcquiredAt is
   * immutable by design, which keeps the ordering stable across pages.
   */
  async findCollectionPage(query: CollectionPageQuery): Promise<CollectionEntryRecord[]> {
    const rows = await currentExecutor()
      .orm.public.CardOwnership.where((ownership) => ownership.userId.eq(query.userId))
      .select(...OWNERSHIP_COLUMNS)
      .include('variant', (variant) =>
        variant
          .select('variantType', 'finish', 'language')
          .include('card', (card) =>
            card
              .select('externalId', 'name', 'number', 'rarity', 'imageSmall')
              .include('set', (set) => set.select('externalId', 'name', 'series'))))
      .orderBy([
        (ownership) => ownership.firstAcquiredAt.asc(),
        (ownership) => ownership.id.asc(),
      ])
      .limit(query.limit)
      .offset(query.offset)
      .all();
    return rows.map((row) => toEntryRecord(row as OwnershipRow));
  }

  /**
   * Atomic create-or-increment. The unique constraint on
   * (userId, variantId, condition) is the conflict target, so the increment
   * can never lose an update and duplicate logical records cannot be created
   * No transaction is opened here — the statement joins the
   * caller's ambient transaction.
   */
  async acquire(input: AcquireOwnershipInput): Promise<AcquireOwnershipOutcome> {
    const executor = currentExecutor();

    // Resolve the catalog target from PostgreSQL — never from caller
    // metadata. Missing or non-collectible variants are rejected,
    // never created.
    const variant = await executor.orm.public.CardVariant
      .where((candidate) => candidate.id.eq(input.variantId))
      .select('id', 'isCollectible')
      .first();
    if (!variant) return { outcome: 'variant-not-found' };
    if (!variant.isCollectible) return { outcome: 'not-collectible' };

    try {
      await executeRawPlan(executor, acquirePlan(input));
    } catch (error) {
      // The user FK is the database's user-existence check.
      if (isForeignKeyViolation(error, 'userId_fkey')) return { outcome: 'user-not-found' };
      throw error;
    }

    const row = await currentExecutor()
      .orm.public.CardOwnership.where((ownership) => ownership.userId.eq(input.userId))
      .where((ownership) => ownership.variantId.eq(input.variantId))
      .where((ownership) => ownership.condition.eq(input.condition))
      .select(...OWNERSHIP_COLUMNS)
      .include('variant', (variant) =>
        variant
          .select('variantType', 'finish', 'language')
          .include('card', (card) =>
            card
              .select('externalId', 'name', 'number', 'rarity', 'imageSmall')
              .include('set', (set) => set.select('externalId', 'name', 'series'))))
      .first();
    if (!row) throw new Error('ownership row missing after acquire');
    return { outcome: 'acquired', record: toEntryRecord(row as OwnershipRow) };
  }

  /**
   * Atomic conditional release. Two branches keep every outcome
   * inside the schema's quantity > 0 CHECK: a partial decrement only fires
   * when strictly more than the requested quantity remains; the
   * exact-quantity branch deletes the record (zero-quantity rows are not
   * valid ownership). A double miss means the record is absent or the
   * quantity is insufficient — disambiguated with one id lookup.
   */
  async release(input: {
    userId: string;
    ownershipId: string;
    quantity: number;
  }): Promise<ReleaseOwnershipOutcome> {
    const executor = currentExecutor();

    const partial = await executeRawPlan<{ affectedRows: number }>(
      executor,
      releaseDecrementPlan(input.ownershipId, input.userId, input.quantity),
    );
    if (partial.affectedRows > 0) return 'partial';

    const removed = await executeRawPlan<{ affectedRows: number }>(
      executor,
      releaseDeletePlan(input.ownershipId, input.userId, input.quantity),
    );
    if (removed.affectedRows > 0) return 'removed';

    const exists = await currentExecutor().orm.public.CardOwnership
      .where((ownership) => ownership.id.eq(input.ownershipId))
      .where((ownership) => ownership.userId.eq(input.userId))
      .select('id')
      .first();
    return exists ? 'insufficient' : 'not-found';
  }
}
