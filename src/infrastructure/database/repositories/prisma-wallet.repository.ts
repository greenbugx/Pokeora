import type { Wallet } from '../../../domain/economy/wallet/entities/wallet';
import type { WalletRepository } from '../../../domain/economy/wallet/ports/wallet-repository';
import { currentExecutor } from '../prisma/client';

export class PrismaWalletRepository implements WalletRepository {
  async createForUser(userId: string, initialBalance: bigint): Promise<Wallet> {
    const row = await currentExecutor()
      .orm.public.Wallet.select('id', 'userId', 'balance')
      .create({ userId, balance: initialBalance });
    return { id: row.id, userId: row.userId, balance: row.balance };
  }
}
