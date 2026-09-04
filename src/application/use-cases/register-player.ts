import type { UnitOfWork } from '../../domain/shared/ports/unit-of-work';
import type { Wallet } from '../../domain/economy/wallet/entities/wallet';
import type { WalletRepository } from '../../domain/economy/wallet/ports/wallet-repository';
import type { User } from '../../domain/user/entities/user';
import { PlayerAlreadyRegisteredError } from '../../domain/user/errors';
import type { UserRepository } from '../../domain/user/ports/user-repository';

export interface RegisterPlayerInput {
  discordId: string;
  username: string;
}

export type RegisterPlayerResult =
  | { outcome: 'registered'; user: User; wallet: Wallet }
  | { outcome: 'already-registered' };

export interface RegisterPlayerDependencies {
  unitOfWork: UnitOfWork;
  userRepository: UserRepository;
  walletRepository: WalletRepository;
  /** Game rule: Pokécoins granted on registration (INITIAL_POKECOINS). */
  initialBalance: bigint;
}

export class RegisterPlayer {
  private readonly unitOfWork: UnitOfWork;
  private readonly userRepository: UserRepository;
  private readonly walletRepository: WalletRepository;
  private readonly initialBalance: bigint;

  constructor(dependencies: RegisterPlayerDependencies) {
    this.unitOfWork = dependencies.unitOfWork;
    this.userRepository = dependencies.userRepository;
    this.walletRepository = dependencies.walletRepository;
    this.initialBalance = dependencies.initialBalance;
  }

  async execute(input: RegisterPlayerInput): Promise<RegisterPlayerResult> {
    return this.unitOfWork.transactional(async () => {
      const existing = await this.userRepository.findByDiscordId(input.discordId);
      if (existing) {
        return { outcome: 'already-registered' } as const;
      }

      try {
        const user = await this.userRepository.create({
          discordId: input.discordId,
          username: input.username,
        });
        const wallet = await this.walletRepository.createForUser(user.id, this.initialBalance);
        return { outcome: 'registered', user, wallet } as const;
      } catch (error) {
        if (error instanceof PlayerAlreadyRegisteredError) {
          return { outcome: 'already-registered' } as const;
        }
        throw error;
      }
    });
  }
}
