/** Bounded result sizes for catalog queries. */
export const DEFAULT_PAGE_SIZE = 10;
export const MAX_PAGE_SIZE = 25;

/**
 * Converts a 1-based Discord page number into the application's offset/limit
 * pair, clamping the page and limit to the configured bounds.
 */
export function pageToOffset(page: number, requestedLimit = DEFAULT_PAGE_SIZE): { offset: number; limit: number } {
  const safePage = Number.isInteger(page) && page >= 1 ? page : 1;
  const safeLimit = Math.min(Math.max(Math.trunc(requestedLimit) || DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE);
  return { offset: (safePage - 1) * safeLimit, limit: safeLimit };
}
