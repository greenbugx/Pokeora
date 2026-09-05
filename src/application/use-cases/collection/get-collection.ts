import { CollectionUnavailableError, UnregisteredUserError } from './collection-errors';
import { toCollectionEntry, toOwnershipDetails } from './ownership-dto';
import type { CollectionEntry, CollectionResult, OwnershipDetails } from './ownership-dto';
import type { CollectionEntryRecord, OwnershipRepository } from '../../../domain/collection/ports/ownership-repository';
import type { UserRepository } from '../../../domain/user/ports/user-repository';
import { pageToOffset } from '../catalog/pagination';
import { translateRepositoryError } from '../catalog/query-error';

export interface GetCollectionInput {
  /** Discord snowflake of the requesting user — /collection is always self-only. */
  discordId: string;
  page?: number;
}

/**
 * Reads one bounded page of a player's collection. Resolves the Discord user
 * through the existing registration records (no auto-registration);
 * an empty collection is a successful empty result, not an error.
 */
export class GetCollection {
  private readonly ownershipRepository: OwnershipRepository;
  private readonly userRepository: UserRepository;

  constructor(deps: { ownershipRepository: OwnershipRepository; userRepository: UserRepository }) {
    this.ownershipRepository = deps.ownershipRepository;
    this.userRepository = deps.userRepository;
  }

  async execute(input: GetCollectionInput): Promise<CollectionResult> {
    const user = await this.userRepository.findByDiscordId(input.discordId);
    if (!user) throw new UnregisteredUserError(input.discordId);

    const { offset, limit } = pageToOffset(input.page ?? 1);
    let records;
    try {
      // Fetch one extra row to compute hasMore without a count query.
      records = await this.ownershipRepository.findCollectionPage({
        userId: user.id,
        limit: limit + 1,
        offset,
      });
    } catch (error) {
      throw new CollectionUnavailableError(error);
    }

    const hasMore = records.length > limit;
    return {
      items: records.slice(0, limit).map(toCollectionEntry),
      page: input.page ?? 1,
      pageSize: limit,
      hasMore,
    };
  }
}
/** Retrieves ownership records for trusted internal consumers. */
export class GetOwnership {
  private readonly ownershipRepository: OwnershipRepository;

  constructor(deps: { ownershipRepository: OwnershipRepository }) {
    this.ownershipRepository = deps.ownershipRepository;
  }

  /** Exact record by id, authorized to belong to the user. */
  async byId(userId: string, ownershipId: string): Promise<OwnershipDetails | null> {
    let record: CollectionEntryRecord | null;
    try {
      record = await this.ownershipRepository.findByIdForUser(userId, ownershipId);
    } catch (error) {
      throw translateRepositoryError(error);
    }
    return record ? toOwnershipDetails(record) : null;
  }

  /**
   * All condition-specific records a user holds for one variant. Returns an
   * array because the ownership identity includes condition — a
   * single-record assumption here would be ambiguous.
   */
  async forVariant(userId: string, variantId: string): Promise<OwnershipDetails[]> {
    let records: CollectionEntryRecord[];
    try {
      records = await this.ownershipRepository.findByUserAndVariant(userId, variantId);
    } catch (error) {
      throw translateRepositoryError(error);
    }
    return records.map(toOwnershipDetails);
  }
}
