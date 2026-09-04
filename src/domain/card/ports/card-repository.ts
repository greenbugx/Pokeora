import type { Card, CardChanges } from '../entities/card';

export interface CardRepository {
  findByExternalId(externalId: string): Promise<Card | null>;
  upsert(changes: CardChanges): Promise<Card>;
}
