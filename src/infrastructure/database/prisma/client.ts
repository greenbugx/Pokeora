import { AsyncLocalStorage } from 'node:async_hooks';
import { db } from '../../../prisma/db';

export { db };

/**
 * The query surface repositories need. Both the root client and a
 * `db.transaction` callback expose an identically-typed `orm`, so repository
 * code is agnostic about which one it is running on.
 */
export type DatabaseExecutor = Pick<typeof db, 'orm'>;

type TransactionExecutor = Parameters<Parameters<typeof db.transaction>[0]>[0];

const activeTransaction = new AsyncLocalStorage<TransactionExecutor>();

/**
 * The executor queries should run on: the ambient transaction when called
 * inside `transactional(...)`, the root client otherwise.
 */
export function currentExecutor(): DatabaseExecutor {
  return activeTransaction.getStore() ?? db;
}

/**
 * Runs `work` inside a database transaction, committing on success and
 * rolling back on any thrown error. Nested calls join the enclosing
 * transaction instead of opening another one.
 */
export async function transactional<T>(work: () => Promise<T>): Promise<T> {
  if (activeTransaction.getStore()) {
    return work();
  }
  return db.transaction((tx) => activeTransaction.run(tx, work));
}

/**
 * Detects a PostgreSQL unique-constraint violation (SQLSTATE 23505) without
 * importing framework-internal error classes.
 */
export function isUniqueViolation(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; current && depth < 3; depth += 1) {
    const candidate = current as { kind?: unknown; sqlState?: unknown; code?: unknown; cause?: unknown };
    if (candidate.kind === 'sql_query' && candidate.sqlState === '23505') return true;
    if (candidate.sqlState === '23505' || candidate.code === '23505') return true;
    current = candidate.cause;
  }
  return false;
}
