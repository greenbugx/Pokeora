import type { Wallet } from '../entities/wallet';

export interface WalletRepository {
  createForUser(userId: string, initialBalance: bigint): Promise<Wallet>;
}
