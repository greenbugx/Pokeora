import type { Logger } from '../../../infrastructure/logging/logger';

/**
 * Progress reporting for synchronization runs. Defined at the application
 * boundary so use cases stay testable without inspecting logs.
 */
export interface SyncReporter {
  pageStarted(operation: string, page: number, pageSize: number, totalCount: number): void;
  itemFailed(operation: string, externalId: string, error: unknown): void;
  completed(operation: string, summary: Record<string, unknown>): void;
}

export function createLoggerSyncReporter(logger: Logger): SyncReporter {
  return {
    pageStarted: (operation, page, pageSize, totalCount) =>
      logger.info('sync.page_started', { operation, page, pageSize, totalCount }),
    itemFailed: (operation, externalId, error) =>
      logger.error('sync.item_failed', {
        operation,
        externalId,
        error: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
      }),
    completed: (operation, summary) => logger.info('sync.completed', { operation, ...summary }),
  };
}
