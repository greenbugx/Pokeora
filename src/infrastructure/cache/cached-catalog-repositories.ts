import { Temporal } from '@js-temporal/polyfill';
import type {
  CardDetailsRecord,
  CardQueryRepository,
  CardSearchQuery,
  CardSearchRecord,
} from '../../domain/card/ports/card-query-repository';
import type {
  SetDetailsRecord,
  SetQueryRepository,
  SetSearchQuery,
  SetSearchRecord,
} from '../../domain/set/ports/set-query-repository';
import type { CacheClient } from './cache-client';

/**
 * Caching decorators for exact catalog lookups (60–66). Only high-value
 * single-record reads are cached; search always hits PostgreSQL. TTLs are
 * bounded because synchronization may update names/images at any time.
 * Every cache failure degrades to the inner (authoritative) repository.
 */
export const CATALOG_CACHE_TTL_SECONDS = 300;
const CARD_KEY_PREFIX = 'pokeora:card:id:';
const SET_KEY_PREFIX = 'pokeora:set:id:';

export class CachedCardQueryRepository implements CardQueryRepository {
  constructor(
    private readonly inner: CardQueryRepository,
    private readonly cache: CacheClient,
  ) {}

  async findByExternalId(externalId: string): Promise<CardDetailsRecord | null> {
    const key = `${CARD_KEY_PREFIX}${externalId}`;
    const hit = await this.readCache(key, isCardRecord);
    if (hit) return hit;
    const record = await this.inner.findByExternalId(externalId);
    if (record) {
      try {
        await this.cache.set(key, JSON.stringify(record), CATALOG_CACHE_TTL_SECONDS);
      } catch {
        /* cache unavailable — read still succeeded */
      }
    }
    return record;
  }

  search(query: CardSearchQuery): Promise<CardSearchRecord[]> {
    return this.inner.search(query);
  }

  private async readCache<T>(key: string, validate: (value: unknown) => value is T): Promise<T | null> {
    try {
      const raw = await this.cache.get(key);
      if (!raw) return null;
      const parsed: unknown = JSON.parse(raw);
      return validate(parsed) ? parsed : null;
    } catch {
      return null; // corrupt or unavailable cache = miss
    }
  }
}

/** Serialized set record: the calendar date travels as its ISO string. */
type CachedSetRecord = Omit<SetDetailsRecord, 'releaseDate'> & { releaseDate: string };

export class CachedSetQueryRepository implements SetQueryRepository {
  constructor(
    private readonly inner: SetQueryRepository,
    private readonly cache: CacheClient,
  ) {}

  async findByExternalId(externalId: string): Promise<SetDetailsRecord | null> {
    const key = `${SET_KEY_PREFIX}${externalId}`;
    const hit = await this.readCache(key, isCachedSetRecord);
    if (hit) {
      try {
        return { ...hit, releaseDate: Temporal.PlainDate.from(hit.releaseDate) };
      } catch {
        /* unrevivable cache entry = miss */
      }
    }
    const record = await this.inner.findByExternalId(externalId);
    if (record) {
      try {
        const cached: CachedSetRecord = { ...record, releaseDate: record.releaseDate.toString() };
        await this.cache.set(key, JSON.stringify(cached), CATALOG_CACHE_TTL_SECONDS);
      } catch {
        /* cache unavailable — read still succeeded */
      }
    }
    return record;
  }

  search(query: SetSearchQuery): Promise<SetSearchRecord[]> {
    return this.inner.search(query);
  }

  private async readCache(key: string, validate: (value: unknown) => value is CachedSetRecord): Promise<CachedSetRecord | null> {
    try {
      const raw = await this.cache.get(key);
      if (!raw) return null;
      const parsed: unknown = JSON.parse(raw);
      return validate(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
}

function isCardRecord(value: unknown): value is CardDetailsRecord {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record['externalId'] === 'string' &&
    typeof record['name'] === 'string' &&
    typeof record['number'] === 'string' &&
    typeof record['rarity'] === 'string' &&
    typeof record['setExternalId'] === 'string' &&
    typeof record['setName'] === 'string' &&
    typeof record['setSeries'] === 'string' &&
    typeof record['imageSmall'] === 'string' &&
    typeof record['imageLarge'] === 'string' &&
    Array.isArray(record['variants'])
  );
}

function isCachedSetRecord(value: unknown): value is CachedSetRecord {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record['externalId'] === 'string' &&
    typeof record['name'] === 'string' &&
    typeof record['series'] === 'string' &&
    typeof record['releaseDate'] === 'string' &&
    typeof record['totalCards'] === 'number' &&
    typeof record['logoUrl'] === 'string' &&
    typeof record['symbolUrl'] === 'string'
  );
}
