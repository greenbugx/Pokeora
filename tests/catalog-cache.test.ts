import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { CachedCardQueryRepository, CachedSetQueryRepository } from '../src/infrastructure/cache/cached-catalog-repositories';
import { IoredisCacheClient } from '../src/infrastructure/cache/ioredis-cache-client';
import { NullCacheClient } from '../src/infrastructure/cache/null-cache-client';
import type { CacheClient } from '../src/infrastructure/cache/cache-client';
import type {
  CardDetailsRecord,
  CardQueryRepository,
} from '../src/domain/card/ports/card-query-repository';
import type { SetDetailsRecord, SetQueryRepository } from '../src/domain/set/ports/set-query-repository';
import { Temporal } from '@js-temporal/polyfill';
import Redis from 'ioredis';
import { PrismaCardQueryRepository } from '../src/infrastructure/database/repositories/prisma-card-query.repository';

const silentLogger = { info: () => {}, error: () => {} };

class FakeCache implements CacheClient {
  store = new Map<string, string>();
  getCalls = 0;
  failGet = false;
  failSet = false;

  async connect(): Promise<void> {}

  async get(key: string): Promise<string | null> {
    this.getCalls += 1;
    if (this.failGet) throw new Error('cache down');
    return this.store.get(key) ?? null;
  }

  async set(key: string, value: string): Promise<void> {
    if (this.failSet) throw new Error('cache down');
    this.store.set(key, value);
  }

  async close(): Promise<void> {}
}

const cardRecord: CardDetailsRecord = {
  externalId: 'swsh4-25',
  name: 'Charizard',
  number: '25',
  rarity: 'Rare',
  setExternalId: 'swsh4',
  setName: 'Vivid Voltage',
  setSeries: 'Sword & Shield',
  imageSmall: 'https://small',
  imageLarge: 'https://large',
  variants: [{ variantType: 'NORMAL', finish: 'NON_FOIL', language: 'EN', isCollectible: true }],
};

const setRecord: SetDetailsRecord = {
  externalId: 'swsh4',
  name: 'Vivid Voltage',
  series: 'Sword & Shield',
  releaseDate: Temporal.PlainDate.from('2020-11-13'),
  totalCards: 203,
  logoUrl: 'https://logo',
  symbolUrl: 'https://symbol',
};

describe('CachedCardQueryRepository', () => {
  it('caches exact lookups: second call does not reach PostgreSQL', async () => {
    const cache = new FakeCache();
    let calls = 0;
    const repo: CardQueryRepository = {
      findByExternalId: async (id) => {
        calls += 1;
        return id === 'swsh4-25' ? cardRecord : null;
      },
      search: async () => [],
    };
    const cached = new CachedCardQueryRepository(repo, cache);

    const first = await cached.findByExternalId('swsh4-25');
    const second = await cached.findByExternalId('swsh4-25');

    assert.equal(calls, 1);
    assert.deepEqual(first, second);
    const raw = cache.store.get('pokeora:card:id:swsh4-25');
    assert.ok(raw, 'stored under the namespaced key');
    assert.ok(JSON.parse(raw!).externalId === 'swsh4-25');
  });

  it('does not cache negative results', async () => {
    const cache = new FakeCache();
    const repo: CardQueryRepository = {
      findByExternalId: async () => null,
      search: async () => [],
    };
    await new CachedCardQueryRepository(repo, cache).findByExternalId('ghost');
    assert.equal(cache.store.size, 0);
  });

  it('falls back to PostgreSQL when the cache read fails', async () => {
    const cache = new FakeCache();
    cache.failGet = true;
    let calls = 0;
    const repo: CardQueryRepository = {
      findByExternalId: async () => {
        calls += 1;
        return cardRecord;
      },
      search: async () => [],
    };
    const cached = new CachedCardQueryRepository(repo, cache);
    const record = await cached.findByExternalId('swsh4-25');
    assert.equal(record?.name, 'Charizard');
    assert.equal(calls, 1);
  });

  it('returns the record when the cache write fails', async () => {
    const cache = new FakeCache();
    cache.failSet = true;
    const repo: CardQueryRepository = {
      findByExternalId: async () => cardRecord,
      search: async () => [],
    };
    const record = await new CachedCardQueryRepository(repo, cache).findByExternalId('swsh4-25');
    assert.equal(record?.externalId, 'swsh4-25');
  });

  it('treats corrupt cache entries as misses', async () => {
    const cache = new FakeCache();
    cache.store.set('pokeora:card:id:swsh4-25', '{not json');
    let calls = 0;
    const repo: CardQueryRepository = {
      findByExternalId: async () => {
        calls += 1;
        return cardRecord;
      },
      search: async () => [],
    };
    const record = await new CachedCardQueryRepository(repo, cache).findByExternalId('swsh4-25');
    assert.equal(record?.name, 'Charizard');
    assert.equal(calls, 1);
  });

  it('never caches search — every search reaches PostgreSQL', async () => {
    const cache = new FakeCache();
    let calls = 0;
    const repo: CardQueryRepository = {
      findByExternalId: async () => null,
      search: async () => {
        calls += 1;
        return [];
      },
    };
    const cached = new CachedCardQueryRepository(repo, cache);
    await cached.search({ name: 'gengar', limit: 10, offset: 0 });
    await cached.search({ name: 'gengar', limit: 10, offset: 0 });
    assert.equal(calls, 2);
    assert.equal(cache.store.size, 0);
  });
});

describe('CachedSetQueryRepository', () => {
  it('revives releaseDate as a Temporal.PlainDate on cache hits', async () => {
    const cache = new FakeCache();
    const repo: SetQueryRepository = {
      findByExternalId: async (id) => (id === 'swsh4' ? setRecord : null),
      search: async () => [],
    };
    const cached = new CachedSetQueryRepository(repo, cache);

    await cached.findByExternalId('swsh4'); // populate
    const hit = await cached.findByExternalId('swsh4');

    assert.ok(hit);
    assert.equal(hit.releaseDate.toString(), '2020-11-13');
    assert.equal(hit.totalCards, 203);
    const raw = cache.store.get('pokeora:set:id:swsh4');
    assert.ok(raw);
    assert.equal(JSON.parse(raw!).releaseDate, '2020-11-13', 'serialized as an ISO calendar string');
  });
});

describe('NullCacheClient', () => {
  it('always misses and never stores', async () => {
    const cache = new NullCacheClient();
    let calls = 0;
    const repo: CardQueryRepository = {
      findByExternalId: async () => {
        calls += 1;
        return cardRecord;
      },
      search: async () => [],
    };
    const cached = new CachedCardQueryRepository(repo, cache);
    await cached.findByExternalId('swsh4-25');
    await cached.findByExternalId('swsh4-25');
    assert.equal(calls, 2, 'no cache configured: every lookup reaches PostgreSQL');
  });
});

describe('catalog cache (live Redis)', { skip: process.env['REDIS_URL'] ? false : 'REDIS_URL not set' }, () => {
  let client: IoredisCacheClient;
  let available = false;

  before(async () => {
    client = new IoredisCacheClient(process.env['REDIS_URL']!, silentLogger);
    await client.connect();
    try {
      await client.set('pokeora:test:ping', '1', 30);
      available = true;
      // Make the roundtrip test idempotent across runs within the TTL window.
      const cleaner = new Redis(process.env['REDIS_URL']!);
      await cleaner.del('pokeora:card:id:swsh4-25');
      cleaner.disconnect();
    } catch {
      available = false; // Redis configured but not reachable — skip live tests
    }
  });

  after(async () => {
    if (available) {
      try {
        const raw = await client.get('pokeora:card:id:swsh4-25');
        void raw; // key expires via TTL; nothing persistent to clean
      } catch {
        /* ignore */
      }
    }
    await client.close();
  });

  it('roundtrips an exact lookup through real Redis', async () => {
    if (!available) return;
    const prisma = new PrismaCardQueryRepository();
    let calls = 0;
    const counting: CardQueryRepository = {
      findByExternalId: async (id) => {
        calls += 1;
        return prisma.findByExternalId(id);
      },
      search: async (query) => prisma.search(query),
    };
    const cached = new CachedCardQueryRepository(counting, client);

    const first = await cached.findByExternalId('swsh4-25');
    const second = await cached.findByExternalId('swsh4-25');

    assert.equal(first?.name, 'Charizard');
    assert.equal(second?.name, 'Charizard');
    assert.equal(calls, 1, 'second lookup served from Redis');
  });

  it('keeps serving when Redis disappears mid-flight', async () => {
    if (!available) return;
    const prisma = new PrismaCardQueryRepository();
    const cached = new CachedCardQueryRepository(prisma, client);
    await client.close(); // simulate outage
    const record = await cached.findByExternalId('swsh4-25');
    assert.equal(record?.name, 'Charizard', 'Redis failure must not break the query');
  });
});
