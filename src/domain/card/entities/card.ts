export interface Card {
  id: string;
  externalId: string;
  setId: string;
  name: string;
  number: string;
  rarity: string;
  imageSmall: string;
  imageLarge: string;
}

/** Source-derived mutable fields, used when an existing Card is updated. */
export type CardChanges = Omit<Card, 'id'>;
