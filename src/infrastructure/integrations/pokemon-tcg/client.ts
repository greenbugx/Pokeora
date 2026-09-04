import type { ApiCard, ApiListResponse, ApiSet } from './types';
import { parseListResponse } from './mapper';

export class PokemonTcgApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly retryAfterMs?: number,
  ) {
    super(message);
    this.name = 'PokemonTcgApiError';
  }
}

export interface PokemonTcgClientOptions {
  baseUrl: string;
  apiKey?: string;
  timeoutMs?: number;
  maxRetries?: number;
  initialBackoffMs?: number;
  pageSize?: number;
  /** Pause between successful page requests, to stay well under rate limits. */
  pageDelayMs?: number;
  fetchImpl?: typeof fetch;
}

/**
 * HTTP client for the official Pokémon TCG API. Owns transport concerns
 * only: authentication headers, timeouts, pagination, validation, and bounded
 * retry with backoff.
 */
export class PokemonTcgClient {
  private readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly initialBackoffMs: number;
  private readonly pageSize: number;
  private readonly pageDelayMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(options: PokemonTcgClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, '');
    this.apiKey = options.apiKey;
    this.timeoutMs = options.timeoutMs ?? 15_000;
    this.maxRetries = options.maxRetries ?? 5;
    this.initialBackoffMs = options.initialBackoffMs ?? 2_000;
    this.pageSize = options.pageSize ?? 250;
    this.pageDelayMs = options.pageDelayMs ?? 500;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  /** Yields set pages sequentially until the source is exhausted. */
  async *setPages(): AsyncGenerator<ApiListResponse<ApiSet>> {
    yield* this.paginate<ApiSet>('/sets');
  }

  /** Yields card pages sequentially until the source is exhausted. */
  async *cardPages(): AsyncGenerator<ApiListResponse<ApiCard>> {
    yield* this.paginate<ApiCard>('/cards');
  }

  private async *paginate<T>(path: string): AsyncGenerator<ApiListResponse<T>> {
    let page = 1;
    let remaining: number | null = null;
    do {
      if (page > 1) await delay(this.pageDelayMs);
      const body = await this.fetchPage<T>(path, page);
      yield body;
      remaining = remaining === null ? body.totalCount - body.page * body.pageSize : remaining - body.data.length;
      page += 1;
    } while (remaining > 0);
  }

  private async fetchPage<T>(path: string, page: number): Promise<ApiListResponse<T>> {
    const url = new URL(`${this.baseUrl}${path}`);
    url.searchParams.set('page', String(page));
    url.searchParams.set('pageSize', String(this.pageSize));

    let lastError: unknown;
    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      if (attempt > 0) {
        const backoffMs = this.backoffMsFor(lastError, attempt);
        await delay(backoffMs);
      }
      try {
        return await this.fetchOnce<T>(url, path);
      } catch (error) {
        if (!this.isRetryable(error) || attempt === this.maxRetries) throw error;
        lastError = error;
      }
    }
    throw lastError;
  }

  private async fetchOnce<T>(url: URL, path: string): Promise<ApiListResponse<T>> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          ...(this.apiKey ? { 'X-Api-Key': this.apiKey } : {}),
        },
      });
    } catch (error) {
      throw new PokemonTcgApiError(`Network failure requesting ${path}: ${String(error)}`, 0);
    } finally {
      clearTimeout(timeout);
    }

    if (response.status === 429) {
      const retryAfterHeader = response.headers.get('retry-after');
      const retryAfterMs = retryAfterHeader && /^\d+$/.test(retryAfterHeader)
        ? Number(retryAfterHeader) * 1_000
        : undefined;
      throw new PokemonTcgApiError(`Rate limited requesting ${path}`, 429, retryAfterMs);
    }
    if (response.status >= 500) {
      throw new PokemonTcgApiError(`Server error ${response.status} requesting ${path}`, response.status);
    }
    if (!response.ok) {
      throw new PokemonTcgApiError(`HTTP ${response.status} requesting ${path}`, response.status);
    }

    const payload: unknown = await response.json();
    return parseListResponse<T>(payload, path);
  }

  private isRetryable(error: unknown): boolean {
    return (
      error instanceof PokemonTcgApiError &&
      (error.status === 0 || error.status === 429 || error.status >= 500)
    );
  }

  private backoffMsFor(error: unknown, attempt: number): number {
    if (error instanceof PokemonTcgApiError && error.status === 429 && typeof error.retryAfterMs === 'number') {
      return error.retryAfterMs;
    }
    return this.initialBackoffMs * 2 ** (attempt - 1);
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
