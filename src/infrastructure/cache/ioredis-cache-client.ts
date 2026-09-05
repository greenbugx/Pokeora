import Redis from 'ioredis';
import type { Logger } from '../logging/logger';
import type { CacheClient } from './cache-client';

/**
 * Redis-backed cache client. Fails fast when Redis is unavailable (no offline
 * queue): callers catch and fall back to PostgreSQL without user-facing
 * impact. Connection errors are logged at most once per 30s to avoid spam
 * during an outage.
 */
export class IoredisCacheClient implements CacheClient {
  private readonly client: Redis;
  private lastErrorLoggedAt = 0;

  constructor(url: string, logger: Logger) {
    this.client = new Redis(url, {
      lazyConnect: true,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
      connectTimeout: 2_000,
      retryStrategy: (times) => Math.min(times * 1_000, 5_000),
    });
    this.client.on('error', (error: Error) => {
      const now = Date.now();
      if (now - this.lastErrorLoggedAt >= 30_000) {
        this.lastErrorLoggedAt = now;
        logger.error('cache.redis_error', { error: error.message });
      }
    });
  }

  /** Never rejects: an unreachable Redis simply leaves the client disconnected. */
  async connect(): Promise<void> {
    try {
      await this.client.connect();
    } catch {
      /* callers fall back to PostgreSQL until Redis comes back */
    }
  }

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    await this.client.set(key, value, 'EX', ttlSeconds);
  }

  async close(): Promise<void> {
    try {
      await this.client.quit();
    } catch {
      this.client.disconnect();
    }
  }
}
