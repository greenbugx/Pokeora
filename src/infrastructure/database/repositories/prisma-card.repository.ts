import type { Card, CardChanges } from '../../../domain/card/entities/card';
import type { CardRepository } from '../../../domain/card/ports/card-repository';
import { currentExecutor } from '../prisma/client';

type DatabaseCardRow = {
  id: string;
  externalId: string;
  setId: string;
  name: string;
  number: string;
  rarity: string;
  imageSmall: string;
  imageLarge: string;
};

const CARD_COLUMNS = ['id', 'externalId', 'setId', 'name', 'number', 'rarity', 'imageSmall', 'imageLarge'] as const;

function toDomain(row: DatabaseCardRow): Card {
  return {
    id: row.id,
    externalId: row.externalId,
    setId: row.setId,
    name: row.name,
    number: row.number,
    rarity: row.rarity,
    imageSmall: row.imageSmall,
    imageLarge: row.imageLarge,
  };
}

export class PrismaCardRepository implements CardRepository {
  async findByExternalId(externalId: string): Promise<Card | null> {
    const row = await currentExecutor()
      .orm.public.Card.where((card) => card.externalId.eq(externalId))
      .select(...CARD_COLUMNS)
      .first();
    return row ? toDomain(row) : null;
  }

  async upsert(changes: CardChanges): Promise<Card> {
    const row = await currentExecutor().orm.public.Card.upsert({
      create: {
        externalId: changes.externalId,
        setId: changes.setId,
        name: changes.name,
        number: changes.number,
        rarity: changes.rarity,
        imageSmall: changes.imageSmall,
        imageLarge: changes.imageLarge,
      },
      update: {
        setId: changes.setId,
        name: changes.name,
        number: changes.number,
        rarity: changes.rarity,
        imageSmall: changes.imageSmall,
        imageLarge: changes.imageLarge,
      },
      conflictOn: { externalId: changes.externalId },
    });
    return toDomain(row);
  }
}
