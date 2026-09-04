import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { PokemonTcgApiError, PokemonTcgClient } from '../src/infrastructure/integrations/pokemon-tcg/client';

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
    ...init,
  });
}

function pageBody<T>(items: T[], page: number, pageSize: number, totalCount: number) {
  return { data: items, page, pageSize, count: items.length, totalCount };
}

const setItem = (id: string) => ({
  id,
  name: `Set ${id}`,
  series: 'Sword & Shield',
  releaseDate: '2020-08-14',
  printedTotal: 1,
  total: 2,
});

describe('PokemonTcgClient pagination', () => {
  it('fetches every page once, in order, until the source is exhausted', async () => {
    const requestedUrls: string[] = [];
    const client = new PokemonTcgClient({
      baseUrl: 'https://api.test/v2',
      pageSize: 2,
      fetchImpl: async (input) => {
        const url = new URL(String(input));
        requestedUrls.push(url.searchParams.get('page')!);
        const page = Number(url.searchParams.get('page'));
        const items = page <= 2 ? [setItem(`s${page}a`), setItem(`s${page}b`)] : [setItem('s3a')];
        return jsonResponse(pageBody(items, page, 2, 5));
      },
    });

    const pages = [];
    for await (const page of client.setPages()) pages.push(page);

    assert.deepEqual(requestedUrls, ['1', '2', '3']);
    assert.equal(pages.length, 3);
    assert.deepEqual(
      pages.flatMap((page) => page.data.map((item) => item.id)),
      ['s1a', 's1b', 's2a', 's2b', 's3a'],
    );
  });

  it('does not request a second page when everything fits on page one', async () => {
    let calls = 0;
    const client = new PokemonTcgClient({
      baseUrl: 'https://api.test/v2',
      pageSize: 250,
      fetchImpl: async () => {
        calls += 1;
        return jsonResponse(pageBody([setItem('only')], 1, 250, 1));
      },
    });
    const pages = [];
    for await (const page of client.setPages()) pages.push(page);
    assert.equal(calls, 1);
    assert.equal(pages.length, 1);
  });
});

describe('PokemonTcgClient retry', () => {
  it('retries transient failures and succeeds within the bound', async () => {
    let attempts = 0;
    const client = new PokemonTcgClient({
      baseUrl: 'https://api.test/v2',
      pageSize: 250,
      maxRetries: 3,
      initialBackoffMs: 1,
      fetchImpl: async () => {
        attempts += 1;
        if (attempts < 3) return new Response('boom', { status: 503 });
        return jsonResponse(pageBody([setItem('ok')], 1, 250, 1));
      },
    });

    const pages = [];
    for await (const page of client.setPages()) pages.push(page);
    assert.equal(attempts, 3);
    assert.equal(pages[0]?.data[0]?.id, 'ok');
  });

  it('stops retrying at the configured maximum', async () => {
    let attempts = 0;
    const client = new PokemonTcgClient({
      baseUrl: 'https://api.test/v2',
      maxRetries: 2,
      initialBackoffMs: 1,
      fetchImpl: async () => {
        attempts += 1;
        return new Response('down', { status: 500 });
      },
    });

    await assert.rejects(
      async () => {
        for await (const _ of client.setPages()) void _;
      },
      (error: unknown) => error instanceof PokemonTcgApiError && error.status === 500,
    );
    assert.equal(attempts, 3, 'initial attempt + maxRetries retries');
  });

  it('does not retry permanent client errors', async () => {
    let attempts = 0;
    const client = new PokemonTcgClient({
      baseUrl: 'https://api.test/v2',
      maxRetries: 5,
      fetchImpl: async () => {
        attempts += 1;
        return new Response('nope', { status: 404 });
      },
    });

    await assert.rejects(
      async () => {
        for await (const _ of client.setPages()) void _;
      },
      (error: unknown) => error instanceof PokemonTcgApiError && error.status === 404,
    );
    assert.equal(attempts, 1);
  });

  it('honors Retry-After on 429 responses', async () => {
    let attempts = 0;
    const client = new PokemonTcgClient({
      baseUrl: 'https://api.test/v2',
      maxRetries: 2,
      initialBackoffMs: 5_000,
      fetchImpl: async () => {
        attempts += 1;
        if (attempts === 1) {
          return new Response('slow down', {
            status: 429,
            headers: { 'retry-after': '0' },
          });
        }
        return jsonResponse(pageBody([setItem('ok')], 1, 250, 1));
      },
    });

    const startedAt = Date.now();
    const pages = [];
    for await (const page of client.setPages()) pages.push(page);
    assert.equal(attempts, 2);
    assert.ok(Date.now() - startedAt < 4_000, 'used Retry-After (0s), not the exponential default');
    assert.equal(pages[0]?.data[0]?.id, 'ok');
  });
});
