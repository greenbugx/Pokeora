import type { CardVariant, NewCardVariant } from '../entities/card-variant';

/**
 * The logical v1 variant identity used for reconciliation: a variant is
 * "the same" when card, variantType, finish and language all match.
 */
export interface CardVariantIdentity {
  cardId: string;
  variantType: string;
  finish: string;
  language: string;
}

export interface CardVariantRepository {
  findByIdentity(identity: CardVariantIdentity): Promise<CardVariant | null>;
  create(variant: NewCardVariant): Promise<CardVariant>;
}
