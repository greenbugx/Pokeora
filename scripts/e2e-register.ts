import 'dotenv/config';
import { RegisterPlayer } from '../src/application/use-cases/register-player';
import { PrismaUserRepository } from '../src/infrastructure/database/repositories/prisma-user.repository';
import { PrismaWalletRepository } from '../src/infrastructure/database/repositories/prisma-wallet.repository';
import { isUniqueViolation, transactional } from '../src/infrastructure/database/prisma/client';
import { db } from '../src/prisma/db';

async function main(): Promise<void> {
  const DISCORD_ID = `e2e-manual-${Date.now()}`;
  const registerPlayer = new RegisterPlayer({
    unitOfWork: { transactional },
    userRepository: new PrismaUserRepository(),
    walletRepository: new PrismaWalletRepository(),
    initialBalance: 500n,
  });

  const first = await registerPlayer.execute({ discordId: DISCORD_ID, username: 'e2e-tester' });
  console.log('first attempt:', first.outcome);

  const second = await registerPlayer.execute({ discordId: DISCORD_ID, username: 'e2e-tester' });
  console.log('second attempt:', second.outcome);

  // Raw duplicate insert must be rejected by PostgreSQL itself.
  try {
    await db.orm.public.User.create({ discordId: DISCORD_ID, username: 'impostor' });
    console.log('raw duplicate: INSERTED (BAD - constraint missing)');
  } catch (error) {
    const sqlState = error instanceof Error && 'sqlState' in error ? (error as { sqlState: unknown }).sqlState : 'n/a';
    console.log('raw duplicate rejected by PostgreSQL:', isUniqueViolation(error), 'sqlState:', sqlState);
  }

  const users = await db.orm.public.User
    .where((user) => user.discordId.eq(DISCORD_ID))
    .select('id', 'discordId', 'username')
    .all();
  const wallets = await db.orm.public.Wallet
    .where((wallet) => wallet.userId.eq(users[0]!.id))
    .select('id', 'userId', 'balance')
    .all();
  console.log(`users: ${users.length}, wallets: ${wallets.length}`);
  console.log('wallet balance:', wallets[0]?.balance, typeof wallets[0]?.balance);
  console.log('wallet.userId === user.id:', wallets[0]?.userId === users[0]?.id);
}

main().then(() => db.close()).catch((error) => { console.error(error); process.exitCode = 1; });
