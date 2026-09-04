export interface CardVariant {
  id: string;
  cardId: string;
  variantType: string;
  finish: string;
  language: string;
  isCollectible: boolean;
}

/** A variant about to be persisted; the repository assigns `id`. */
export type NewCardVariant = Omit<CardVariant, 'id'>;
