import type { NewUser, User } from '../../../domain/user/entities/user';
import { PlayerAlreadyRegisteredError } from '../../../domain/user/errors';
import type { UserRepository } from '../../../domain/user/ports/user-repository';
import { currentExecutor, isUniqueViolation } from '../prisma/client';

type DatabaseUser = {
  id: string;
  discordId: string;
  username: string;
};

function toDomain(row: DatabaseUser): User {
  return { id: row.id, discordId: row.discordId, username: row.username };
}

export class PrismaUserRepository implements UserRepository {
  async findByDiscordId(discordId: string): Promise<User | null> {
    const row = await currentExecutor()
      .orm.public.User.where((user) => user.discordId.eq(discordId))
      .select('id', 'discordId', 'username')
      .first();
    return row ? toDomain(row) : null;
  }

  async create(user: NewUser): Promise<User> {
    try {
      const row = await currentExecutor()
        .orm.public.User.select('id', 'discordId', 'username')
        .create({ discordId: user.discordId, username: user.username });
      return toDomain(row);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new PlayerAlreadyRegisteredError(user.discordId);
      }
      throw error;
    }
  }
}
