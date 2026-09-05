import type {
  SetDetailsRecord,
  SetQueryRepository,
  SetSearchQuery,
  SetSearchRecord,
} from '../../../domain/set/ports/set-query-repository';
import { currentExecutor } from '../prisma/client';

/** Escapes LIKE wildcards so user input matches literally. */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`);
}

export class PrismaSetQueryRepository implements SetQueryRepository {
  async findByExternalId(externalId: string): Promise<SetDetailsRecord | null> {
    const row = await currentExecutor()
      .orm.public.Set.where((set) => set.externalId.eq(externalId))
      .select('externalId', 'name', 'series', 'releaseDate', 'totalCards', 'logoUrl', 'symbolUrl')
      .first();
    if (!row) return null;
    return { ...row };
  }

  async search(query: SetSearchQuery): Promise<SetSearchRecord[]> {
    let collection = currentExecutor().orm.public.Set
      .select('externalId', 'name', 'series')
      .orderBy([(set) => set.name.asc(), (set) => set.externalId.asc()]);

    if (query.name !== undefined) {
      collection = collection.where((set) => set.name.ilike(`%${escapeLike(query.name!)}%`));
    }
    if (query.series !== undefined) {
      collection = collection.where((set) => set.series.eq(query.series!));
    }

    return collection
      .limit(query.limit)
      .offset(query.offset)
      .all()
      .then((rows) => rows.map((row) => ({ externalId: row.externalId, name: row.name, series: row.series })));
  }
}
