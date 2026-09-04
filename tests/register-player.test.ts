import assert from 'node:assert/strict';
import { mock } from 'node:test';
import { describe, it } from 'node:test';
import { RegisterPlayer } from '../src/application/use-cases/register-player';
import type { Wallet } from '../src/domain/economy/wallet/entities/wallet';
import type { WalletRepository } from '../src/domain/economy/wallet/ports/wallet-repository';
import type { User } from '../src/domain/user/entities/user';
import { PlayerAlreadyRegisteredError } from '../src/domain/user/errors';
import type { UserRepository } from '../src/domain/user/ports/user-repository';
import type { UnitOfWork } from '../src/domain/shared/ports/unit-of-work';

function createFakes() {
  const users = new Map<string, User>();
  const wallets = new Map<string, Wallet>();

  const userRepository: UserRepository = {
    async findByDiscordId(discordId) {
      return users.get(discordId) ?? null;
    },
    async create(user) {
      if (users.has(user.discordId)) throw new PlayerAlreadyRegisteredError(user.discordId);
      const created: User = { id: `user-${users.size + 1}`, ...user };
      users.set(created.discordId, created);
      return created;
    },
  };

  const walletRepository: WalletRepository = {
    async createForUser(userId, initialBalance) {
      if (wallets.has(userId)) throw new Error(`duplicate wallet for ${userId}`);
      const created: Wallet = { id: `wallet-${wallets.size + 1}`, userId, balance: initialBalance };
      wallets.set(userId, created);
      return created;
    },
  };

  const unitOfWork: UnitOfWork = {
    async transactional(work) {
      return work();
    },
  };

  return { users, wallets, userRepository, walletRepository, unitOfWork };
}

function createUseCase(fakes: ReturnType<typeof createFakes>, initialBalance = 500n) {
  return new RegisterPlayer({
    unitOfWork: fakes.unitOfWork,
    userRepository: fakes.userRepository,
    walletRepository: fakes.walletRepository,
    initialBalance,
  });
}

describe('RegisterPlayer', () => {
  it('registers a new player with a wallet at the initial balance', async () => {
    const fakes = createFakes();
    const result = await createUseCase(fakes).execute({ discordId: '123', username: 'ash' });

    assert.equal(result.outcome, 'registered');
    assert.ok(result.outcome === 'registered');
    assert.equal(result.user.discordId, '123');
    assert.equal(result.user.username, 'ash');
    assert.equal(result.wallet.userId, result.user.id);
    assert.equal(result.wallet.balance, 500n);
    assert.equal(typeof result.wallet.balance, 'bigint');
  });

  it('returns already-registered for an existing player', async () => {
    const fakes = createFakes();
    const useCase = createUseCase(fakes);
    await useCase.execute({ discordId: '123', username: 'ash' });
    const second = await useCase.execute({ discordId: '123', username: 'ash' });

    assert.equal(second.outcome, 'already-registered');
    assert.equal(fakes.users.size, 1);
    assert.equal(fakes.wallets.size, 1);
  });

  it('treats a concurrent unique-violation as already-registered', async () => {
    const fakes = createFakes();
    // First call inserts nothing (find misses), then creation loses a race.
    const create = fakes.userRepository.create.bind(fakes.userRepository);
    mock.method(fakes.userRepository, 'create', async () => {
      throw new PlayerAlreadyRegisteredError('123');
    });
    const result = await createUseCase(fakes).execute({ discordId: '123', username: 'ash' });
    assert.equal(result.outcome, 'already-registered');
    assert.ok(create);
  });

  it('propagates unrelated failures', async () => {
    const fakes = createFakes();
    mock.method(fakes.walletRepository, 'createForUser', async () => {
      throw new Error('database exploded');
    });
    await assert.rejects(
      createUseCase(fakes).execute({ discordId: '123', username: 'ash' }),
      /database exploded/,
    );
  });
});
