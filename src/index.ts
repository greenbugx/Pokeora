import 'dotenv/config';
import { Client, Events, GatewayIntentBits, REST, Routes } from 'discord.js';
import { RegisterPlayer } from './application/use-cases/register-player';
import { GetCard, SearchCards } from './application/use-cases/catalog/card-queries';
import { GetSet, SearchSets } from './application/use-cases/catalog/set-queries';
import { GetCollection } from './application/use-cases/collection/get-collection';
import { PrismaUserRepository } from './infrastructure/database/repositories/prisma-user.repository';
import { PrismaWalletRepository } from './infrastructure/database/repositories/prisma-wallet.repository';
import { PrismaCardQueryRepository } from './infrastructure/database/repositories/prisma-card-query.repository';
import { PrismaSetQueryRepository } from './infrastructure/database/repositories/prisma-set-query.repository';
import { PrismaOwnershipRepository } from './infrastructure/database/repositories/prisma-ownership.repository';
import { CachedCardQueryRepository, CachedSetQueryRepository } from './infrastructure/cache/cached-catalog-repositories';
import { IoredisCacheClient } from './infrastructure/cache/ioredis-cache-client';
import { NullCacheClient } from './infrastructure/cache/null-cache-client';
import type { CacheClient } from './infrastructure/cache/cache-client';
import { RedisCatalogPageContextStore, NullCatalogPageContextStore } from './infrastructure/cache/redis-catalog-page-context-store';
import type { CatalogPageContextStore } from './application/use-cases/catalog/pagination-context-store';
import { transactional } from './infrastructure/database/prisma/client';
import { loadConfig } from './infrastructure/config/config';
import { createConsoleLogger } from './infrastructure/logging/logger';
import { createCommandRouter } from './presentation/events/interaction-create';

const logger = createConsoleLogger();

async function main(): Promise<void> {
  const config = loadConfig();

  const userRepository = new PrismaUserRepository();
  const walletRepository = new PrismaWalletRepository();
  const registerPlayer = new RegisterPlayer({
    unitOfWork: { transactional },
    userRepository,
    walletRepository,
    initialBalance: config.initialPokecoins,
  });

  // Redis is optional: without it, exact lookups go straight to PostgreSQL
  // and pagination falls back to the page option.
  const cacheClient: CacheClient = config.redisUrl
    ? new IoredisCacheClient(config.redisUrl, logger)
    : new NullCacheClient();
  await cacheClient.connect();
  const pageContextStore: CatalogPageContextStore = config.redisUrl
    ? new RedisCatalogPageContextStore(cacheClient)
    : new NullCatalogPageContextStore();

  const cardQueryRepository = new CachedCardQueryRepository(new PrismaCardQueryRepository(), cacheClient);
  const setQueryRepository = new CachedSetQueryRepository(new PrismaSetQueryRepository(), cacheClient);
  const catalog = {
    getCard: new GetCard(cardQueryRepository),
    searchCards: new SearchCards(cardQueryRepository),
    getSet: new GetSet(setQueryRepository),
    searchSets: new SearchSets(setQueryRepository),
    getCollection: new GetCollection({
      ownershipRepository: new PrismaOwnershipRepository(),
      userRepository,
    }),
    pageContextStore,
  };

  const router = createCommandRouter(registerPlayer, catalog, logger);

  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  client.once(Events.ClientReady, (ready) => {
    logger.info('bot.ready', { username: ready.user.tag });
  });
  client.on(router.event, (interaction) => {
    void router.handle(interaction);
  });

  const shutdown = (): void => {
    void client.destroy();
    void cacheClient.close();
    process.exit(0);
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);

  const rest = new REST().setToken(config.discordToken);
  const route = config.discordGuildId
    ? Routes.applicationGuildCommands(config.discordClientId, config.discordGuildId)
    : Routes.applicationCommands(config.discordClientId);
  await rest.put(route, { body: router.definitions });
  logger.info('commands.registered', {
    commands: router.definitions.map((definition) => (definition as { name: string }).name),
    scope: config.discordGuildId ? `guild:${config.discordGuildId}` : 'global',
  });

  await client.login(config.discordToken);
}

main().catch((error: unknown) => {
  logger.error('bot.startup_failed', {
    error: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
  });
  process.exitCode = 1;
});
