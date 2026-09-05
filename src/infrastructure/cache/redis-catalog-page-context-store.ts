import { randomBytes } from 'node:crypto';
import type {
  CatalogPageContext,
  CatalogPageContextStore,
  NewCatalogPageContext,
} from '../../application/use-cases/catalog/pagination-context-store';
import type { CacheClient } from './cache-client';

export const PAGINATION_CONTEXT_TTL_SECONDS = 600;
const PAGE_KEY_PREFIX = 'pokeora:page:';

/** Redis-backed pagination contexts with a bounded TTL. */
export class RedisCatalogPageContextStore implements CatalogPageContextStore {
  constructor(
    private readonly cache: CacheClient,
    private readonly ttlSeconds = PAGINATION_CONTEXT_TTL_SECONDS,
  ) {}

  async save(context: NewCatalogPageContext): Promise<string | null> {
    const id = randomBytes(5).toString('hex');
    try {
      await this.cache.set(PAGE_KEY_PREFIX + id, JSON.stringify({ ...context, id }), this.ttlSeconds);
      return id;
    } catch {
      return null; // Redis unavailable — command proceeds without buttons
    }
  }

  async load(id: string): Promise<CatalogPageContext | null> {
    if (!/^[a-f0-9]{1,32}$/.test(id)) return null;
    try {
      const raw = await this.cache.get(PAGE_KEY_PREFIX + id);
      if (!raw) return null; // expired or evicted
      const parsed: unknown = JSON.parse(raw);
      return isContext(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
}

/** Store used when Redis is not configured: pagination falls back to the page option. */
export class NullCatalogPageContextStore implements CatalogPageContextStore {
  async save(): Promise<string | null> {
    return null;
  }

  async load(): Promise<CatalogPageContext | null> {
    return null;
  }
}

function isContext(value: unknown): value is CatalogPageContext {
  if (typeof value !== 'object' || value === null) return false;
  const context = value as Record<string, unknown>;
  if (typeof context['id'] !== 'string' || typeof context['userId'] !== 'string') return false;
  if (context['kind'] !== 'card' && context['kind'] !== 'set') return false;
  return typeof context['query'] === 'object' && context['query'] !== null;
}
