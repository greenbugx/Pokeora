import type { ChatInputCommandInteraction } from 'discord.js';
import { SlashCommandBuilder } from 'discord.js';
import type { RegisterPlayer } from '../../application/use-cases/register-player';

export const registerCommandDefinition = new SlashCommandBuilder()
  .setName('register')
  .setDescription('Register as a Pokeora player and create your wallet.')
  .toJSON();

export async function executeRegisterCommand(
  interaction: ChatInputCommandInteraction,
  registerPlayer: RegisterPlayer,
): Promise<void> {
  const result = await registerPlayer.execute({
    discordId: interaction.user.id,
    username: interaction.user.username,
  });

  if (result.outcome === 'already-registered') {
    await interaction.reply({ content: "👋 You're already registered in Pokeora.", ephemeral: true });
    return;
  }

  await interaction.reply({
    content: [
      '🎉 Welcome to Pokeora!',
      '',
      'Your collection has been created.',
      '',
      `💰 Starting Pokécoins: ${result.wallet.balance}`,
    ].join('\n'),
    ephemeral: true,
  });
}
