import { SyncSets } from '../../../application/use-cases/sync/sync-sets';
import { SyncCards } from '../../../application/use-cases/sync/sync-cards';
import { createLoggerSyncReporter } from '../../../application/use-cases/sync/sync-reporter';
import type { CatalogSource } from '../../../application/use-cases/sync/catalog-source';
import type { VariantEvidencePolicy } from '../../../application/use-cases/sync/sync-cards';
import type { UnitOfWork } from '../../../domain/shared/ports/unit-of-work';
import type { CardRepository } from '../../../domain/card/ports/card-repository';
import type { CardVariantRepository } from '../../../domain/card/ports/card-variant-repository';
import type { SetRepository } from '../../../domain/set/ports/set-repository';
import type { Logger } from '../../logging/logger';
import { db } from '../../database/prisma/client';

export interface CardSyncWorkerDependencies {
  unitOfWork: UnitOfWork;
  setRepository: SetRepository;
  cardRepository: CardRepository;
  cardVariantRepository: CardVariantRepository;
  source: CatalogSource;
  variantPolicy: VariantEvidencePolicy;
  sourceLanguage: string;
  logger: Logger;
}

/**
 * Runs the full catalog synchronization: sets first, then cards + variant
 * reconciliation. Bounded transactions per page; previously committed pages
 * survive later failures; safe to re-run.
 */
export class CardSyncWorker {
  private readonly dependencies: CardSyncWorkerDependencies;

  constructor(dependencies: CardSyncWorkerDependencies) {
    this.dependencies = dependencies;
  }

  async run(): Promise<{ sets: object; cards: object }> {
    const { unitOfWork, setRepository, cardRepository, cardVariantRepository, source, variantPolicy, sourceLanguage, logger } =
      this.dependencies;
    const reporter = createLoggerSyncReporter(logger);

    logger.info('sync.started', { operation: 'card-sync' });
    const setsResult = await new SyncSets({ unitOfWork, setRepository, source, reporter }).execute();
    const cardsResult = await new SyncCards(
      {
        unitOfWork,
        setRepository,
        cardRepository,
        cardVariantRepository,
        source,
        variantPolicy,
        reporter,
      },
      sourceLanguage,
    ).execute();
    logger.info('sync.finished', { operation: 'card-sync', sets: setsResult, cards: cardsResult });

    return { sets: setsResult, cards: cardsResult };
  }
}

/** Closes the shared database pool (for one-shot script runs). */
export async function closeDatabase(): Promise<void> {
  await db.close();
}
