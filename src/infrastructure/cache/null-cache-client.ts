import type { CacheClient } from './cache-client';

/** No-op cache for deployments without REDIS_URL: every read is a miss. */
export class NullCacheClient implements CacheClient {
  async connect(): Promise<void> {
    /* nothing to connect */
  }

  async get(): Promise<string | null> {
    return null;
  }

  async set(): Promise<void> {
    /* nothing to store */
  }

  async close(): Promise<void> {
    /* nothing to close */
  }
}
