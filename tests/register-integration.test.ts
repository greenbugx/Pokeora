import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { RegisterPlayer } from '../src/application/use-cases/register-player';
import { transactional } from '../src/infrastructure/database/prisma/client';
import { PrismaUserRepository } from '../src/infrastructure/database/repositories/prisma-user.repository';
import { PrismaWalletRepository } from '../src/infrastructure/database/repositories/prisma-wallet.repository';
import { db } from '../src/prisma/db';

// Integration tests run against the project's real PostgreSQL database
// (DATABASE_URL). Each run uses a unique Discord ID and cleans up after
// itself; they are skipped entirely when the database is not configured.
const hasDatabase = Boolean(process.env['DATABASE_URL']);

const userRepository = new PrismaUserRepository();
const walletRepository = new PrismaWalletRepository();

const INITIAL_BALANCE = 500n;

async function cleanup(discordId: string): Promise<void> {
  const user = await userRepository.findByDiscordId(discordId);
  if (!user) return;
  // Wallet then user, respecting the FK cascade direction explicitly.
  await db.orm.public.Wallet.where((wallet) => wallet.userId.eq(user.id)).delete();
  await db.orm.public.User.where((candidate) => candidate.id.eq(user.id)).delete();
}

async function countWallets(userId: string): Promise<number> {
  const rows = await db.orm.public.Wallet
    .where((wallet) => wallet.userId.eq(userId))
    .select('id')
    .all();
  return rows.length;
}

describe('registration integration (PostgreSQL)', { skip: hasDatabase ? false : 'DATABASE_URL not set' }, () => {
  const discordId = `it-discord-${process.pid}-${Date.now()}`;
  const useCase = new RegisterPlayer({
    unitOfWork: { transactional },
    userRepository,
    walletRepository,
    initialBalance: INITIAL_BALANCE,
  });

  before(async () => {
    await cleanup(discordId);
  });

  after(async () => {
    await cleanup(discordId);
    await db.close();
  });

  it('creates exactly one user with one wallet at the initial balance', async () => {
    const result = await useCase.execute({ discordId, username: 'integration-tester' });
    assert.ok(result.outcome === 'registered');

    const user = await userRepository.findByDiscordId(discordId);
    assert.ok(user);
    assert.equal(user.username, 'integration-tester');

    const walletCount = await countWallets(user.id);
    assert.equal(walletCount, 1);

    const wallet = await db.orm.public.Wallet
      .where((candidate) => candidate.userId.eq(user.id))
      .select('id', 'userId', 'balance')
      .first();
    assert.ok(wallet);
    assert.equal(wallet.userId, user.id);
    assert.equal(wallet.balance, INITIAL_BALANCE);
  });

  it('is idempotent: second registration is already-registered, no duplicates', async () => {
    const second = await useCase.execute({ discordId, username: 'integration-tester' });
    assert.equal(second.outcome, 'already-registered');

    const user = await userRepository.findByDiscordId(discordId);
    assert.ok(user);
    assert.equal(await countWallets(user.id), 1);
  });

  it('concurrent registrations produce one user and one wallet', async () => {
    const concurrentId = `${discordId}-race`;
    const racer = new RegisterPlayer({
      unitOfWork: { transactional },
      userRepository,
      walletRepository,
      initialBalance: INITIAL_BALANCE,
    });
    try {
      const attempts = await Promise.all(
        Array.from({ length: 5 }, (_, index) =>
          racer.execute({ discordId: concurrentId, username: `racer-${index}` }),
        ),
      );
      const registered = attempts.filter((attempt) => attempt.outcome === 'registered');
      assert.equal(registered.length, 1, 'exactly one concurrent attempt may register');

      const user = await userRepository.findByDiscordId(concurrentId);
      assert.ok(user);
      assert.equal(await countWallets(user.id), 1);
    } finally {
      await cleanup(concurrentId);
    }
  });

  it('rolls back the user when wallet creation fails (atomicity)', async () => {
    const atomicId = `${discordId}-atomic`;
    const failingWalletRepository = {
      createForUser: async () => {
        throw new Error('wallet creation failed');
      },
    };
    const failingUseCase = new RegisterPlayer({
      unitOfWork: { transactional },
      userRepository,
      walletRepository: failingWalletRepository,
      initialBalance: INITIAL_BALANCE,
    });
    try {
      await assert.rejects(
        failingUseCase.execute({ discordId: atomicId, username: 'atomicity-tester' }),
        /wallet creation failed/,
      );
      const user = await userRepository.findByDiscordId(atomicId);
      assert.equal(user, null, 'no user row may survive a failed registration');
      const survivors = await db.orm.public.User
        .where((candidate) => candidate.discordId.eq(atomicId))
        .select('id')
        .all();
      assert.equal(survivors.length, 0);
    } finally {
      await cleanup(atomicId);
    }
  });
});
