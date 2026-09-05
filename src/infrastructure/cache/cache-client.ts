/**
 * Minimal cache surface for catalog lookups and pagination contexts.
 * Implementations may be unavailable at any time — callers must treat every
 * operation as best-effort and fall back to PostgreSQL.
 */
export interface CacheClient {
  /** Establishes the connection; must never reject on unreachable servers. */
  connect(): Promise<void>;
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
  close(): Promise<void>;
}
