import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { ChatInputCommandInteraction } from 'discord.js';
import { executeCardCommand } from '../src/presentation/commands/card';
import { NullCatalogPageContextStore } from '../src/infrastructure/cache/redis-catalog-page-context-store';
import { executeSetCommand } from '../src/presentation/commands/set';
import { GetCard, SearchCards } from '../src/application/use-cases/catalog/card-queries';
import { GetSet, SearchSets } from '../src/application/use-cases/catalog/set-queries';
import type {
  CardDetailsRecord,
  CardQueryRepository,
} from '../src/domain/card/ports/card-query-repository';
import type { SetQueryRepository } from '../src/domain/set/ports/set-query-repository';
import { Temporal } from '@js-temporal/polyfill';

/** Minimal stand-in for a chat-input interaction. */
function fakeInteraction(options: Record<string, string | number | null>): {
  interaction: ChatInputCommandInteraction;
  replies: { content: string; ephemeral?: boolean }[];
} {
  const replies: { content: string; ephemeral?: boolean }[] = [];
  const interaction = {
    options: {
      getString: (name: string) => (name in options ? (options[name] as string | null) : null),
      getInteger: (name: string) => (name in options ? (options[name] as number | null) : null),
    },
    replied: false,
    deferred: false,
    reply: async (payload: { content: string; ephemeral?: boolean }) => {
      replies.push(payload);
    },
    followUp: async () => {},
  } as unknown as ChatInputCommandInteraction;
  return { interaction, replies };
}

const store = new NullCatalogPageContextStore();
const emptyRepo: CardQueryRepository = { findByExternalId: async () => null, search: async () => [] };
const emptySetRepo: SetQueryRepository = { findByExternalId: async () => null, search: async () => [] };

describe('/card presentation', () => {
  it('empty query returns guidance without searching', async () => {
    const { interaction, replies } = fakeInteraction({});
    await executeCardCommand(interaction, new GetCard(emptyRepo), new SearchCards(emptyRepo), store);
    assert.equal(replies.length, 1);
    assert.match(replies[0]!.content, /provide a card ID/i);
  });

  it('unknown id returns a safe not-found message', async () => {
    const { interaction, replies } = fakeInteraction({ id: 'missing-card' });
    await executeCardCommand(interaction, new GetCard(emptyRepo), new SearchCards(emptyRepo), store);
    assert.match(replies[0]!.content, /Card not found/i);
    assert.ok(!replies[0]!.content.includes('Prisma') && !replies[0]!.content.includes('SQL'));
  });

  it('exact id renders detail view with variants and image', async () => {
    const details: CardDetailsRecord = {
      externalId: 'swsh4-25',
      name: 'Charizard',
      number: '25',
      rarity: 'Rare',
      setExternalId: 'swsh4',
      setName: 'Vivid Voltage',
      setSeries: 'Sword & Shield',
      imageSmall: 'https://small.png',
      imageLarge: 'https://large.png',
      variants: [{ variantType: 'HOLO', finish: 'HOLOFOIL', language: 'EN', isCollectible: true }],
    };
    const repo: CardQueryRepository = {
      findByExternalId: async (id) => (id === 'swsh4-25' ? details : null),
      search: async () => [],
    };
    const { interaction, replies } = fakeInteraction({ id: 'swsh4-25' });
    await executeCardCommand(interaction, new GetCard(repo), new SearchCards(emptyRepo), store);
    const content = replies[0]!.content;
    assert.match(content, /Charizard/);
    assert.match(content, /Vivid Voltage/);
    assert.match(content, /HOLOFOIL/);
    assert.match(content, /https:\/\/large\.png/);
    assert.match(content, /ID: swsh4-25/);
  });

  it('search renders a numbered, bounded list', async () => {
    const repo: CardQueryRepository = {
      findByExternalId: async () => null,
      search: async () =>
        Array.from({ length: 3 }, (_, i) => ({
          externalId: `g${i}`,
          name: `Gengar ${i}`,
          number: '078',
          rarity: 'Rare',
          setExternalId: 'swsh11',
          setName: 'Lost Origin',
          imageSmall: 'https://s',
        })),
    };
    const { interaction, replies } = fakeInteraction({ name: 'gengar' });
    await executeCardCommand(interaction, new GetCard(emptyRepo), new SearchCards(repo), store);
    const content = replies[0]!.content;
    assert.match(content, /1\. \*\*Gengar 0\*\*/);
    assert.match(content, /Lost Origin #078/);
  });

  it('zero-result search is a normal empty message', async () => {
    const { interaction, replies } = fakeInteraction({ name: 'zzz-nothing' });
    await executeCardCommand(interaction, new GetCard(emptyRepo), new SearchCards(emptyRepo), store);
    assert.match(replies[0]!.content, /No cards found/i);
  });
});

describe('/set presentation', () => {
  it('empty query returns guidance', async () => {
    const { interaction, replies } = fakeInteraction({});
    await executeSetCommand(interaction, new GetSet(emptySetRepo), new SearchSets(emptySetRepo), store);
    assert.match(replies[0]!.content, /provide a set ID/i);
  });

  it('exact id renders set details', async () => {
    const repo: SetQueryRepository = {
      findByExternalId: async (id) =>
        id === 'swsh4'
          ? {
              externalId: 'swsh4',
              name: 'Vivid Voltage',
              series: 'Sword & Shield',
              releaseDate: Temporal.PlainDate.from('2020-11-13'),
              totalCards: 203,
              logoUrl: 'https://logo.png',
              symbolUrl: 'https://symbol.png',
            }
          : null,
      search: async () => [],
    };
    const { interaction, replies } = fakeInteraction({ id: 'swsh4' });
    await executeSetCommand(interaction, new GetSet(repo), new SearchSets(emptySetRepo), store);
    const content = replies[0]!.content;
    assert.match(content, /Vivid Voltage/);
    assert.match(content, /2020-11-13/);
    assert.match(content, /Total cards: 203/);
  });

  it('unknown id returns a safe not-found message', async () => {
    const { interaction, replies } = fakeInteraction({ id: 'missing-set' });
    await executeSetCommand(interaction, new GetSet(emptySetRepo), new SearchSets(emptySetRepo), store);
    assert.match(replies[0]!.content, /Set not found/i);
  });

  it('single-result search renders the detail view directly', async () => {
    const details: CardDetailsRecord = {
      externalId: 'uniq-1',
      name: 'Unique Card',
      number: '1',
      rarity: 'Rare',
      setExternalId: 'swsh4',
      setName: 'Vivid Voltage',
      setSeries: 'Sword & Shield',
      imageSmall: 'https://small.png',
      imageLarge: 'https://large.png',
      variants: [{ variantType: 'HOLO', finish: 'HOLOFOIL', language: 'EN', isCollectible: true }],
    };
    const searchRepo: CardQueryRepository = {
      findByExternalId: async () => null,
      search: async () => [
        {
          externalId: 'uniq-1',
          name: 'Unique Card',
          number: '1',
          rarity: 'Rare',
          setExternalId: 'swsh4',
          setName: 'Vivid Voltage',
          imageSmall: 'https://small.png',
        },
      ],
    };
    const detailRepo: CardQueryRepository = {
      findByExternalId: async (id) => (id === 'uniq-1' ? details : null),
      search: async () => [],
    };
    const { interaction, replies } = fakeInteraction({ name: 'unique' });
    await executeCardCommand(interaction, new GetCard(detailRepo), new SearchCards(searchRepo), store);
    const content = replies[0]!.content;
    assert.match(content, /Unique Card/);
    assert.match(content, /Variants/);
    assert.match(content, /HOLOFOIL/);
  });

  it('single-result search still lists when more pages remain', async () => {
    const searchRepo: CardQueryRepository = {
      findByExternalId: async () => null,
      search: async (query) =>
        query.limit === 11
          ? [
              {
                externalId: 'uniq-1',
                name: 'Unique Card',
                number: '1',
                rarity: 'Rare',
                setExternalId: 'swsh4',
                setName: 'Vivid Voltage',
                imageSmall: 'https://s',
              },
              {
                externalId: 'extra-2',
                name: 'Extra',
                number: '2',
                rarity: 'Rare',
                setExternalId: 'swsh4',
                setName: 'Vivid Voltage',
                imageSmall: 'https://s',
              },
            ]
          : [
              {
                externalId: 'uniq-1',
                name: 'Unique Card',
                number: '1',
                rarity: 'Rare',
                setExternalId: 'swsh4',
                setName: 'Vivid Voltage',
                imageSmall: 'https://s',
              },
            ],
    };
    const { interaction, replies } = fakeInteraction({ name: 'unique' });
    await executeCardCommand(interaction, new GetCard(emptyRepo), new SearchCards(searchRepo), store);
    assert.match(replies[0]!.content, /1\. \*\*Unique Card\*\*/);
  });
});
