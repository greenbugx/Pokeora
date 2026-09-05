import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { GetCard, SearchCards } from '../src/application/use-cases/catalog/card-queries';
import { GetSet, SearchSets } from '../src/application/use-cases/catalog/set-queries';
import { PrismaCardQueryRepository } from '../src/infrastructure/database/repositories/prisma-card-query.repository';
import { PrismaSetQueryRepository } from '../src/infrastructure/database/repositories/prisma-set-query.repository';
import { CardNotFoundError } from '../src/application/use-cases/catalog/catalog-errors';
import { db } from '../src/prisma/db';

// Runs against the project's real PostgreSQL catalog (DATABASE_URL) using the
// live synchronized Pokémon TCG data. Strictly read-only.
const hasDatabase = Boolean(process.env['DATABASE_URL']);

const cardRepo = new PrismaCardQueryRepository();
const setRepo = new PrismaSetQueryRepository();
const getCard = new GetCard(cardRepo);
const searchCards = new SearchCards(cardRepo);
const getSet = new GetSet(setRepo);
const searchSets = new SearchSets(setRepo);

async function catalogCounts() {
  const [sets, cards, variants] = await Promise.all([
    db.orm.public.Set.select('id').all().then((rows) => rows.length),
    db.orm.public.Card.select('id').all().then((rows) => rows.length),
    db.orm.public.CardVariant.select('id').all().then((rows) => rows.length),
  ]);
  return { sets, cards, variants };
}

describe('catalog query integration (PostgreSQL)', { skip: hasDatabase ? false : 'DATABASE_URL not set' }, () => {
  let countsBefore: Awaited<ReturnType<typeof catalogCounts>>;

  before(async () => {
    countsBefore = await catalogCounts();
  });

  after(async () => {
    const countsAfter = await catalogCounts();
    assert.deepEqual(
      countsAfter,
      countsBefore,
      'catalog queries must not mutate Set/Card/CardVariant rows',
    );
    await db.close();
  });

  it('exact card lookup returns the card with set and variants', async () => {
    const card = await getCard.execute('swsh4-25');
    assert.equal(card.name, 'Charizard');
    assert.equal(card.number, '25');
    assert.equal(card.set.externalId, 'swsh4');
    assert.equal(card.set.name, 'Vivid Voltage');
    assert.ok(card.variants.length >= 1, 'variants loaded with the detail');
    assert.ok(card.variants.every((v) => v.language === 'EN'));
  });

  it('card search is case-insensitive and partial', async () => {
    for (const casing of ['gengar', 'GENGAR', 'Gengar', 'gEnGaR']) {
      const result = await searchCards.execute({ name: casing, page: 1 });
      assert.ok(result.items.length > 0, `matches for ${casing}`);
      assert.ok(result.items.every((item) => item.name.toLowerCase().includes('gengar')));
    }
    const partial = await searchCards.execute({ name: 'char', setExternalId: 'swsh4' });
    assert.ok(partial.items.length > 0);
    assert.ok(
      partial.items.every((item) => item.name.toLowerCase().includes('char')),
      'partial match works within a bounded set',
    );
  });

  it('search ordering is deterministic across identical queries', async () => {
    const first = await searchCards.execute({ name: 'pikachu' });
    const second = await searchCards.execute({ name: 'pikachu' });
    assert.deepEqual(
      first.items.map((item) => item.externalId),
      second.items.map((item) => item.externalId),
    );
  });

  it('set filter narrows results by set external id', async () => {
    const unfiltered = await searchCards.execute({ name: 'charizard' });
    assert.ok(unfiltered.items.length > 1, 'charizard exists in multiple sets');
    const filtered = await searchCards.execute({ name: 'charizard', setExternalId: 'swsh4' });
    assert.ok(filtered.items.length > 0);
    assert.ok(filtered.items.every((item) => item.setExternalId === 'swsh4'));
  });

  it('number and rarity filters work as string comparisons', async () => {
    const byNumber = await searchCards.execute({ setExternalId: 'swsh4', number: '25' });
    assert.ok(byNumber.items.some((item) => item.externalId === 'swsh4-25'));

    const rare = await searchCards.execute({ rarity: 'Illustration Rare', setExternalId: 'swsh4' });
    assert.ok(rare.items.every((item) => item.rarity.toLowerCase() === 'illustration rare'));
  });

  it('paginates without duplicates or skipped records', async () => {
    const seen: string[] = [];
    let page = 1;
    for (;;) {
      const result = await searchCards.execute({ name: 'pikachu', page });
      seen.push(...result.items.map((item) => item.externalId));
      if (!result.hasMore || page > 10) break;
      page += 1;
    }
    assert.ok(seen.length > 10, 'enough results to cross pages');
    assert.equal(new Set(seen).size, seen.length, 'no duplicated cards across pages');
  });

  it('treats special characters as literal input, not wildcards', async () => {
    // '%' and '_' would otherwise widen the match; escaped, they match nothing.
    const result = await searchCards.execute({ name: "char'izard%_" });
    assert.equal(result.items.length, 0);
    const backslash = await searchCards.execute({ name: 'char\\izard' });
    assert.equal(backslash.items.length, 0);
  });

  it('unknown ids and unknown set filters are clean not-found/empty results', async () => {
    await assert.rejects(getCard.execute('unknown-card-id'), CardNotFoundError);
    const unknownSet = await searchCards.execute({ setExternalId: 'zz-nope' });
    assert.equal(unknownSet.items.length, 0);
  });

  it('exact set lookup returns full details', async () => {
    const set = await getSet.execute('swsh4');
    assert.equal(set.name, 'Vivid Voltage');
    assert.equal(set.series, 'Sword & Shield');
    assert.equal(set.totalCards, 203);
    assert.equal(set.releaseDate, '2020-11-13');
  });

  it('set search matches names and series case-insensitively', async () => {
    const byName = await searchSets.execute({ name: 'prismatic' });
    assert.ok(byName.items.some((item) => item.name.includes('Prismatic')));

    const bySeries = await searchSets.execute({ series: 'Scarlet & Violet' });
    assert.ok(bySeries.items.length > 0);
    assert.ok(bySeries.items.every((item) => item.series === 'Scarlet & Violet'));

    const seriesOrder = await searchSets.execute({ series: 'Scarlet & Violet' });
    assert.deepEqual(
      bySeries.items.map((item) => item.externalId),
      seriesOrder.items.map((item) => item.externalId),
      'set search ordering is deterministic',
    );
  });

  it('search results do not carry variants (detail-only)', async () => {
    const repo = cardRepo as unknown as {
      search(query: { name?: string; limit: number; offset: number }): Promise<unknown[]>;
    };
    // Search records structurally have no variants field.
    const rows = await repo.search({ name: 'gengar', limit: 5, offset: 0 });
    assert.ok(rows.length > 0);
    for (const row of rows) {
      assert.equal('variants' in (row as object), false, 'search rows must not include variants');
    }
  });
});
