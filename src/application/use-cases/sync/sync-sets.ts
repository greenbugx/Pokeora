import type { CatalogSource, SourceSet } from './catalog-source';
import type { UnitOfWork } from '../../../domain/shared/ports/unit-of-work';
import type { SetRepository } from '../../../domain/set/ports/set-repository';
import type { SyncReporter } from './sync-reporter';

export interface SyncSetsResult {
  processed: number;
  created: number;
  updated: number;
  failed: number;
  durationMs: number;
}

export interface SyncSetsDependencies {
  unitOfWork: UnitOfWork;
  setRepository: SetRepository;
  source: CatalogSource;
  reporter?: SyncReporter;
}

/**
 * Synchronizes the external set catalog into PostgreSQL, one source page per
 * bounded transaction. Idempotent: runs are keyed on `externalId`, preserve
 * internal ids, and never delete sets missing from a run.
 */
export class SyncSets {
  private readonly unitOfWork: UnitOfWork;
  private readonly setRepository: SetRepository;
  private readonly source: CatalogSource;
  private readonly reporter?: SyncReporter;

  constructor(dependencies: SyncSetsDependencies) {
    this.unitOfWork = dependencies.unitOfWork;
    this.setRepository = dependencies.setRepository;
    this.source = dependencies.source;
    this.reporter = dependencies.reporter;
  }

  async execute(): Promise<SyncSetsResult> {
    const startedAt = Date.now();
    const result: SyncSetsResult = { processed: 0, created: 0, updated: 0, failed: 0, durationMs: 0 };

    for await (const page of this.source.sets()) {
      this.reporter?.pageStarted('sync-sets', page.page, page.pageSize, page.totalCount);
      // One bounded transaction per page: a failure rolls back only this
      // page; pages committed earlier stay committed.
      await this.unitOfWork.transactional(async () => {
        for (const item of page.items) {
          try {
            const existing = await this.setRepository.findByExternalId(item.externalId);
            await this.setRepository.upsert(item);
            result.processed += 1;
            if (existing) result.updated += 1;
            else result.created += 1;
          } catch (error) {
            result.processed += 1;
            result.failed += 1;
            this.reporter?.itemFailed('sync-sets', item.externalId, error);
          }
        }
      });
    }

    result.durationMs = Date.now() - startedAt;
    this.reporter?.completed('sync-sets', { ...result });
    return result;
  }
}
