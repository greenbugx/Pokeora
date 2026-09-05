export type CatalogPageKind = 'card' | 'set';

export interface CatalogCardPageQuery {
  name?: string;
  setExternalId?: string;
  number?: string;
  rarity?: string;
}

export interface CatalogSetPageQuery {
  name?: string;
  series?: string;
}

export type CatalogPageContext =
  | { id: string; userId: string; kind: 'card'; query: CatalogCardPageQuery }
  | { id: string; userId: string; kind: 'set'; query: CatalogSetPageQuery };

export type NewCatalogPageContext = Omit<CatalogPageContext, 'id'>;

/**
 * Ephemeral storage for Discord pagination state. Component custom IDs carry
 * only `<context id>:<page>`; the query itself lives here with a bounded TTL.
 * Implementations must tolerate failures: save may return null and load may
 * return null, which presentation renders as an expired view. State is
 * per-request — there is no global or module-level pagination state.
 */
export interface CatalogPageContextStore {
  save(context: NewCatalogPageContext): Promise<string | null>;
  load(id: string): Promise<CatalogPageContext | null>;
}
