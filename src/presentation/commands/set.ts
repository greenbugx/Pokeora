import type { ChatInputCommandInteraction } from 'discord.js';
import { SlashCommandBuilder } from 'discord.js';
import type { GetSet, SearchSets } from '../../application/use-cases/catalog/set-queries';
import type { CatalogPageContextStore } from '../../application/use-cases/catalog/pagination-context-store';
import {
  InvalidSetQueryError,
  SetNotFoundError,
} from '../../application/use-cases/catalog/catalog-errors';
import { DEFAULT_PAGE_SIZE } from '../../application/use-cases/catalog/pagination';
import { buildPageRow, saveSetPageContext } from './catalog-pagination';

export const setCommandDefinition = new SlashCommandBuilder()
  .setName('set')
  .setDescription('Look up a set in the Pokeora catalog.')
  .addStringOption((option) =>
    option.setName('id').setDescription('Exact set ID (e.g. sv08)').setRequired(false),
  )
  .addStringOption((option) =>
    option.setName('name').setDescription('Set name to search').setRequired(false),
  )
  .addStringOption((option) =>
    option.setName('series').setDescription('Series filter (e.g. Scarlet & Violet)').setRequired(false),
  )
  .addIntegerOption((option) =>
    option.setName('page').setDescription('Result page (default 1)').setRequired(false),
  )
  .toJSON();

export async function executeSetCommand(
  interaction: ChatInputCommandInteraction,
  getSet: GetSet,
  searchSets: SearchSets,
  pageContextStore: CatalogPageContextStore,
): Promise<void> {
  const id = interaction.options.getString('id');
  if (id !== null) {
    await replyWithSetDetails(interaction, getSet, id);
    return;
  }

  const input = {
    ...(interaction.options.getString('name') !== null
      ? { name: interaction.options.getString('name')! }
      : {}),
    ...(interaction.options.getString('series') !== null
      ? { series: interaction.options.getString('series')! }
      : {}),
    ...(interaction.options.getInteger('page') !== null
      ? { page: interaction.options.getInteger('page')! }
      : {}),
  };

  try {
    const result = await searchSets.execute(input);

    let components;
    if (result.hasMore || result.page > 1) {
      const contextId = await saveSetPageContext(pageContextStore, interaction.user.id, {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.series !== undefined ? { series: input.series } : {}),
      });
      if (contextId) {
        const row = buildPageRow('set', contextId, result.page, result.hasMore);
        if (row) components = [row];
      }
    }

    await interaction.reply({
      content: formatSetSearch(result.items, result.page, result.hasMore),
      ephemeral: true,
      ...(components ? { components } : {}),
    });
  } catch (error) {
    if (error instanceof InvalidSetQueryError) {
      await interaction.reply({
        content: 'Please provide a set ID, name, or series to search.',
        ephemeral: true,
      });
      return;
    }
    throw error;
  }
}

async function replyWithSetDetails(
  interaction: ChatInputCommandInteraction,
  getSet: GetSet,
  externalId: string,
): Promise<void> {
  try {
    const set = await getSet.execute(externalId);
    await interaction.reply({ content: formatDetails(set), ephemeral: true });
  } catch (error) {
    if (error instanceof SetNotFoundError) {
      await interaction.reply({
        content: '❌ Set not found.\n\nCheck the set ID or try another search.',
        ephemeral: true,
      });
      return;
    }
    throw error;
  }
}

function formatDetails(set: Awaited<ReturnType<GetSet['execute']>>): string {
  return [
    `**${set.name}**`,
    set.series,
    '',
    `Release: ${set.releaseDate}`,
    `Total cards: ${set.totalCards}`,
    ...(set.logoUrl ? ['', set.logoUrl] : []),
    `ID: ${set.externalId}`,
  ].join('\n');
}

export function formatSetSearch(
  items: Awaited<ReturnType<SearchSets['execute']>>['items'],
  page: number,
  hasMore: boolean,
): string {
  if (items.length === 0) {
    return 'No sets found matching your search.';
  }
  const lines = items.map(
    (item, index) => `${(page - 1) * DEFAULT_PAGE_SIZE + index + 1}. **${item.name}** (${item.series})`,
  );
  if (hasMore) lines.push('', `_(page ${page} — more results available; use the buttons or raise the page option)_`);
  return lines.join('\n');
}
