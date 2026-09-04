import type { ChatInputCommandInteraction, Interaction } from 'discord.js';
import { Events } from 'discord.js';
import type { RegisterPlayer } from '../../application/use-cases/register-player';
import type { Logger } from '../../infrastructure/logging/logger';
import { executeRegisterCommand, registerCommandDefinition } from '../commands/register';

interface RoutedCommand {
  name: string;
  handle(interaction: ChatInputCommandInteraction): Promise<void>;
}

export function createCommandRouter(registerPlayer: RegisterPlayer, logger: Logger): {
  event: typeof Events.InteractionCreate;
  definitions: unknown[];
  handle(interaction: Interaction): Promise<void>;
} {
  const commands: RoutedCommand[] = [
    {
      name: registerCommandDefinition.name,
      handle: (interaction) => executeRegisterCommand(interaction, registerPlayer),
    },
  ];

  return {
    event: Events.InteractionCreate,
    definitions: [registerCommandDefinition],
    async handle(interaction) {
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
        const content = '⚠️ Something went wrong. Please try again in a moment.';
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({ content, ephemeral: true });
        } else {
          await interaction.reply({ content, ephemeral: true });
        }
      }
    },
  };
}
