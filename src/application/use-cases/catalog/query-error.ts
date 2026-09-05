import { CatalogUnavailableError } from './catalog-errors';

/**
 * Wraps unexpected repository failures as CatalogUnavailableError while
 * letting application-level errors (not found, invalid query) pass through.
 */
export function translateRepositoryError(error: unknown): Error {
  if (error instanceof Error && error.name.endsWith('NotFoundError')) return error;
  if (error instanceof Error && error.name.endsWith('QueryError')) return error;
  return new CatalogUnavailableError(error);
}
