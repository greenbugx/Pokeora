import type { UnitOfWork } from '../../../domain/shared/ports/unit-of-work';
import type {
  AcquireOwnershipInput,
  OwnershipRepository,
  ReleaseOwnershipOutcome,
} from '../../../domain/collection/ports/ownership-repository';
import {
  InsufficientOwnershipError,
  InvalidConditionError,
  InvalidOwnershipQuantityError,
  NonCollectibleVariantError,
  OwnershipNotFoundError,
  OwnershipUnavailableError,
  UserNotFoundError,
  VariantNotFoundError,
} from './collection-errors';
import { toOwnershipDetails } from './ownership-dto';
import type { OwnershipDetails } from './ownership-dto';
import { translateRepositoryError } from '../catalog/query-error';

/**
 * Maximum quantity per single ownership adjustment. Deliberately modest:
 * comfortably above pack/trade batch sizes, far below the database integer
 * range.
 */
export const MAX_OWNERSHIP_ADJUSTMENT = 999;

/** Condition is a free-form source label in the locked schema (String column).
 * No condition vocabulary or default is invented here — trusted callers
 * supply the condition; it is only length-checked. */
const MAX_CONDITION_LENGTH = 32;

export interface AcquireOwnershipResult {
  ownership: OwnershipDetails;
}

/**
 * Acquires copies of a collectible variant for a user. Validates quantity and
 * condition in the application layer; variant existence and collectibility
 * are resolved from the catalog inside the ownership primitive (never from
 * caller-supplied metadata. Runs in the caller-owned transaction when
 * one is open, so a future Pack Opening can compose it atomically.
 */
export class AcquireOwnership {
  private readonly ownershipRepository: OwnershipRepository;
  private readonly unitOfWork: UnitOfWork;

  constructor(deps: { ownershipRepository: OwnershipRepository; unitOfWork: UnitOfWork }) {
    this.ownershipRepository = deps.ownershipRepository;
    this.unitOfWork = deps.unitOfWork;
  }

  async execute(input: AcquireOwnershipInput): Promise<AcquireOwnershipResult> {
    const condition = validateCondition(input.condition);
    const quantity = validateQuantity(input.quantity);

    let outcome: Awaited<ReturnType<OwnershipRepository['acquire']>>;
    try {
      outcome = await this.unitOfWork.transactional(() =>
        this.ownershipRepository.acquire({
          userId: input.userId,
          variantId: input.variantId,
          condition,
          quantity,
        }),
      );
    } catch (error) {
      throw new OwnershipUnavailableError(error);
    }

    switch (outcome.outcome) {
      case 'acquired':
        return { ownership: toOwnershipDetails(outcome.record) };
      case 'user-not-found':
        throw new UserNotFoundError();
      case 'variant-not-found':
        throw new VariantNotFoundError(input.variantId);
      case 'not-collectible':
        throw new NonCollectibleVariantError(input.variantId);
    }
  }
}

export interface RemoveOwnershipInput {
  userId: string;
  ownershipId: string;
  quantity: number;
}

export type RemoveOwnershipResult =
  | { outcome: 'partial'; quantity: number }
  | { outcome: 'removed' };

/**
 * Releases copies from one specific ownership record. The record must belong
 * to the user; removal beyond the held quantity fails without any
 * modification; reaching zero deletes the record inside the same
 * transaction (the schema's quantity > 0 CHECK forbids zero rows).
 */
export class RemoveOwnership {
  private readonly ownershipRepository: OwnershipRepository;
  private readonly unitOfWork: UnitOfWork;

  constructor(deps: { ownershipRepository: OwnershipRepository; unitOfWork: UnitOfWork }) {
    this.ownershipRepository = deps.ownershipRepository;
    this.unitOfWork = deps.unitOfWork;
  }

  async execute(input: RemoveOwnershipInput): Promise<RemoveOwnershipResult> {
    const quantity = validateQuantity(input.quantity);

    let outcome: ReleaseOwnershipOutcome;
    try {
      outcome = await this.unitOfWork.transactional(() =>
        this.ownershipRepository.release({
          userId: input.userId,
          ownershipId: input.ownershipId,
          quantity,
        }),
      );
    } catch (error) {
      throw translateRepositoryError(error);
    }

    switch (outcome) {
      case 'partial':
        // Re-read the post-release state so callers never do quantity math.
        return this.readPartialResult(input);
      case 'removed':
        return { outcome: 'removed' };
      case 'not-found':
        throw new OwnershipNotFoundError(input.ownershipId);
      case 'insufficient':
        throw new InsufficientOwnershipError(input.ownershipId);
    }
  }

  private async readPartialResult(input: RemoveOwnershipInput): Promise<RemoveOwnershipResult> {
    let record;
    try {
      record = await this.ownershipRepository.findByIdForUser(input.userId, input.ownershipId);
    } catch (error) {
      throw new OwnershipUnavailableError(error);
    }
    if (!record) throw new OwnershipNotFoundError(input.ownershipId);
    return { outcome: 'partial', quantity: record.quantity };
  }
}

function validateQuantity(quantity: number): number {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new InvalidOwnershipQuantityError('Quantity must be a positive whole number');
  }
  if (quantity > MAX_OWNERSHIP_ADJUSTMENT) {
    throw new InvalidOwnershipQuantityError(
      `Quantity exceeds the maximum adjustment of ${MAX_OWNERSHIP_ADJUSTMENT}`,
    );
  }
  return quantity;
}

function validateCondition(condition: string): string {
  const trimmed = typeof condition === 'string' ? condition.trim() : '';
  if (trimmed.length === 0) {
    throw new InvalidConditionError('A condition must be provided');
  }
  if (trimmed.length > MAX_CONDITION_LENGTH) {
    throw new InvalidConditionError(`Condition must be at most ${MAX_CONDITION_LENGTH} characters`);
  }
  return trimmed;
}
