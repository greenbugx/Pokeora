import { AsyncLocalStorage } from 'node:async_hooks';
import { db } from '../../../prisma/db';

export { db };

/**
 * The query surface repositories need. Both the root client and a
 * `db.transaction` callback expose an identically-typed `orm`, so repository
 * code is agnostic about which one it is running on.
 */
type TransactionExecutor = Parameters<Parameters<typeof db.transaction>[0]>[0];
export type DatabaseExecutor = Pick<typeof db, 'orm' | 'runtime'> | TransactionExecutor;

const activeTransaction = new AsyncLocalStorage<TransactionExecutor>();

/**
 * The executor queries should run on: the ambient transaction when called
 * inside `transactional(...)`, the root client otherwise.
 */
export function currentExecutor(): DatabaseExecutor {
  return activeTransaction.getStore() ?? db;
}

/**
 * Executes a SQL-builder or raw-lane plan on the ambient executor. The root
 * client runs plans through `db.runtime()`; a transaction context carries its
 * own `execute`. Both stay inside the ambient transaction.
 */
export async function executeRawPlan<T = unknown>(executor: DatabaseExecutor, plan: unknown): Promise<T> {
  if ('runtime' in executor) {
    return (await (executor as typeof db).runtime().execute(plan as never)) as T;
  }
  return (await (executor as { execute(plan: unknown): Promise<unknown> }).execute(plan)) as T;
}

/** Detects a PostgreSQL foreign-key violation (SQLSTATE 23503). */
export function isForeignKeyViolation(error: unknown, columnSuffix?: string): boolean {
  let current: unknown = error;
  for (let depth = 0; current && depth < 3; depth += 1) {
    const candidate = current as { kind?: unknown; sqlState?: unknown; constraint?: unknown; code?: unknown; cause?: unknown };
    if (
      candidate.kind === 'sql_query' &&
      candidate.sqlState === '23503' &&
      (columnSuffix === undefined ||
        (typeof candidate.constraint === 'string' && candidate.constraint.endsWith(columnSuffix)))
    ) {
      return true;
    }
    current = candidate.cause;
  }
  return false;
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
