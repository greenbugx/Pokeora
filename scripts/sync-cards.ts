import 'dotenv/config';
import { loadConfig } from '../src/infrastructure/config/config';
import { createConsoleLogger } from '../src/infrastructure/logging/logger';
import { transactional } from '../src/infrastructure/database/prisma/client';
import { PrismaSetRepository } from '../src/infrastructure/database/repositories/prisma-set.repository';
import { PrismaCardRepository } from '../src/infrastructure/database/repositories/prisma-card.repository';
import { PrismaCardVariantRepository } from '../src/infrastructure/database/repositories/prisma-card-variant.repository';
import { PokemonTcgClient } from '../src/infrastructure/integrations/pokemon-tcg/client';
import { PokemonTcgCatalogSource } from '../src/infrastructure/integrations/pokemon-tcg/catalog-source';
import { TcgPlayerVariantEvidencePolicy } from '../src/infrastructure/integrations/pokemon-tcg/variant-evidence-policy';
import { CardSyncWorker } from '../src/infrastructure/workers/card-sync/card-sync.worker';

const logger = createConsoleLogger();

async function main(): Promise<void> {
  const config = loadConfig();

  const client = new PokemonTcgClient({
    baseUrl: config.pokemonTcgApiBaseUrl,
    ...(config.pokemonTcgApiKey ? { apiKey: config.pokemonTcgApiKey } : {}),
  });

  const worker = new CardSyncWorker({
    unitOfWork: { transactional },
    setRepository: new PrismaSetRepository(),
    cardRepository: new PrismaCardRepository(),
    cardVariantRepository: new PrismaCardVariantRepository(),
    source: new PokemonTcgCatalogSource(client),
    variantPolicy: new TcgPlayerVariantEvidencePolicy(),
    sourceLanguage: config.pokemonTcgSourceLanguage,
    logger,
  });

  await worker.run();
}

main()
  .then(() => import('../src/prisma/db').then(({ db }) => db.close()))
  .catch((error: unknown) => {
    logger.error('sync.script_failed', {
      error: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
    });
    process.exitCode = 1;
  });
