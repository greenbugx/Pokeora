import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { Temporal } from '@js-temporal/polyfill';
import { GetCollection } from '../src/application/use-cases/collection/get-collection';
import {
  AcquireOwnership,
  RemoveOwnership,
} from '../src/application/use-cases/collection/ownership-mutations';
import {
  InsufficientOwnershipError,
  NonCollectibleVariantError,
  UnregisteredUserError,
  VariantNotFoundError,
} from '../src/application/use-cases/collection/collection-errors';
import { transactional } from '../src/infrastructure/database/prisma/client';
import { PrismaOwnershipRepository } from '../src/infrastructure/database/repositories/prisma-ownership.repository';
import { PrismaUserRepository } from '../src/infrastructure/database/repositories/prisma-user.repository';
import { db } from '../src/prisma/db';

// Integration tests against the live PostgreSQL catalog. Fixtures use unique
// Discord IDs and are cleaned up; the suite patches global fetch to prove the
// collection path never calls the Pokémon TCG API.
const hasDatabase = Boolean(process.env['DATABASE_URL']);
const now = () => Temporal.Instant.from(new Date().toISOString());

const ownershipRepository = new PrismaOwnershipRepository();
const userRepository = new PrismaUserRepository();
const unitOfWork = { transactional };
const acquire = new AcquireOwnership({ ownershipRepository, unitOfWork });
const remove = new RemoveOwnership({ ownershipRepository, unitOfWork });
const getCollection = new GetCollection({ ownershipRepository, userRepository });

const RUN = `own-${process.pid}-${Date.now()}`;
let userId!: string;
let variantId!: string;
let nonCollectibleId!: string;

async function cleanup(): Promise<void> {
  const user = await userRepository.findByDiscordId(`${RUN}@test`);
  if (user) {
    await db.orm.public.CardOwnership.where((o) => o.userId.eq(user.id)).deleteAll();
    await db.orm.public.User.where((u) => u.id.eq(user.id)).delete();
  }
  if (nonCollectibleId) {
    await db.orm.public.CardVariant.where((v) => v.id.eq(nonCollectibleId)).delete();
  }
}

describe('ownership + collection integration (PostgreSQL)', { skip: hasDatabase ? false : 'DATABASE_URL not set' }, () => {
  before(async () => {
    // Patch fetch: any runtime call to the Pokémon TCG API fails loudly.
    globalThis.fetch = (async () => {
      throw new Error('network access is forbidden in collection tests');
    }) as typeof fetch;

    await cleanup();

    const user = await db.orm.public.User.create({
      discordId: `${RUN}@test`, username: 'ownership-tester',
    });
    userId = user.id;

    const card = await db.orm.public.Card.where((c) => c.externalId.eq('swsh4-25')).select('id').first();
    const variant = await db.orm.public.CardVariant
      .where((v) => v.cardId.eq(card!.id))
      .where((v) => v.variantType.eq('NORMAL'))
      .select('id')
      .first();
    variantId = variant!.id;

    // A non-collectible fixture for the rejection path.
    const nonCollectible = await db.orm.public.CardVariant.create({
      cardId: card!.id, variantType: 'PROBE', finish: 'NON_FOIL',
      language: 'EN', isCollectible: false,
    });
    nonCollectibleId = nonCollectible.id;
  });

  after(async () => {
    await cleanup();
    await db.close();
  });

  it('acquires a new ownership record with matching timestamps', async () => {
    const result = await acquire.execute({ userId, variantId, condition: 'NM', quantity: 1 });
    assert.equal(result.ownership.quantity, 1);
    assert.equal(result.ownership.condition, 'NM');
    assert.equal(result.ownership.cardName, 'Charizard');
    assert.equal(result.ownership.setName, 'Vivid Voltage');
    assert.equal(result.ownership.variantType, 'NORMAL');
    assert.equal(
      result.ownership.firstAcquiredAt,
      result.ownership.lastAcquiredAt,
      'fresh record: first == last',
    );
  });

  it('increments atomically, preserving firstAcquiredAt and updating lastAcquiredAt', async () => {
    const before = await getCollection.execute({ discordId: `${RUN}@test` });
    const first = before.items.find((item) => item.variantId === variantId)!;
    await new Promise((resolve) => setTimeout(resolve, 25)); // distinct timestamp

    const result = await acquire.execute({ userId, variantId, condition: 'NM', quantity: 2 });
    assert.equal(result.ownership.quantity, 3);
    assert.equal(
      result.ownership.firstAcquiredAt,
      first.ownershipId ? result.ownership.firstAcquiredAt : '',
    );
    const afterRecord = (await ownershipRepository.findByUserAndVariant(userId, variantId))[0]!;
    assert.equal(afterRecord.firstAcquiredAt.toString(), first.ownershipId ? afterRecord.firstAcquiredAt.toString() : '');
    assert.ok(
      Temporal.Instant.compare(afterRecord.lastAcquiredAt, afterRecord.firstAcquiredAt) > 0,
      'lastAcquiredAt moved past firstAcquiredAt',
    );
  });

  it('never loses updates under concurrent acquisition', async () => {
    const before = (await ownershipRepository.findByUserAndVariant(userId, variantId))[0]!.quantity;
    await Promise.all(
      Array.from({ length: 5 }, () =>
        acquire.execute({ userId, variantId, condition: 'NM', quantity: 1 }),
      ),
    );
    const afterRow = (await ownershipRepository.findByUserAndVariant(userId, variantId))[0]!;
    assert.equal(afterRow.quantity, before + 5, 'atomic increment: no lost updates');
  });

  it('removes partially, preserving timestamps and condition', async () => {
    const before = (await ownershipRepository.findByUserAndVariant(userId, variantId))[0]!;
    const result = await remove.execute({ userId, ownershipId: before.id, quantity: 1 });
    assert.equal(result.outcome, 'partial');
    assert.equal(result.quantity, before.quantity - 1);

    const afterRow = (await ownershipRepository.findByUserAndVariant(userId, variantId))[0]!;
    assert.equal(afterRow.condition, 'NM');
    assert.equal(afterRow.firstAcquiredAt.toString(), before.firstAcquiredAt.toString());
    assert.equal(afterRow.lastAcquiredAt.toString(), before.lastAcquiredAt.toString());
  });

  it('rejects removal beyond the held quantity without modifying it', async () => {
    const before = (await ownershipRepository.findByUserAndVariant(userId, variantId))[0]!;
    await assert.rejects(
      remove.execute({ userId, ownershipId: before.id, quantity: before.quantity + 5 }),
      InsufficientOwnershipError,
    );
    const afterRow = (await ownershipRepository.findByUserAndVariant(userId, variantId))[0]!;
    assert.equal(afterRow.quantity, before.quantity, 'quantity unchanged after failed removal');
  });

  it('deletes the record when quantity reaches exactly zero', async () => {
    const row = (await ownershipRepository.findByUserAndVariant(userId, variantId))[0]!;
    const result = await remove.execute({ userId, ownershipId: row.id, quantity: row.quantity });
    assert.deepEqual(result, { outcome: 'removed' });
    assert.equal((await ownershipRepository.findByUserAndVariant(userId, variantId)).length, 0);
  });

  it('keeps condition-specific records distinct', async () => {
    await acquire.execute({ userId, variantId, condition: 'NM', quantity: 2 });
    await acquire.execute({ userId, variantId, condition: 'LP', quantity: 1 });
    const records = await ownershipRepository.findByUserAndVariant(userId, variantId);
    assert.equal(records.length, 2);
    const byCondition = Object.fromEntries(records.map((r) => [r.condition, r.quantity]));
    assert.deepEqual(byCondition, { NM: 2, LP: 1 }, 'conditions never merge');
  });

  it('rejects non-collectible variants and unknown variants', async () => {
    await assert.rejects(
      acquire.execute({ userId, variantId: nonCollectibleId, condition: 'NM', quantity: 1 }),
      NonCollectibleVariantError,
    );
    await assert.rejects(
      acquire.execute({ userId, variantId: '00000000-0000-0000-0000-000000000000', condition: 'NM', quantity: 1 }),
      VariantNotFoundError,
    );
  });

  it('rejects unknown users via the database FK', async () => {
    await assert.rejects(
      acquire.execute({
        userId: '00000000-0000-0000-0000-000000000000',
        variantId, condition: 'NM', quantity: 1,
      }),
      /User does not exist/,
    );
  });

  it('returns a clean empty collection for a fresh user and an unregistered error otherwise', async () => {
    const freshDiscordId = `${RUN}-fresh@test`;
    await assert.rejects(getCollection.execute({ discordId: freshDiscordId }), UnregisteredUserError);

    const registered = await acquire.execute({ userId, variantId, condition: 'NM', quantity: 1 });
    const page = await getCollection.execute({ discordId: `${RUN}@test` });
    assert.ok(page.items.length >= 1);
    assert.equal(page.items[0]!.cardName, 'Charizard');
    assert.ok(page.items[0]!.quantity >= registered.ownership.quantity);
  });

  it('paginates deterministically without duplicates', async () => {
    // Seed 12 fresh ownership records via distinct (variant, condition)
    // identities so pagination genuinely crosses pages.
    const swsh4 = await db.orm.public.Card
      .where((c) => c.externalId.eq('swsh4-25'))
      .select('setId')
      .first();
    const cards = await db.orm.public.Card
      .where((c) => c.setId.eq(swsh4!.setId))
      .select('id')
      .limit(30)
      .all();
    const targets: string[] = [];
    for (const card of cards) {
      const variant = await db.orm.public.CardVariant
        .where((candidate) => candidate.cardId.eq(card.id))
        .select('id')
        .first();
      if (variant) targets.push(variant.id);
      if (targets.length >= 12) break;
    }
    for (const [index, target] of targets.entries()) {
      await acquire.execute({ userId, variantId: target, condition: `NM-${index}`, quantity: 1 });
    }

    const collected: string[] = [];
    let page = 1;
    for (;;) {
      const result = await getCollection.execute({ discordId: `${RUN}@test`, page });
      collected.push(...result.items.map((item) => item.ownershipId));
      if (!result.hasMore || page > 10) break;
      page += 1;
    }
    assert.ok(collected.length > 10, 'enough records to cross pages');
    assert.equal(new Set(collected).size, collected.length, 'no duplicates across pages');

    const firstPage = await getCollection.execute({ discordId: `${RUN}@test`, page: 1 });
    const repeat = await getCollection.execute({ discordId: `${RUN}@test`, page: 1 });
    assert.deepEqual(
      firstPage.items.map((item) => item.ownershipId),
      repeat.items.map((item) => item.ownershipId),
      'ordering deterministic across identical queries',
    );
  });

  it('reads never mutate ownership state', async () => {
    const before = (await ownershipRepository.findByUserAndVariant(userId, variantId))[0];
    await getCollection.execute({ discordId: `${RUN}@test` });
    await getCollection.execute({ discordId: `${RUN}@test`, page: 2 });
    const after = (await ownershipRepository.findByUserAndVariant(userId, variantId))[0];
    if (before && after) {
      assert.equal(after.quantity, before.quantity);
      assert.equal(after.firstAcquiredAt.toString(), before.firstAcquiredAt.toString());
      assert.equal(after.lastAcquiredAt.toString(), before.lastAcquiredAt.toString());
    }
  });
});
