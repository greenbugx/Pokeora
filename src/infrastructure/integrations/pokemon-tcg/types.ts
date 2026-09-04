/** Explicit types for the subset of the Pokémon TCG API actually consumed. */

export interface ApiSetImages {
  symbol?: string;
  logo?: string;
}

export interface ApiSet {
  id: string;
  name: string;
  series: string;
  releaseDate: string;
  printedTotal: number;
  total: number;
  images?: ApiSetImages;
}

export interface ApiCardImages {
  small?: string;
  large?: string;
}

/** One pricing slot inside `tcgplayer.prices` (e.g. `normal`, `holofoil`). */
export type ApiTcgPlayerPrices = Record<string, unknown>;

export interface ApiTcgPlayer {
  url?: string;
  updatedAt?: string;
  prices?: ApiTcgPlayerPrices;
}

export interface ApiCardSetRef {
  id: string;
  name?: string;
  series?: string;
}

export interface ApiCard {
  id: string;
  name: string;
  number: string;
  rarity?: string;
  images?: ApiCardImages;
  set: ApiCardSetRef;
  tcgplayer?: ApiTcgPlayer;
}

/** Envelope for the API's list endpoints. */
export interface ApiListResponse<T> {
  data: T[];
  page: number;
  pageSize: number;
  count: number;
  totalCount: number;
}
