import { Temporal } from '@js-temporal/polyfill';
import type { ApiCard, ApiListResponse, ApiSet } from './types';

/** Error thrown for responses that fail structural validation. */
export class ApiResponseInvalidError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ApiResponseInvalidError';
  }
}

/**
 * Translates the consumed subset of the Pokémon TCG API into the application's
 * source DTOs.
 */

/** The normalized internal labels for a recognized variant evidence key. */
interface VariantLabel {
  variantType: string;
  finish: string;
}

/**
 * v1 evidence policy: recognized TCGPlayer pricing keys map to internal
 * variant identities. Unknown keys are ignored, never fabricated.
 */
const TCGPLAYER_VARIANT_EVIDENCE: ReadonlyMap<string, VariantLabel> = new Map([
  ['normal', { variantType: 'NORMAL', finish: 'NON_FOIL' }],
  ['holofoil', { variantType: 'HOLO', finish: 'HOLOFOIL' }],
  ['reverseHolofoil', { variantType: 'REVERSE_HOLO', finish: 'REVERSE_HOLOFOIL' }],
  ['1stEditionNormal', { variantType: 'FIRST_EDITION', finish: 'NON_FOIL' }],
  ['1stEditionHolofoil', { variantType: 'FIRST_EDITION', finish: 'HOLOFOIL' }],
]);

export function toVariantIdentity(evidenceKey: string): VariantLabel | null {
  return TCGPLAYER_VARIANT_EVIDENCE.get(evidenceKey) ?? null;
}

/** Pricing keys that count as usable variant evidence for a card. */
function extractEvidenceKeys(card: ApiCard): string[] {
  const prices = card.tcgplayer?.prices;
  if (!prices) return [];
  return Object.keys(prices).filter((key) => TCGPLAYER_VARIANT_EVIDENCE.has(key));
}

function requireNonEmptyString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new ApiResponseInvalidError(`Missing or empty field: ${field}`);
  }
  return value;
}

function optionalString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export interface MappedSet {
  externalId: string;
  name: string;
  series: string;
  releaseDate: Temporal.PlainDate;
  totalCards: number;
  logoUrl: string;
  symbolUrl: string;
}

export function mapSet(apiSet: ApiSet): MappedSet {
  const externalId = requireNonEmptyString(apiSet.id, 'set.id');
  return {
    externalId,
    name: requireNonEmptyString(apiSet.name, `set ${externalId} name`),
    series: requireNonEmptyString(apiSet.series, `set ${externalId} series`),
    releaseDate: parseReleaseDate(apiSet.releaseDate, externalId),
    // `total` (not printedTotal): the catalog covers the full pool
    // including secret prints.
    totalCards: nonNegative(apiSet.total, `set ${externalId} total`),
    logoUrl: optionalString(apiSet.images?.logo),
    symbolUrl: optionalString(apiSet.images?.symbol),
  };
}

export interface MappedCard {
  externalId: string;
  setExternalId: string;
  name: string;
  number: string;
  rarity: string;
  imageSmall: string;
  imageLarge: string;
  variantEvidenceKeys: string[];
}

export function mapCard(apiCard: ApiCard): MappedCard {
  const externalId = requireNonEmptyString(apiCard.id, 'card.id');
  return {
    externalId,
    setExternalId: requireNonEmptyString(apiCard.set?.id, `card ${externalId} set.id`),
    name: requireNonEmptyString(apiCard.name, `card ${externalId} name`),
    number: requireNonEmptyString(apiCard.number, `card ${externalId} number`),
    rarity: optionalString(apiCard.rarity),
    imageSmall: optionalString(apiCard.images?.small),
    imageLarge: optionalString(apiCard.images?.large),
    variantEvidenceKeys: extractEvidenceKeys(apiCard),
  };
}

function parseReleaseDate(value: unknown, externalId: string): Temporal.PlainDate {
  // The API mostly uses ISO (1999-01-09) but legacy sets use slashed dates
  // (1999/01/09); both are unambiguous calendar dates.
  if (typeof value !== 'string' || !/^\d{4}[-/]\d{2}[-/]\d{2}$/.test(value)) {
    throw new ApiResponseInvalidError(`Set ${externalId} has malformed releaseDate: ${String(value)}`);
  }
  try {
    return Temporal.PlainDate.from(value.replace(/\//g, '-'));
  } catch {
    throw new ApiResponseInvalidError(`Set ${externalId} has unparseable releaseDate: ${value}`);
  }
}

function nonNegative(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new ApiResponseInvalidError(`Field ${field} must be a non-negative integer, got ${String(value)}`);
  }
  return value;
}

/** Runtime validation of a list-response envelope before mapping. */
export function parseListResponse<T>(payload: unknown, endpoint: string): ApiListResponse<T> {
  if (typeof payload !== 'object' || payload === null || !Array.isArray((payload as { data?: unknown }).data)) {
    throw new ApiResponseInvalidError(`${endpoint}: malformed response envelope`);
  }
  const body = payload as Partial<ApiListResponse<T>> & { data: T[] };
  const page = positiveInt(body.page, `${endpoint} page`);
  const pageSize = positiveInt(body.pageSize, `${endpoint} pageSize`);
  const totalCount = positiveInt(body.totalCount, `${endpoint} totalCount`);
  if (body.data.length > pageSize) {
    throw new ApiResponseInvalidError(`${endpoint}: data exceeds pageSize`);
  }
  return { data: body.data, page, pageSize, count: body.data.length, totalCount };
}

function positiveInt(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
    throw new ApiResponseInvalidError(`${field} must be a positive integer, got ${String(value)}`);
  }
  return value;
}
