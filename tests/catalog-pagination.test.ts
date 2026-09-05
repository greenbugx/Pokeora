import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { ButtonInteraction } from 'discord.js';
import { handlePageButton, parsePageCustomId, buildPageRow, PAGE_CUSTOM_ID_PREFIX } from '../src/presentation/commands/catalog-pagination';
import { SearchCards } from '../src/application/use-cases/catalog/card-queries';
import { SearchSets } from '../src/application/use-cases/catalog/set-queries';
import type {
  CatalogPageContext,
  CatalogPageContextStore,
  NewCatalogPageContext,
} from '../src/application/use-cases/catalog/pagination-context-store';
import type { CardQueryRepository } from '../src/domain/card/ports/card-query-repository';
import type { SetQueryRepository } from '../src/domain/set/ports/set-query-repository';
import type { CacheClient } from '../src/infrastructure/cache/cache-client';
import { RedisCatalogPageContextStore } from '../src/infrastructure/cache/redis-catalog-page-context-store';

class InMemoryPageContextStore implements CatalogPageContextStore {
  private readonly contexts = new Map<string, CatalogPageContext>();
  failSave = false;

  async save(context: NewCatalogPageContext): Promise<string | null> {
    if (this.failSave) return null;
    const id = Math.random().toString(16).slice(2, 12);
    this.contexts.set(id, { ...context, id } as CatalogPageContext);
    return id;
  }

  async load(id: string): Promise<CatalogPageContext | null> {
    return this.contexts.get(id) ?? null;
  }
}

/** CacheClient stand-in backing the real Redis store implementation. */
class FakeCache implements CacheClient {
  store = new Map<string, string>();
  failSet = false;

  async connect(): Promise<void> {}
  async close(): Promise<void> {}
  async get(key: string): Promise<string | null> {
    return this.store.get(key) ?? null;
  }
  async set(key: string, value: string): Promise<void> {
    if (this.failSet) throw new Error('cache down');
    this.store.set(key, value);
  }
}

function fakeButton(customId: string, userId = 'user-1'): {
  interaction: ButtonInteraction;
  updates: { content: string; components?: unknown[] }[];
  replies: { content: string }[];
} {
  const updates: { content: string; components?: unknown[] }[] = [];
  const replies: { content: string }[] = [];
  const interaction = {
    customId,
    user: { id: userId },
    replied: false,
    deferred: false,
    update: async (payload: { content: string; components?: unknown[] }) => {
      updates.push(payload);
    },
    reply: async (payload: { content: string }) => {
      replies.push(payload);
    },
    followUp: async () => {},
  } as unknown as ButtonInteraction;
  return { interaction, updates, replies };
}

const cardRepo: CardQueryRepository = {
  findByExternalId: async () => null,
  search: async (query) =>
    // Deterministic 25-row pool so any page is full until offset > 15.
    Array.from({ length: 25 }, (_, i) => ({
      externalId: `gengar-${String(i).padStart(3, '0')}`,
      name: `Gengar ${String(i).padStart(2, '0')}`,
      number: '078',
      rarity: 'Rare',
      setExternalId: 'swsh11',
      setName: 'Lost Origin',
      imageSmall: 'https://s',
    })).slice(query.offset, query.offset + query.limit),
};

const setRepo: SetQueryRepository = {
  findByExternalId: async () => null,
  search: async () => [],
};

describe('page custom ID parsing', () => {
  it('parses valid ids', () => {
    assert.deepEqual(parsePageCustomId('pg:card:ab12cd34ef:2'), {
      kind: 'card',
      contextId: 'ab12cd34ef',
      page: 2,
    });
    assert.deepEqual(parsePageCustomId('pg:set:ab12cd34ef:11'), {
      kind: 'set',
      contextId: 'ab12cd34ef',
      page: 11,
    });
  });

  it('rejects foreign or malformed ids', () => {
    assert.equal(parsePageCustomId('other:card:ab12cd34ef:2'), null);
    assert.equal(parsePageCustomId('pg:card:ab12cd34ef:0'), null);
    assert.equal(parsePageCustomId('pg:card:ab12cd34ef:not-a-page'), null);
    assert.equal(parsePageCustomId('pg:card:DROP TABLE:2'), null);
    assert.equal(parsePageCustomId('pg:widget:ab12cd34ef:2'), null);
  });
});

describe('page row building', () => {
  it('omits Prev on page 1 and Next without more results', () => {
    assert.equal(buildPageRow('card', 'abc', 1, false), null);
    const both = buildPageRow('card', 'abc', 2, true)!.toJSON();
    assert.equal(both.components.length, 2);
    const onlyNext = buildPageRow('card', 'abc', 1, true)!.toJSON();
    assert.deepEqual(
      onlyNext.components.map((button) => (button as { custom_id: string }).custom_id),
      ['pg:card:abc:2'],
    );
    const onlyPrev = buildPageRow('card', 'abc', 3, false)!.toJSON();
    assert.deepEqual(
      onlyPrev.components.map((button) => (button as { custom_id: string }).custom_id),
      ['pg:card:abc:2'],
    );
    assert.ok(parsePageCustomId('pg:card:abc:2') !== null);
  });
});

describe('pagination button handling', () => {
  it('re-runs the stored query at the requested page and updates the message', async () => {
    const store = new InMemoryPageContextStore();
    const contextId = (await store.save({
      userId: 'user-1',
      kind: 'card',
      query: { name: 'gengar' },
    }))!;
    const { interaction, updates } = fakeButton(`${PAGE_CUSTOM_ID_PREFIX}card:${contextId}:2`);

    await handlePageButton(interaction, store, new SearchCards(cardRepo), new SearchSets(setRepo));

    assert.equal(updates.length, 1);
    assert.match(updates[0]!.content, /Gengar 10/);
    const row = (updates[0]!.components as { toJSON(): { components: { custom_id: string }[] } }[])[0]!;
    const ids = row.toJSON().components.map((button) => button.custom_id);
    assert.deepEqual(ids, ['pg:card:' + contextId + ':1', 'pg:card:' + contextId + ':3']);
  });

  it('expired contexts get the expired message, not a crash', async () => {
    const store = new InMemoryPageContextStore();
    const { interaction, replies, updates } = fakeButton(`${PAGE_CUSTOM_ID_PREFIX}card:deadbeef:2`);
    await handlePageButton(interaction, store, new SearchCards(cardRepo), new SearchSets(setRepo));
    assert.equal(updates.length, 0);
    assert.match(replies[0]!.content, /expired/i);
  });

  it('rejects presses from other users', async () => {
    const store = new InMemoryPageContextStore();
    const contextId = (await store.save({
      userId: 'owner-1',
      kind: 'card',
      query: { name: 'gengar' },
    }))!;
    const { interaction, replies, updates } = fakeButton(
      `${PAGE_CUSTOM_ID_PREFIX}card:${contextId}:2`,
      'someone-else',
    );
    await handlePageButton(interaction, store, new SearchCards(cardRepo), new SearchSets(setRepo));
    assert.equal(updates.length, 0);
    assert.match(replies[0]!.content, /another user/i);
  });

  it('supports set pagination', async () => {
    const store = new InMemoryPageContextStore();
    const contextId = (await store.save({
      userId: 'user-1',
      kind: 'set',
      query: { series: 'Sword & Shield' },
    }))!;
    const { interaction, updates } = fakeButton(`${PAGE_CUSTOM_ID_PREFIX}set:${contextId}:1`);
    await handlePageButton(interaction, store, new SearchCards(cardRepo), new SearchSets(setRepo));
    assert.equal(updates.length, 1);
    assert.match(updates[0]!.content, /No sets found/i, 'fake set repo has no rows; empty result renders safely');
  });
});

describe('RedisCatalogPageContextStore', () => {
  it('roundtrips contexts through the cache client and survives shapes', async () => {
    const cache = new FakeCache();
    const store = new RedisCatalogPageContextStore(cache);
    const id = await store.save({ userId: 'user-9', kind: 'card', query: { name: 'pikachu', rarity: 'Rare' } });
    assert.ok(id);
    const loaded = await store.load(id!);
    assert.deepEqual(loaded, {
      id: id!,
      userId: 'user-9',
      kind: 'card',
      query: { name: 'pikachu', rarity: 'Rare' },
    });
    assert.equal(await store.load('nope'), null);
  });

  it('save returns null when the cache is unavailable (no buttons, no crash)', async () => {
    const cache = new FakeCache();
    cache.failSet = true;
    const store = new RedisCatalogPageContextStore(cache);
    assert.equal(await store.save({ userId: 'u', kind: 'card', query: {} }), null);
  });
});
