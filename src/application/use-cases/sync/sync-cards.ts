import type { CatalogSource, SourceCard } from './catalog-source';
import type { UnitOfWork } from '../../../domain/shared/ports/unit-of-work';
import type { CardVariantIdentity } from '../../../domain/card/ports/card-variant-repository';
import type { CardRepository } from '../../../domain/card/ports/card-repository';
import type { CardVariantRepository } from '../../../domain/card/ports/card-variant-repository';
import type { SetRepository } from '../../../domain/set/ports/set-repository';
import type { SyncReporter } from './sync-reporter';

export interface SyncCardsResult {
  processed: number;
  created: number;
  updated: number;
  variantsCreated: number;
  variantsReused: number;
  failed: number;
  unknownSets: number;
  durationMs: number;
}

export interface SyncCardsDependencies {
  unitOfWork: UnitOfWork;
  setRepository: SetRepository;
  cardRepository: CardRepository;
  cardVariantRepository: CardVariantRepository;
  source: CatalogSource;
  /** Normalizes TCGPlayer pricing keys into internal variant identities. */
  variantPolicy: VariantEvidencePolicy;
  reporter?: SyncReporter;
}

/**
 * Derives the internal variant identity for one source evidence key, or null
 * when the key is not recognized evidence. Isolated as a policy so the
 * evidence rules can evolve without touching the use case.
 */
export interface VariantEvidencePolicy {
  toVariantIdentity(
    evidenceKey: string,
  ): { variantType: string; finish: string } | null;
}

/**
 * Synchronizes the external card catalog into PostgreSQL. Cards are upserted
 * keyed on `externalId`; source-backed variants are reconciled on the logical
 * identity (cardId, variantType, finish, language). One page per bounded
 * transaction. Cards referencing unknown sets are skipped and counted — the
 * database stays referentially valid.
 */
export class SyncCards {
  private readonly unitOfWork: UnitOfWork;
  private readonly setRepository: SetRepository;
  private readonly cardRepository: CardRepository;
  private readonly cardVariantRepository: CardVariantRepository;
  private readonly source: CatalogSource;
  private readonly variantPolicy: VariantEvidencePolicy;
  private readonly reporter?: SyncReporter;
  private readonly language: string;

  constructor(dependencies: SyncCardsDependencies, language = 'EN') {
    this.unitOfWork = dependencies.unitOfWork;
    this.setRepository = dependencies.setRepository;
    this.cardRepository = dependencies.cardRepository;
    this.cardVariantRepository = dependencies.cardVariantRepository;
    this.source = dependencies.source;
    this.variantPolicy = dependencies.variantPolicy;
    this.reporter = dependencies.reporter;
    this.language = language;
  }

  async execute(): Promise<SyncCardsResult> {
    const startedAt = Date.now();
    const result: SyncCardsResult = {
      processed: 0,
      created: 0,
      updated: 0,
      variantsCreated: 0,
      variantsReused: 0,
      failed: 0,
      unknownSets: 0,
      durationMs: 0,
    };

    const setLookup = await this.setRepository.loadExternalIdMap();

    for await (const page of this.source.cards()) {
      this.reporter?.pageStarted('sync-cards', page.page, page.pageSize, page.totalCount);
      await this.unitOfWork.transactional(async () => {
        for (const card of page.items) {
          await this.syncCard(card, setLookup, result);
        }
      });
    }

    result.durationMs = Date.now() - startedAt;
    this.reporter?.completed('sync-cards', { ...result });
    return result;
  }

  private async syncCard(
    card: SourceCard,
    setLookup: Map<string, string>,
    result: SyncCardsResult,
  ): Promise<void> {
    result.processed += 1;
    const setId = setLookup.get(card.setExternalId);
    if (!setId) {
      result.unknownSets += 1;
      result.failed += 1;
      this.reporter?.itemFailed('sync-cards', card.externalId, new UnknownSetError(card.setExternalId));
      return;
    }

    try {
      const existing = await this.cardRepository.findByExternalId(card.externalId);
      const saved = await this.cardRepository.upsert({
        externalId: card.externalId,
        setId,
        name: card.name,
        number: card.number,
        rarity: card.rarity,
        imageSmall: card.imageSmall,
        imageLarge: card.imageLarge,
      });
      if (existing) result.updated += 1;
      else result.created += 1;
      await this.reconcileVariants(saved.id, card, result);
    } catch (error) {
      result.failed += 1;
      this.reporter?.itemFailed('sync-cards', card.externalId, error);
    }
  }

  private async reconcileVariants(
    cardId: string,
    card: SourceCard,
    result: SyncCardsResult,
  ): Promise<void> {
    for (const evidenceKey of card.variantEvidenceKeys) {
      const identity = this.variantPolicy.toVariantIdentity(evidenceKey);
      if (!identity) continue;
      const existing = await this.cardVariantRepository.findByIdentity({
        cardId,
        language: this.language,
        ...identity,
      } satisfies CardVariantIdentity);
      if (existing) {
        result.variantsReused += 1;
      } else {
        result.variantsCreated += 1;
        await this.cardVariantRepository.create({
          cardId,
          variantType: identity.variantType,
          finish: identity.finish,
          language: this.language,
          isCollectible: true,
        });
      }
    }
  }
}

export class UnknownSetError extends Error {
  readonly setExternalId: string;

  constructor(setExternalId: string) {
    super(`Card references unknown set: ${setExternalId}`);
    this.name = 'UnknownSetError';
    this.setExternalId = setExternalId;
  }
}
