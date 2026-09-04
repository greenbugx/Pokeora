import type { NewUser, User } from '../entities/user';

export interface UserRepository {
  findByDiscordId(discordId: string): Promise<User | null>;
  create(user: NewUser): Promise<User>;
}
