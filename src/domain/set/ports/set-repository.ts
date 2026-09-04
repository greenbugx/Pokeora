import type { Set, SetChanges } from '../entities/set';

export interface SetRepository {
  findByExternalId(externalId: string): Promise<Set | null>;
  upsert(changes: SetChanges): Promise<Set>;
  /** Loads the externalId -> internal id lookup for card synchronization. */
  loadExternalIdMap(): Promise<Map<string, string>>;
}
