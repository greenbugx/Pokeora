export class UnregisteredUserError extends Error {
  readonly discordId: string;

  constructor(discordId: string) {
    super(`No Pokeora player is registered for Discord ID ${discordId}`);
    this.name = 'UnregisteredUserError';
    this.discordId = discordId;
  }
}

export class UserNotFoundError extends Error {
  constructor() {
    super('User does not exist');
    this.name = 'UserNotFoundError';
  }
}

export class VariantNotFoundError extends Error {
  readonly variantId: string;

  constructor(variantId: string) {
    super(`Card variant not found: ${variantId}`);
    this.name = 'VariantNotFoundError';
    this.variantId = variantId;
  }
}

export class NonCollectibleVariantError extends Error {
  readonly variantId: string;

  constructor(variantId: string) {
    super(`Card variant is not collectible: ${variantId}`);
    this.name = 'NonCollectibleVariantError';
    this.variantId = variantId;
  }
}

export class OwnershipNotFoundError extends Error {
  readonly ownershipId: string;

  constructor(ownershipId: string) {
    super(`Ownership record not found: ${ownershipId}`);
    this.name = 'OwnershipNotFoundError';
    this.ownershipId = ownershipId;
  }
}

export class InsufficientOwnershipError extends Error {
  readonly ownershipId: string;

  constructor(ownershipId: string) {
    super(`Ownership record ${ownershipId} does not hold the requested quantity`);
    this.name = 'InsufficientOwnershipError';
    this.ownershipId = ownershipId;
  }
}

export class InvalidOwnershipQuantityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidOwnershipQuantityError';
  }
}

export class InvalidConditionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidConditionError';
  }
}

export class CollectionUnavailableError extends Error {
  constructor(cause?: unknown) {
    super('Collection query failed');
    this.name = 'CollectionUnavailableError';
    if (cause !== undefined) this.cause = cause;
  }
}

export class OwnershipUnavailableError extends Error {
  constructor(cause?: unknown) {
    super('Ownership operation failed');
    this.name = 'OwnershipUnavailableError';
    if (cause !== undefined) this.cause = cause;
  }
}
