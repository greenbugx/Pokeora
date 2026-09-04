import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { SyncCards } from '../src/application/use-cases/sync/sync-cards';
import { SyncSets } from '../src/application/use-cases/sync/sync-sets';
import { Temporal } from '@js-temporal/polyfill';
import type { CatalogSource, SourceCard, SourcePage, SourceSet } from '../src/application/use-cases/sync/catalog-source';
import type { CardVariant } from '../src/domain/card/entities/card-variant';
import type { CardVariantIdentity, CardVariantRepository } from '../src/domain/card/ports/card-variant-repository';
import type { Card, CardChanges } from '../src/domain/card/entities/card';
import type { CardRepository } from '../src/domain/card/ports/card-repository';
import type { Set, SetChanges } from '../src/domain/set/entities/set';
import type { SetRepository } from '../src/domain/set/ports/set-repository';
import type { UnitOfWork } from '../src/domain/shared/ports/unit-of-work';

function fakeSource(setsPages: SourceSet[][], cardsPages: SourceCard[][]): CatalogSource {
  return {
    async *sets() {
      for (const [index, items] of setsPages.entries()) {
        yield { page: index + 1, pageSize: items.length, totalCount: setsPages.flat().length, items } satisfies SourcePage<SourceSet>;
      }
    },
    async *cards() {
      for (const [index, items] of cardsPages.entries()) {
        yield { page: index + 1, pageSize: items.length, totalCount: cardsPages.flat().length, items } satisfies SourcePage<SourceCard>;
      }
    },
  };
}

function createFakes() {
  const sets = new Map<string, Set>();
  const cards = new Map<string, Card>();
  const variants: CardVariant[] = [];
  let setSeq = 0;
  let cardSeq = 0;
  let variantSeq = 0;
  const setLookupBuilds: number[] = [];

  const setRepository: SetRepository = {
    async findByExternalId(externalId) {
      return sets.get(externalId) ?? null;
    },
    async upsert(changes: SetChanges) {
      // Mirror the real repository's contract validation.
      if (changes.name.length === 0 || changes.series.length === 0) {
        throw new Error(`invalid set payload for ${changes.externalId}`);
      }
      const existing = sets.get(changes.externalId);
      const saved: Set = existing ? { ...existing, ...changes } : { id: `set-${++setSeq}`, ...changes };
      sets.set(changes.externalId, saved);
      return saved;
    },
    async loadExternalIdMap() {
      setLookupBuilds.push(sets.size);
      return new Map([...sets.values()].map((set) => [set.externalId, set.id]));
    },
  };

  const cardRepository: CardRepository = {
    async findByExternalId(externalId) {
      return cards.get(externalId) ?? null;
    },
    async upsert(changes: CardChanges) {
      const existing = cards.get(changes.externalId);
      const saved: Card = existing ? { ...existing, ...changes } : { id: `card-${++cardSeq}`, ...changes };
      cards.set(changes.externalId, saved);
      return saved;
    },
  };

  const cardVariantRepository: CardVariantRepository = {
    async findByIdentity(identity: CardVariantIdentity) {
      return (
        variants.find(
          (variant) =>
            variant.cardId === identity.cardId &&
            variant.variantType === identity.variantType &&
            variant.finish === identity.finish &&
            variant.language === identity.language,
        ) ?? null
      );
    },
    async create(variant: CardVariant) {
      const created = { ...variant, id: `variant-${++variantSeq}` };
      variants.push(created);
      return created;
    },
  };

  const unitOfWork: UnitOfWork = { transactional: (work) => work() };

  return { sets, cards, variants, setRepository, cardRepository, cardVariantRepository, unitOfWork, setLookupBuilds };
}

const variantPolicy = {
  toVariantIdentity(evidenceKey: string) {
    const table: Record<string, { variantType: string; finish: string }> = {
      normal: { variantType: 'NORMAL', finish: 'NON_FOIL' },
      holofoil: { variantType: 'HOLO', finish: 'HOLOFOIL' },
      reverseHolofoil: { variantType: 'REVERSE_HOLO', finish: 'REVERSE_HOLOFOIL' },
      '1stEditionNormal': { variantType: 'FIRST_EDITION', finish: 'NON_FOIL' },
      '1stEditionHolofoil': { variantType: 'FIRST_EDITION', finish: 'HOLOFOIL' },
    };
    return table[evidenceKey] ?? null;
  },
};

const aSet = (externalId: string): SourceSet => ({
  externalId,
  name: `Set ${externalId}`,
  series: 'Sword & Shield',
  releaseDate: Temporal.PlainDate.from('2020-08-14'),
  totalCards: 203,
  logoUrl: `https://${externalId}/logo`,
  symbolUrl: `https://${externalId}/symbol`,
});

const aCard = (externalId: string, setExternalId: string, evidence: string[] = []): SourceCard => ({
  externalId,
  setExternalId,
  name: `Card ${externalId}`,
  number: '25',
  rarity: 'Rare',
  imageSmall: `https://${externalId}/small`,
  imageLarge: `https://${externalId}/large`,
  variantEvidenceKeys: evidence,
});

describe('SyncSets (unit)', () => {
  it('upserts sets idempotently, preserving internal ids', async () => {
    const fakes = createFakes();
    const source = fakeSource([[aSet('swsh4'), aSet('swsh45')]], []);
    const deps = { ...fakes };

    const first = await new SyncSets({ ...deps, source }).execute();
    assert.equal(first.created, 2);
    assert.equal(first.updated, 0);

    const second = await new SyncSets({ ...deps, source }).execute();
    assert.equal(second.created, 0);
    assert.equal(second.updated, 2);
    assert.equal(fakes.sets.size, 2);
    assert.equal(fakes.sets.get('swsh4')?.id, 'set-1', 'internal id unchanged across runs');
  });

  it('does not delete sets missing from a later run', async () => {
    const fakes = createFakes();
    await new SyncSets({ ...fakes, source: fakeSource([[aSet('a'), aSet('b')]], []) }).execute();
    await new SyncSets({ ...fakes, source: fakeSource([[aSet('a')]], []) }).execute();
    assert.equal(fakes.sets.size, 2);
  });

  it('counts invalid items as failed without poisoning the page', async () => {
    const fakes = createFakes();
    const bad = { ...aSet('bad'), name: '' };
    const result = await new SyncSets({
      ...fakes,
      source: fakeSource([[bad, aSet('good')]], []),
    }).execute();
    assert.equal(result.failed, 1);
    assert.equal(result.created, 1);
    assert.equal(fakes.sets.size, 1);
  });
});

describe('SyncCards (unit)', () => {
  it('creates cards with resolved set ids and source-backed variants', async () => {
    const fakes = createFakes();
    await new SyncSets({ ...fakes, source: fakeSource([[aSet('swsh4')]], []) }).execute();

    const result = await new SyncCards(
      {
        ...fakes,
        source: fakeSource([], [[aCard('swsh4-25', 'swsh4', ['normal', 'holofoil'])]]),
        variantPolicy,
      },
      'EN',
    ).execute();

    assert.equal(result.created, 1);
    assert.equal(result.variantsCreated, 2);
    const card = fakes.cards.get('swsh4-25');
    assert.ok(card);
    assert.equal(card.setId, fakes.sets.get('swsh4')?.id);
    assert.equal(fakes.variants.length, 2);
    assert.ok(fakes.variants.every((variant) => variant.isCollectible && variant.language === 'EN'));
  });

  it('skips cards referencing unknown sets and keeps the db referentially valid', async () => {
    const fakes = createFakes();
    const result = await new SyncCards(
      {
        ...fakes,
        source: fakeSource([], [[aCard('ghost-1', 'ghost-set')]]),
        variantPolicy,
      },
      'EN',
    ).execute();

    assert.equal(result.unknownSets, 1);
    assert.equal(result.failed, 1);
    assert.equal(fakes.cards.size, 0);
  });

  it('reconciles variants idempotently: second run reuses, never duplicates', async () => {
    const fakes = createFakes();
    await new SyncSets({ ...fakes, source: fakeSource([[aSet('swsh4')]], []) }).execute();
    const source = fakeSource([], [[aCard('swsh4-25', 'swsh4', ['holofoil'])]]);

    const first = await new SyncCards({ ...fakes, source, variantPolicy }, 'EN').execute();
    const second = await new SyncCards({ ...fakes, source, variantPolicy }, 'EN').execute();

    assert.equal(first.variantsCreated, 1);
    assert.equal(second.variantsCreated, 0);
    assert.equal(second.variantsReused, 1);
    assert.equal(fakes.variants.length, 1);
  });

  it('does not fabricate variants absent from source evidence', async () => {
    const fakes = createFakes();
    await new SyncSets({ ...fakes, source: fakeSource([[aSet('swsh4')]], []) }).execute();

    // holofoil only — must NOT imply a NORMAL variant.
    await new SyncCards(
      { ...fakes, source: fakeSource([], [[aCard('c1', 'swsh4', ['holofoil'])]]), variantPolicy },
      'EN',
    ).execute();
    assert.deepEqual(
      fakes.variants.map((variant) => variant.variantType),
      ['HOLO'],
    );

    // no evidence at all — no variants.
    fakes.variants.length = 0;
    await new SyncCards(
      { ...fakes, source: fakeSource([], [[aCard('c2', 'swsh4', [])]]), variantPolicy },
      'EN',
    ).execute();
    assert.equal(fakes.variants.length, 0);
  });

  it('builds the set lookup once, before processing card pages', async () => {
    const fakes = createFakes();
    await new SyncSets({ ...fakes, source: fakeSource([[aSet('swsh4')]], []) }).execute();
    await new SyncCards(
      {
        ...fakes,
        source: fakeSource([], [[aCard('c1', 'swsh4')], [aCard('c2', 'swsh4')]]),
        variantPolicy,
      },
      'EN',
    ).execute();
    assert.deepEqual(fakes.setLookupBuilds, [1], 'lookup built exactly once (no per-card set queries)');
  });

  it('keeps previously committed pages when a later page fails', async () => {
    const fakes = createFakes();
    await new SyncSets({ ...fakes, source: fakeSource([[aSet('swsh4')]], []) }).execute();

    let transactions = 0;
    const unitOfWork: UnitOfWork = {
      transactional: async (work) => {
        transactions += 1;
        if (transactions === 2) throw new Error('page 2 transaction failed');
        return work();
      },
    };

    const result = await new SyncCards(
      {
        ...fakes,
        unitOfWork,
        source: fakeSource([], [[aCard('c1', 'swsh4')], [aCard('c2', 'swsh4')]]),
        variantPolicy,
      },
      'EN',
    ).execute().catch(() => null);

    assert.equal(result, null, 'run aborts on page failure');
    assert.equal(fakes.cards.size, 1, 'page 1 committed rows survive the page 2 failure');
    assert.equal(fakes.cards.has('c1'), true);
    assert.equal(fakes.cards.has('c2'), false);
  });
});
