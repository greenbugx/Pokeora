import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { GetCard, SearchCards } from '../src/application/use-cases/catalog/card-queries';
import { GetSet, SearchSets } from '../src/application/use-cases/catalog/set-queries';
import {
  CardNotFoundError,
  InvalidCardQueryError,
  InvalidSetQueryError,
  SetNotFoundError,
} from '../src/application/use-cases/catalog/catalog-errors';
import { MAX_PAGE_SIZE, pageToOffset } from '../src/application/use-cases/catalog/pagination';
import { translateRepositoryError } from '../src/application/use-cases/catalog/query-error';
import { CatalogUnavailableError } from '../src/application/use-cases/catalog/catalog-errors';
import type {
  CardDetailsRecord,
  CardQueryRepository,
} from '../src/domain/card/ports/card-query-repository';
import type { SetQueryRepository } from '../src/domain/set/ports/set-query-repository';
import { Temporal } from '@js-temporal/polyfill';

describe('pagination bounds', () => {
  it('converts pages to offsets and clamps limits', () => {
    assert.deepEqual(pageToOffset(1), { offset: 0, limit: 10 });
    assert.deepEqual(pageToOffset(3), { offset: 20, limit: 10 });
    assert.deepEqual(pageToOffset(0), { offset: 0, limit: 10 }, 'page < 1 normalizes to page 1');
    assert.deepEqual(pageToOffset(-5), { offset: 0, limit: 10 });
    assert.equal(pageToOffset(1, 10_000).limit, MAX_PAGE_SIZE, 'oversized limits clamp to MAX');
    assert.equal(pageToOffset(1, 0).limit, 10, 'zero limit falls back to default');
    assert.equal(pageToOffset(2, 25).offset, 25);
  });
});

describe('GetCard', () => {
  const details: CardDetailsRecord = {
    externalId: 'swsh4-25',
    name: 'Charizard',
    number: '25',
    rarity: 'Rare',
    setExternalId: 'swsh4',
    setName: 'Vivid Voltage',
    setSeries: 'Sword & Shield',
    imageSmall: 'https://small',
    imageLarge: 'https://large',
    variants: [
      { variantType: 'NORMAL', finish: 'NON_FOIL', language: 'EN', isCollectible: true },
    ],
  };

  it('returns mapped details for an exact id', async () => {
    const repo: CardQueryRepository = {
      findByExternalId: async (id) => (id === 'swsh4-25' ? details : null),
      search: async () => [],
    };
    const result = await new GetCard(repo).execute('swsh4-25');
    assert.equal(result.name, 'Charizard');
    assert.equal(result.set.externalId, 'swsh4');
    assert.equal(result.variants.length, 1);
  });

  it('throws CardNotFound for an unknown id', async () => {
    const repo: CardQueryRepository = { findByExternalId: async () => null, search: async () => [] };
    await assert.rejects(new GetCard(repo).execute('nope'), CardNotFoundError);
  });

  it('rejects an empty id', async () => {
    const repo: CardQueryRepository = { findByExternalId: async () => null, search: async () => [] };
    await assert.rejects(new GetCard(repo).execute('  '), InvalidCardQueryError);
  });

  it('wraps repository crashes as CatalogUnavailable', async () => {
    const repo: CardQueryRepository = {
      findByExternalId: async () => {
        throw new Error('connection reset');
      },
      search: async () => [],
    };
    await assert.rejects(new GetCard(repo).execute('swsh4-25'), CatalogUnavailableError);
  });
});

describe('SearchCards', () => {
  it('rejects an empty query', async () => {
    const repo: CardQueryRepository = { findByExternalId: async () => null, search: async () => [] };
    await assert.rejects(new SearchCards(repo).execute({}), InvalidCardQueryError);
  });

  it('computes hasMore from the extra row and strips it', async () => {
    const repo: CardQueryRepository = {
      findByExternalId: async () => null,
      search: async (query) => {
        // Simulate 11 matching rows when the use case asked for limit+1.
        const count = query.limit;
        return Array.from({ length: count }, (_, i) => ({
          externalId: `c${i}`,
          name: `Card ${i}`,
          number: String(i),
          rarity: 'Rare',
          setExternalId: 'swsh4',
          setName: 'Vivid Voltage',
          imageSmall: 'https://s',
        }));
      },
    };
    const result = await new SearchCards(repo).execute({ name: 'card' });
    assert.equal(result.items.length, 10);
    assert.equal(result.hasMore, true);
    assert.equal(result.pageSize, 10);
  });

  it('reports hasMore=false when the page is not full', async () => {
    const repo: CardQueryRepository = {
      findByExternalId: async () => null,
      search: async () => [
        {
          externalId: 'one',
          name: 'One',
          number: '1',
          rarity: 'Rare',
          setExternalId: 'swsh4',
          setName: 'Vivid Voltage',
          imageSmall: 'https://s',
        },
      ],
    };
    const result = await new SearchCards(repo).execute({ name: 'one' });
    assert.equal(result.hasMore, false);
  });

  it('bounds repository fetches to page size + 1 for any page number', async () => {
    let seenLimit = 0;
    const repo: CardQueryRepository = {
      findByExternalId: async () => null,
      search: async (query) => {
        seenLimit = query.limit;
        return [];
      },
    };
    await new SearchCards(repo).execute({ name: 'x', page: 999 });
    assert.equal(seenLimit, 11, 'default page size 10 + 1 hasMore probe row');
    // Oversized limits are clamped at the pagination boundary (see
    // pagination suite); the use case itself always sends limit+1.
  });
});

describe('GetSet / SearchSets', () => {
  const setRepo: SetQueryRepository = {
    findByExternalId: async (id) =>
      id === 'swsh4'
        ? {
            externalId: 'swsh4',
            name: 'Vivid Voltage',
            series: 'Sword & Shield',
            releaseDate: Temporal.PlainDate.from('2020-11-13'),
            totalCards: 203,
            logoUrl: 'https://logo',
            symbolUrl: 'https://symbol',
          }
        : null,
    search: async () => [],
  };

  it('returns mapped set details', async () => {
    const set = await new GetSet(setRepo).execute('swsh4');
    assert.equal(set.name, 'Vivid Voltage');
    assert.equal(set.releaseDate, '2020-11-13');
    assert.equal(set.totalCards, 203);
  });

  it('throws SetNotFound for unknown ids and rejects empty queries', async () => {
    await assert.rejects(new GetSet(setRepo).execute('nope'), SetNotFoundError);
    await assert.rejects(new SearchSets(setRepo).execute({}), InvalidSetQueryError);
  });
});

describe('error translation', () => {
  it('passes application errors through and wraps the rest', () => {
    const notFound = new CardNotFoundError('x');
    assert.equal(translateRepositoryError(notFound), notFound);
    const invalid = new InvalidSetQueryError('x');
    assert.equal(translateRepositoryError(invalid), invalid);
    const wrapped = translateRepositoryError(new Error('boom'));
    assert.ok(wrapped instanceof CatalogUnavailableError);
  });
});
