import { Temporal } from '@js-temporal/polyfill';

export interface Set {
  id: string;
  externalId: string;
  name: string;
  series: string;
  /** Calendar date (no time/zone); the date column decodes to Temporal.PlainDate. */
  releaseDate: Temporal.PlainDate;
  totalCards: number;
  logoUrl: string;
  symbolUrl: string;
}

/** Source-derived mutable fields, used when an existing Set is updated. */
export type SetChanges = Omit<Set, 'id'>;
