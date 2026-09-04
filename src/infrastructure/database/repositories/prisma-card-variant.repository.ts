import type { CardVariant, NewCardVariant } from '../../../domain/card/entities/card-variant';
import type { CardVariantIdentity, CardVariantRepository } from '../../../domain/card/ports/card-variant-repository';
import { currentExecutor } from '../prisma/client';

const VARIANT_COLUMNS = ['id', 'cardId', 'variantType', 'finish', 'language', 'isCollectible'] as const;

export class PrismaCardVariantRepository implements CardVariantRepository {
  async findByIdentity(identity: CardVariantIdentity): Promise<CardVariant | null> {
    const row = await currentExecutor()
      .orm.public.CardVariant.where((variant) => variant.cardId.eq(identity.cardId))
      .where((variant) => variant.variantType.eq(identity.variantType))
      .where((variant) => variant.finish.eq(identity.finish))
      .where((variant) => variant.language.eq(identity.language))
      .select(...VARIANT_COLUMNS)
      .first();
    return row ?? null;
  }

  async create(variant: NewCardVariant): Promise<CardVariant> {
    const row = await currentExecutor()
      .orm.public.CardVariant.select(...VARIANT_COLUMNS)
      .create({
        cardId: variant.cardId,
        variantType: variant.variantType,
        finish: variant.finish,
        language: variant.language,
        isCollectible: variant.isCollectible,
      });
    return { ...variant, id: row.id };
  }
}
