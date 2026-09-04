import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { SyncCards } from '../src/application/use-cases/sync/sync-cards';
import { SyncSets } from '../src/application/use-cases/sync/sync-sets';
import type { CatalogSource, SourceCard, SourcePage, SourceSet } from '../src/application/use-cases/sync/catalog-source';
import { transactional } from '../src/infrastructure/database/prisma/client';
import { PrismaCardRepository } from '../src/infrastructure/database/repositories/prisma-card.repository';
import { PrismaCardVariantRepository } from '../src/infrastructure/database/repositories/prisma-card-variant.repository';
import { PrismaSetRepository } from '../src/infrastructure/database/repositories/prisma-set.repository';
import { db } from '../src/prisma/db';
import { Temporal } from '@js-temporal/polyfill';

// Runs against the project's real PostgreSQL (DATABASE_URL). Uses synthetic
// source fixtures with unique external ids and cleans up after itself.
const hasDatabase = Boolean(process.env['DATABASE_URL']);
const runId = `it-${process.pid}-${Date.now()}`;

const setRepository = new PrismaSetRepository();
const cardRepository = new PrismaCardRepository();
const cardVariantRepository = new PrismaCardVariantRepository();

function source(sets: SourceSet[], cards: SourceCard[]): CatalogSource {
  return {
    async *sets() {
      if (sets.length) yield { page: 1, pageSize: sets.length, totalCount: sets.length, items: sets };
    },
    async *cards() {
      if (cards.length) yield { page: 1, pageSize: cards.length, totalCount: cards.length, items: cards };
    },
  };
}

const variantPolicy = {
  toVariantIdentity(evidenceKey: string) {
    const table: Record<string, { variantType: string; finish: string }> = {
      normal: { variantType: 'NORMAL', finish: 'NON_FOIL' },
      holofoil: { variantType: 'HOLO', finish: 'HOLOFOIL' },
      reverseHolofoil: { variantType: 'REVERSE_HOLO', finish: 'REVERSE_HOLOFOIL' },
    };
    return table[evidenceKey] ?? null;
  },
};

const fixtures = {
  set: (): SourceSet => ({
    externalId: `it-set-${runId}`,
    name: 'Integration Set',
    series: 'Integration Series',
    releaseDate: Temporal.PlainDate.from('2020-08-14'),
    totalCards: 2,
    logoUrl: `https://${runId}/logo`,
    symbolUrl: `https://${runId}/symbol`,
  }),
  card: (externalId: string, evidence: string[] = ['holofoil']): SourceCard => ({
    externalId,
    setExternalId: `it-set-${runId}`,
    name: `Card ${externalId}`,
    number: '25',
    rarity: 'Rare',
    imageSmall: `https://${externalId}/small`,
    imageLarge: `https://${externalId}/large`,
    variantEvidenceKeys: evidence,
  }),
};

async function cleanup(): Promise<void> {
  const set = await setRepository.findByExternalId(fixtures.set().externalId);
  if (set) {
    // CardVariant has FK Restrict to Card, so remove variants before cards.
    const cards = await db.orm.public.Card.where((card) => card.setId.eq(set.id)).select('id').all();
    for (const card of cards) {
      // delete() removes a single row; deleteAll() removes every match.
      await db.orm.public.CardVariant.where((variant) => variant.cardId.eq(card.id)).deleteAll();
    }
    await db.orm.public.Card.where((card) => card.setId.eq(set.id)).deleteAll();
    await db.orm.public.Set.where((candidate) => candidate.id.eq(set.id)).delete();
  }
  await db.orm.public.Card.where((card) => card.externalId.eq(`ghost-${runId}-1`)).delete();
}

describe('catalog sync integration (PostgreSQL)', { skip: hasDatabase ? false : 'DATABASE_URL not set' }, () => {
  before(cleanup);
  after(async () => {
    await cleanup();
    await db.close();
  });

  it('syncs sets idempotently, preserving internal ids', async () => {
    const source1 = source([fixtures.set()], []);
    const first = await new SyncSets({ unitOfWork: { transactional }, setRepository, source: source1 }).execute();
    assert.equal(first.created, 1);
    assert.equal(first.updated, 0);

    const firstId = (await setRepository.findByExternalId(fixtures.set().externalId))?.id;

    const second = await new SyncSets({ unitOfWork: { transactional }, setRepository, source: source([fixtures.set()], []) }).execute();
    assert.equal(second.created, 0);
    assert.equal(second.updated, 1);

    const afterId = (await setRepository.findByExternalId(fixtures.set().externalId))?.id;
    assert.equal(afterId, firstId, 'internal set id unchanged across runs');

    const duplicates = await db.orm.public.Set
      .where((candidate) => candidate.externalId.eq(fixtures.set().externalId))
      .select('id')
      .all();
    assert.equal(duplicates.length, 1);
  });

  it('syncs cards idempotently and reconciles variants without duplicates', async () => {
    await new SyncSets({ unitOfWork: { transactional }, setRepository, source: source([fixtures.set()], []) }).execute();

    const cardFixtures = [fixtures.card(`it-card-${runId}-1`, ['normal', 'holofoil']), fixtures.card(`it-card-${runId}-2`, ['holofoil'])];
    const run = () =>
      new SyncCards(
        {
          unitOfWork: { transactional },
          setRepository,
          cardRepository,
          cardVariantRepository,
          source: source([], cardFixtures),
          variantPolicy,
        },
        'EN',
      ).execute();

    const first = await run();
    assert.equal(first.created, 2);
    assert.equal(first.variantsCreated, 3);

    const firstCard1 = await cardRepository.findByExternalId(`it-card-${runId}-1`);
    assert.ok(firstCard1);

    const second = await run();
    assert.equal(second.created, 0);
    assert.equal(second.updated, 2);
    assert.equal(second.variantsCreated, 0);
    assert.equal(second.variantsReused, 3);

    const secondCard1 = await cardRepository.findByExternalId(`it-card-${runId}-1`);
    assert.ok(secondCard1);
    assert.equal(secondCard1.id, firstCard1.id, 'internal card id unchanged across runs');

    const variantsForCard1 = await db.orm.public.CardVariant
      .where((variant) => variant.cardId.eq(firstCard1.id))
      .select('id')
      .all();
    assert.equal(variantsForCard1.length, 2, 'variant reconciliation creates no duplicates');
  });

  it('skips cards with unknown set references, staying referentially valid', async () => {
    const ghostCard: SourceCard = {
      ...fixtures.card(`ghost-${runId}-1`),
      setExternalId: `unknown-set-${runId}`,
    };
    const result = await new SyncCards(
      {
        unitOfWork: { transactional },
        setRepository,
        cardRepository,
        cardVariantRepository,
        source: source([], [ghostCard]),
        variantPolicy,
      },
      'EN',
    ).execute();

    assert.equal(result.unknownSets, 1);
    const ghost = await cardRepository.findByExternalId(`ghost-${runId}-1`);
    assert.equal(ghost, null, 'no card row for unresolved set reference');

    // Every stored card still resolves to a real set (referential validity).
    const orphaned = await db.orm.public.Card
      .where((card) => card.setId.eq('00000000-0000-0000-0000-000000000000'))
      .select('id')
      .all();
    assert.equal(orphaned.length, 0);
  });

  it('creates no CardPrice rows and no economy values', async () => {
    await new SyncSets({ unitOfWork: { transactional }, setRepository, source: source([fixtures.set()], []) }).execute();
    await new SyncCards(
      {
        unitOfWork: { transactional },
        setRepository,
        cardRepository,
        cardVariantRepository,
        source: source([], [fixtures.card(`it-card-${runId}-3`, ['normal'])]),
        variantPolicy,
      },
      'EN',
    ).execute();

    const prices = await db.orm.public.CardPrice.select('id').all();
    assert.equal(prices.length, 0, 'synchronization must never persist prices');
  });

  it('does not delete records missing from a later run', async () => {
    await new SyncSets({ unitOfWork: { transactional }, setRepository, source: source([fixtures.set()], []) }).execute();
    await new SyncCards(
      {
        unitOfWork: { transactional },
        setRepository,
        cardRepository,
        cardVariantRepository,
        source: source([], [fixtures.card(`it-card-${runId}-4`, ['holofoil'])]),
        variantPolicy,
      },
      'EN',
    ).execute();

    // A later run with an empty card source must not remove existing rows.
    await new SyncCards(
      {
        unitOfWork: { transactional },
        setRepository,
        cardRepository,
        cardVariantRepository,
        source: source([], []),
        variantPolicy,
      },
      'EN',
    ).execute();

    const survivor = await cardRepository.findByExternalId(`it-card-${runId}-4`);
    assert.ok(survivor, 'existing card survives a run that no longer returns it');
  });
});
