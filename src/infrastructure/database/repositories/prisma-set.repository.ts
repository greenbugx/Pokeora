import type { Set, SetChanges } from '../../../domain/set/entities/set';
import type { SetRepository } from '../../../domain/set/ports/set-repository';
import { currentExecutor } from '../prisma/client';
import { Temporal } from '@js-temporal/polyfill';

type DatabaseSetRow = {
  id: string;
  externalId: string;
  name: string;
  series: string;
  releaseDate: Temporal.PlainDate;
  totalCards: number;
  logoUrl: string;
  symbolUrl: string;
};

const SET_COLUMNS = ['id', 'externalId', 'name', 'series', 'releaseDate', 'totalCards', 'logoUrl', 'symbolUrl'] as const;

function toDomain(row: DatabaseSetRow): Set {
  return {
    id: row.id,
    externalId: row.externalId,
    name: row.name,
    series: row.series,
    releaseDate: row.releaseDate,
    totalCards: row.totalCards,
    logoUrl: row.logoUrl,
    symbolUrl: row.symbolUrl,
  };
}

export class PrismaSetRepository implements SetRepository {
  async findByExternalId(externalId: string): Promise<Set | null> {
    const row = await currentExecutor()
      .orm.public.Set.where((set) => set.externalId.eq(externalId))
      .select(...SET_COLUMNS)
      .first();
    return row ? toDomain(row) : null;
  }

  async upsert(changes: SetChanges): Promise<Set> {
    // updatedAt refreshes automatically via the contract's
    // temporal.updatedAt() generator on mutation.
    const row = await currentExecutor().orm.public.Set.upsert({
      create: {
        externalId: changes.externalId,
        name: changes.name,
        series: changes.series,
        releaseDate: changes.releaseDate,
        totalCards: changes.totalCards,
        logoUrl: changes.logoUrl,
        symbolUrl: changes.symbolUrl,
      },
      update: {
        name: changes.name,
        series: changes.series,
        releaseDate: changes.releaseDate,
        totalCards: changes.totalCards,
        logoUrl: changes.logoUrl,
        symbolUrl: changes.symbolUrl,
      },
      conflictOn: { externalId: changes.externalId },
    });
    return toDomain(row);
  }

  async loadExternalIdMap(): Promise<Map<string, string>> {
    const rows = await currentExecutor()
      .orm.public.Set.select('id', 'externalId')
      .all();
    return new Map(rows.map((row) => [row.externalId, row.id]));
  }
}
