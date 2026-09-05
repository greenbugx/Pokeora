export class CardNotFoundError extends Error {
  readonly externalId: string;

  constructor(externalId: string) {
    super(`Card not found: ${externalId}`);
    this.name = 'CardNotFoundError';
    this.externalId = externalId;
  }
}

export class SetNotFoundError extends Error {
  readonly externalId: string;

  constructor(externalId: string) {
    super(`Set not found: ${externalId}`);
    this.name = 'SetNotFoundError';
    this.externalId = externalId;
  }
}

export class InvalidCardQueryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidCardQueryError';
  }
}

export class InvalidSetQueryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidSetQueryError';
  }
}

/** PostgreSQL was unreachable or failed; catalog reads could not be served. */
export class CatalogUnavailableError extends Error {
  constructor(cause?: unknown) {
    super('Catalog query failed');
    this.name = 'CatalogUnavailableError';
    if (cause !== undefined) this.cause = cause;
  }
}
