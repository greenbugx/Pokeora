import type { CatalogSource, SourceCard, SourcePage, SourceSet } from '../../../application/use-cases/sync/catalog-source';
import { mapCard, mapSet } from './mapper';
import { PokemonTcgClient } from './client';

/**
 * Adapts the Pokémon TCG HTTP client to the application's CatalogSource
 * port: one mapped page at a time, so pages are consumed and released
 * sequentially and memory stays bounded.
 */
export class PokemonTcgCatalogSource implements CatalogSource {
  private readonly client: PokemonTcgClient;

  constructor(client: PokemonTcgClient) {
    this.client = client;
  }

  async *sets(): AsyncGenerator<SourcePage<SourceSet>> {
    for await (const apiPage of this.client.setPages()) {
      yield this.toPage(apiPage.page, apiPage.pageSize, apiPage.totalCount, apiPage.data, mapSet);
    }
  }

  async *cards(): AsyncGenerator<SourcePage<SourceCard>> {
    for await (const apiPage of this.client.cardPages()) {
      yield this.toPage(apiPage.page, apiPage.pageSize, apiPage.totalCount, apiPage.data, mapCard);
    }
  }

  private toPage<TIn, TOut>(
    page: number,
    pageSize: number,
    totalCount: number,
    items: TIn[],
    mapItem: (item: TIn) => TOut,
  ): SourcePage<TOut> {
    return { page, pageSize, totalCount, items: items.map(mapItem) };
  }
}
