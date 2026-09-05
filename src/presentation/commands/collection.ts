import type { ChatInputCommandInteraction } from 'discord.js';
import { SlashCommandBuilder } from 'discord.js';
import type { GetCollection } from '../../application/use-cases/collection/get-collection';
import type { CatalogPageContextStore } from '../../application/use-cases/catalog/pagination-context-store';
import { UnregisteredUserError } from '../../application/use-cases/collection/collection-errors';
import { DEFAULT_PAGE_SIZE } from '../../application/use-cases/catalog/pagination';
import { buildPageRow, PAGE_CUSTOM_ID_PREFIX } from './catalog-pagination';

export const collectionCommandDefinition = new SlashCommandBuilder()
  .setName('collection')
  .setDescription('View your Pokeora card collection.')
  .addIntegerOption((option) =>
    option.setName('page').setDescription('Result page (default 1)').setRequired(false),
  )
  .toJSON();

/**
 * /collection is strictly read-only: it resolves the current Discord
 * user, reads one bounded page, and never creates users or ownership.
 */
export async function executeCollectionCommand(
  interaction: ChatInputCommandInteraction,
  getCollection: GetCollection,
  pageContextStore: CatalogPageContextStore,
): Promise<void> {
  const page = interaction.options.getInteger('page') ?? 1;

  try {
    const result = await getCollection.execute({
      discordId: interaction.user.id,
      ...(page !== 1 ? { page } : {}),
    });

    let components;
    if (result.items.length > 0 && (result.hasMore || result.page > 1)) {
      const contextId = await pageContextStore.save({
        userId: interaction.user.id,
        kind: 'collection',
        query: { discordId: interaction.user.id },
      });
      if (contextId) {
        const row = buildPageRow('collection', contextId, result.page, result.hasMore);
        if (row) components = [row];
      }
    }

    await interaction.reply({
      content: formatCollection(result.items, result.page, result.hasMore),
      ephemeral: true,
      ...(components ? { components } : {}),
    });
  } catch (error) {
    if (error instanceof UnregisteredUserError) {
      await interaction.reply({
        content: "👋 You're not registered yet — use /register first.",
        ephemeral: true,
      });
      return;
    }
    throw error;
  }
}

export function formatCollection(
  items: Awaited<ReturnType<GetCollection['execute']>>['items'],
  page: number,
  hasMore: boolean,
): string {
  if (items.length === 0) {
    return 'Your collection is empty. Acquire some cards to get started!';
  }
  const lines = [`**Your Collection** — page ${page}`, ''];
  items.forEach((item, index) => {
    lines.push(
      `${(page - 1) * DEFAULT_PAGE_SIZE + index + 1}. **${item.cardName}** — ${item.setName} · #${item.cardNumber}`,
      `   ${[item.rarity, item.finish].filter(Boolean).join(' · ')} · ${item.variantType} · Condition: ${item.condition} · ×${item.quantity}`,
    );
  });
  if (hasMore) lines.push('', `_(page ${page} — more results available)_`);
  return lines.join('\n');
}

export { PAGE_CUSTOM_ID_PREFIX };
