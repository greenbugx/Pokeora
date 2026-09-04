import 'dotenv/config';
import { Client, Events, GatewayIntentBits, REST, Routes } from 'discord.js';
import { RegisterPlayer } from './application/use-cases/register-player';
import { PrismaUserRepository } from './infrastructure/database/repositories/prisma-user.repository';
import { PrismaWalletRepository } from './infrastructure/database/repositories/prisma-wallet.repository';
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

  const router = createCommandRouter(registerPlayer, logger);

  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  client.once(Events.ClientReady, (ready) => {
    logger.info('bot.ready', { username: ready.user.tag });
  });
  client.on(router.event, (interaction) => {
    void router.handle(interaction);
  });

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
