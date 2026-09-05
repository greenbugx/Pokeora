import type { ChatInputCommandInteraction } from 'discord.js';
import { SlashCommandBuilder } from 'discord.js';
import type { GetCard, SearchCards } from '../../application/use-cases/catalog/card-queries';
import type { CatalogPageContextStore } from '../../application/use-cases/catalog/pagination-context-store';
import {
  CardNotFoundError,
  InvalidCardQueryError,
} from '../../application/use-cases/catalog/catalog-errors';
import { DEFAULT_PAGE_SIZE } from '../../application/use-cases/catalog/pagination';
import { buildPageRow, saveCardPageContext } from './catalog-pagination';

export const cardCommandDefinition = new SlashCommandBuilder()
  .setName('card')
  .setDescription('Look up a card in the Pokeora catalog.')
  .addStringOption((option) =>
    option.setName('id').setDescription('Exact card ID (e.g. swsh4-25)').setRequired(false),
  )
  .addStringOption((option) =>
    option.setName('name').setDescription('Card name to search').setRequired(false),
  )
  .addStringOption((option) =>
    option.setName('set').setDescription('Set ID filter (e.g. sv08)').setRequired(false),
  )
  .addStringOption((option) =>
    option.setName('number').setDescription('Card number (e.g. 25, TG01)').setRequired(false),
  )
  .addStringOption((option) =>
    option.setName('rarity').setDescription('Card rarity (e.g. Illustration Rare)').setRequired(false),
  )
  .addIntegerOption((option) =>
    option.setName('page').setDescription('Result page (default 1)').setRequired(false),
  )
  .toJSON();

export async function executeCardCommand(
  interaction: ChatInputCommandInteraction,
  getCard: GetCard,
  searchCards: SearchCards,
  pageContextStore: CatalogPageContextStore,
): Promise<void> {
  const id = interaction.options.getString('id');
  if (id !== null) {
    await replyWithCardDetails(interaction, getCard, id);
    return;
  }

  const input = {
    ...(interaction.options.getString('name') !== null
      ? { name: interaction.options.getString('name')! }
      : {}),
    ...(interaction.options.getString('set') !== null
      ? { setExternalId: interaction.options.getString('set')! }
      : {}),
    ...(interaction.options.getString('number') !== null
      ? { number: interaction.options.getString('number')! }
      : {}),
    ...(interaction.options.getString('rarity') !== null
      ? { rarity: interaction.options.getString('rarity')! }
      : {}),
    ...(interaction.options.getInteger('page') !== null
      ? { page: interaction.options.getInteger('page')! }
      : {}),
  };

  try {
    const result = await searchCards.execute(input);

    // A search that matches exactly one card goes straight to the detail view.
    if (result.items.length === 1 && !result.hasMore) {
      try {
        const card = await getCard.execute(result.items[0]!.externalId);
        await interaction.reply({ content: formatDetails(card), ephemeral: true });
        return;
      } catch (error) {
        if (!(error instanceof CardNotFoundError)) throw error;
        // Fall through to the list view if the detail fetch misses.
      }
    }

    let components;
    if (result.hasMore || result.page > 1) {
      const contextId = await saveCardPageContext(pageContextStore, interaction.user.id, {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.setExternalId !== undefined ? { setExternalId: input.setExternalId } : {}),
        ...(input.number !== undefined ? { number: input.number } : {}),
        ...(input.rarity !== undefined ? { rarity: input.rarity } : {}),
      });
      if (contextId) {
        const row = buildPageRow('card', contextId, result.page, result.hasMore);
        if (row) components = [row];
      }
    }

    await interaction.reply({
      content: formatCardSearch(result.items, result.page, result.hasMore),
      ephemeral: true,
      ...(components ? { components } : {}),
    });
  } catch (error) {
    if (error instanceof InvalidCardQueryError) {
      await interaction.reply({
        content: 'Please provide a card ID, name, set, number, or rarity to search.',
        ephemeral: true,
      });
      return;
    }
    throw error;
  }
}

async function replyWithCardDetails(
  interaction: ChatInputCommandInteraction,
  getCard: GetCard,
  externalId: string,
): Promise<void> {
  try {
    const card = await getCard.execute(externalId);
    await interaction.reply({ content: formatDetails(card), ephemeral: true });
  } catch (error) {
    if (error instanceof CardNotFoundError) {
      await interaction.reply({
        content: '❌ Card not found.\n\nCheck the card ID or try another search.',
        ephemeral: true,
      });
      return;
    }
    throw error;
  }
}

function formatDetails(card: Awaited<ReturnType<GetCard['execute']>>): string {
  const lines = [
    `**${card.name}**`,
    `${card.set.name} · #${card.number}${card.rarity ? ` · ${card.rarity}` : ''}`,
    '',
    ...(card.imageLarge ? [card.imageLarge] : []),
    '',
    `ID: ${card.externalId}`,
  ];
  if (card.variants.length > 0) {
    lines.push('', 'Variants');
    for (const variant of card.variants) {
      lines.push(`• ${variant.finish} · ${variant.language}`);
    }
  }
  return lines.join('\n');
}

export function formatCardSearch(
  items: Awaited<ReturnType<SearchCards['execute']>>['items'],
  page: number,
  hasMore: boolean,
): string {
  if (items.length === 0) {
    return 'No cards found matching your search.';
  }
  const lines = items.map(
    (item, index) =>
      `${(page - 1) * DEFAULT_PAGE_SIZE + index + 1}. **${item.name}** — ${item.setName} #${item.number}${item.rarity ? ` (${item.rarity})` : ''}`,
  );
  if (hasMore) lines.push('', `_(page ${page} — more results available; use the buttons or raise the page option)_`);
  return lines.join('\n');
}
