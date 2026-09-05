import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type ButtonInteraction,
} from 'discord.js';
import type {
  CatalogPageContextStore,
  CatalogPageKind,
  CatalogCardPageQuery,
  CatalogSetPageQuery,
} from '../../application/use-cases/catalog/pagination-context-store';
import type { SearchCards } from '../../application/use-cases/catalog/card-queries';
import type { SearchSets } from '../../application/use-cases/catalog/set-queries';
import { formatCardSearch } from './card';
import { formatSetSearch } from './set';

export const PAGE_CUSTOM_ID_PREFIX = 'pg:';

/**
 * Builds the Previous/Next row for a paginated catalog listing. The custom ID
 * carries only `pg:<kind>:<context id>:<page>` — the query itself lives in the
 * pagination context store with a TTL so the component stays well within
 * Discord's custom-ID limits.
 */
export function buildPageRow(
  kind: CatalogPageKind,
  contextId: string,
  page: number,
  hasMore: boolean,
): ActionRowBuilder<ButtonBuilder> | null {
  const buttons: ButtonBuilder[] = [];
  if (page > 1) {
    buttons.push(
      new ButtonBuilder()
        .setCustomId(`${PAGE_CUSTOM_ID_PREFIX}${kind}:${contextId}:${page - 1}`)
        .setLabel('◀ Prev')
        .setStyle(ButtonStyle.Secondary),
    );
  }
  if (hasMore) {
    buttons.push(
      new ButtonBuilder()
        .setCustomId(`${PAGE_CUSTOM_ID_PREFIX}${kind}:${contextId}:${page + 1}`)
        .setLabel('Next ▶')
        .setStyle(ButtonStyle.Secondary),
    );
  }
  if (buttons.length === 0) return null;
  return new ActionRowBuilder<ButtonBuilder>().addComponents(...buttons);
}

export function parsePageCustomId(
  customId: string,
): { kind: CatalogPageKind; contextId: string; page: number } | null {
  if (!customId.startsWith(PAGE_CUSTOM_ID_PREFIX)) return null;
  const parts = customId.split(':');
  if (parts.length !== 4) return null;
  const [, kind, contextId, pageRaw] = parts;
  if (kind !== 'card' && kind !== 'set') return null;
  if (!/^[a-f0-9]+$/.test(contextId)) return null;
  const page = Number.parseInt(pageRaw, 10);
  if (!Number.isInteger(page) || page < 1) return null;
  return { kind, contextId, page };
}

export async function saveCardPageContext(
  store: CatalogPageContextStore,
  userId: string,
  query: CatalogCardPageQuery,
): Promise<string | null> {
  return store.save({ userId, kind: 'card', query });
}

export async function saveSetPageContext(
  store: CatalogPageContextStore,
  userId: string,
  query: CatalogSetPageQuery,
): Promise<string | null> {
  return store.save({ userId, kind: 'set', query });
}

/**
 * Handles a pagination button press: re-runs the stored query at the
 * requested page and edits the original message. Expired contexts and
 * foreign-user presses get safe ephemeral replies; the original message is
 * never crashed or left partially updated.
 */
export async function handlePageButton(
  interaction: ButtonInteraction,
  store: CatalogPageContextStore,
  searchCards: SearchCards,
  searchSets: SearchSets,
): Promise<void> {
  const parsed = parsePageCustomId(interaction.customId);
  if (!parsed) return;

  const context = await store.load(parsed.contextId);
  if (!context) {
    await interaction.reply({
      content: 'This catalog view has expired. Run the command again.',
      ephemeral: true,
    });
    return;
  }
  if (context.userId !== interaction.user.id) {
    await interaction.reply({
      content: 'This catalog view belongs to another user.',
      ephemeral: true,
    });
    return;
  }

  if (context.kind === 'card') {
    const result = await searchCards.execute({ ...context.query, page: parsed.page });
    const row = buildPageRow('card', parsed.contextId, result.page, result.hasMore);
    await interaction.update({
      content: formatCardSearch(result.items, result.page, result.hasMore),
      ...(row ? { components: [row] } : {}),
    });
  } else {
    const result = await searchSets.execute({ ...context.query, page: parsed.page });
    const row = buildPageRow('set', parsed.contextId, result.page, result.hasMore);
    await interaction.update({
      content: formatSetSearch(result.items, result.page, result.hasMore),
      ...(row ? { components: [row] } : {}),
    });
  }
}
