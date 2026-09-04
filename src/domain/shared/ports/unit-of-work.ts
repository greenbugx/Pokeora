/**
 * Guarantees that the work handed to `transactional` is committed atomically:
 * either every write performed inside the callback persists, or none do.
 * Implementations live in Infrastructure; callers must not assume how
 * atomicity is achieved.
 */
export interface UnitOfWork {
  transactional<T>(work: () => Promise<T>): Promise<T>;
}
