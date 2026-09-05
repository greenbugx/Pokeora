import type { ChatInputCommandInteraction, Interaction } from 'discord.js';
import { Events } from 'discord.js';
import type { Logger } from '../../infrastructure/logging/logger';
import { executeCardCommand, cardCommandDefinition } from '../commands/card';
import { executeSetCommand, setCommandDefinition } from '../commands/set';
import { executeRegisterCommand, registerCommandDefinition } from '../commands/register';
import { PAGE_CUSTOM_ID_PREFIX, handlePageButton } from '../commands/catalog-pagination';
import type { RegisterPlayer } from '../../application/use-cases/register-player';
import type { GetCard, SearchCards } from '../../application/use-cases/catalog/card-queries';
import type { GetSet, SearchSets } from '../../application/use-cases/catalog/set-queries';
import type { CatalogPageContextStore } from '../../application/use-cases/catalog/pagination-context-store';

export interface CatalogCommandHandlers {
  getCard: GetCard;
  searchCards: SearchCards;
  getSet: GetSet;
  searchSets: SearchSets;
  pageContextStore: CatalogPageContextStore;
}

interface RoutedCommand {
  name: string;
  handle(interaction: ChatInputCommandInteraction): Promise<void>;
}

export function createCommandRouter(
  registerPlayer: RegisterPlayer,
  catalog: CatalogCommandHandlers,
  logger: Logger,
): {
  event: typeof Events.InteractionCreate;
  definitions: unknown[];
  handle(interaction: Interaction): Promise<void>;
} {
  const commands: RoutedCommand[] = [
    {
      name: registerCommandDefinition.name,
      handle: (interaction) => executeRegisterCommand(interaction, registerPlayer),
    },
    {
      name: cardCommandDefinition.name,
      handle: (interaction) =>
        executeCardCommand(interaction, catalog.getCard, catalog.searchCards, catalog.pageContextStore),
    },
    {
      name: setCommandDefinition.name,
      handle: (interaction) =>
        executeSetCommand(interaction, catalog.getSet, catalog.searchSets, catalog.pageContextStore),
    },
  ];

  const definitions = [registerCommandDefinition, cardCommandDefinition, setCommandDefinition];

  return {
    event: Events.InteractionCreate,
    definitions,
    async handle(interaction) {
      if (interaction.isButton()) {
        if (!interaction.customId.startsWith(PAGE_CUSTOM_ID_PREFIX)) return;
        const startedAt = Date.now();
        try {
          await handlePageButton(
            interaction,
            catalog.pageContextStore,
            catalog.searchCards,
            catalog.searchSets,
          );
        } catch (error) {
          logger.error('interaction.failed', {
            operation: 'catalog-page',
            discordUserId: interaction.user.id,
            durationMs: Date.now() - startedAt,
            error: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
          });
          const content = '⚠️ Something went wrong while loading the catalog. Please try again.';
          if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content, ephemeral: true });
          } else {
            await interaction.reply({ content, ephemeral: true });
          }
        }
        return;
      }

      if (!interaction.isChatInputCommand()) return;

      const command = commands.find((candidate) => candidate.name === interaction.commandName);
      if (!command) return;

      const startedAt = Date.now();
      try {
        await command.handle(interaction);
      } catch (error) {
        logger.error('interaction.failed', {
          operation: interaction.commandName,
          discordUserId: interaction.user.id,
          durationMs: Date.now() - startedAt,
          error: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
        });
        const content = '⚠️ Something went wrong while loading the catalog. Please try again.';
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({ content, ephemeral: true });
        } else {
          await interaction.reply({ content, ephemeral: true });
        }
      }
    },
  };
}
