import type {
  CardDetailsRecord,
  CardQueryRepository,
  CardSearchQuery,
  CardSearchRecord,
} from '../../../domain/card/ports/card-query-repository';
import { currentExecutor } from '../prisma/client';

/** Escapes LIKE wildcards so user input matches literally. */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`);
}

export class PrismaCardQueryRepository implements CardQueryRepository {
  async findByExternalId(externalId: string): Promise<CardDetailsRecord | null> {
    // One query: card + set + variants through includes (no N+1).
    const row = await currentExecutor()
      .orm.public.Card.where((card) => card.externalId.eq(externalId))
      .select('externalId', 'name', 'number', 'rarity', 'imageSmall', 'imageLarge')
      .include('set', (set) => set.select('externalId', 'name', 'series'))
      .include('variants', (variant) =>
        variant
          .select('variantType', 'finish', 'language', 'isCollectible')
          .orderBy((v) => v.variantType.asc()),
      )
      .first();
    if (!row) return null;

    return {
      externalId: row.externalId,
      name: row.name,
      number: row.number,
      rarity: row.rarity,
      setExternalId: row.set.externalId,
      setName: row.set.name,
      setSeries: row.set.series,
      imageSmall: row.imageSmall,
      imageLarge: row.imageLarge,
      variants: row.variants,
    };
  }

  async search(query: CardSearchQuery): Promise<CardSearchRecord[]> {
    // The set filter is by public external ID: resolve it to the internal
    // UUID once (indexed unique lookup) instead of per-card joins.
    let setId: string | null = null;
    if (query.setExternalId !== undefined) {
      const set = await currentExecutor()
        .orm.public.Set.where((set) => set.externalId.eq(query.setExternalId!))
        .select('id')
        .first();
      if (!set) return [];
      setId = set.id;
    }

    let collection = currentExecutor().orm.public.Card
      .select('externalId', 'name', 'number', 'rarity', 'imageSmall')
      .include('set', (set) => set.select('externalId', 'name'))
      .orderBy([
        (card) => card.name.asc(),
        (card) => card.number.asc(),
        (card) => card.externalId.asc(),
      ]);

    if (query.name !== undefined) {
      collection = collection.where((card) => card.name.ilike(`%${escapeLike(query.name!)}%`));
    }
    if (setId !== null) {
      collection = collection.where((card) => card.setId.eq(setId!));
    }
    if (query.number !== undefined) {
      collection = collection.where((card) => card.number.eq(query.number!));
    }
    if (query.rarity !== undefined) {
      // Exact normalized match: compare case-insensitively against the
      // stored source value without rewriting it.
      collection = collection.where((card) => card.rarity.ilike(escapeLike(query.rarity!)));
    }

    return collection
      .limit(query.limit)
      .offset(query.offset)
      .all()
      .then((rows) =>
        rows.map((row) => ({
          externalId: row.externalId,
          name: row.name,
          number: row.number,
          rarity: row.rarity,
          setExternalId: row.set.externalId,
          setName: row.set.name,
          imageSmall: row.imageSmall,
        })),
      );
  }
}
