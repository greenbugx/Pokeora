export interface AppConfig {
  databaseUrl: string;
  discordToken: string;
  discordClientId: string;
  /** When set, slash commands are registered to this guild only (faster for dev builds). */
  discordGuildId?: string;
  initialPokecoins: bigint;
  /** Pokémon TCG API access. */
  pokemonTcgApiBaseUrl: string;
  pokemonTcgApiKey?: string;
  /** Assumed language of the source dataset (EN default; not API-asserted). */
  pokemonTcgSourceLanguage: string;
  /** Optional Redis for exact-lookup caching and pagination contexts. */
  redisUrl?: string;
}

export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigurationError';
  }
}

function requireString(env: NodeJS.ProcessEnv, key: string): string {
  const value = env[key];
  if (!value || value.trim().length === 0) {
    throw new ConfigurationError(`Missing required environment variable: ${key}`);
  }
  return value.trim();
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const rawInitialPokecoins = requireString(env, 'INITIAL_POKECOINS');
  if (!/^\d+$/.test(rawInitialPokecoins)) {
    throw new ConfigurationError('INITIAL_POKECOINS must be a non-negative integer');
  }

  return {
    databaseUrl: requireString(env, 'DATABASE_URL'),
    discordToken: requireString(env, 'DISCORD_TOKEN'),
    discordClientId: requireString(env, 'DISCORD_CLIENT_ID'),
    discordGuildId: env['DISCORD_GUILD_ID']?.trim() || undefined,
    initialPokecoins: BigInt(rawInitialPokecoins),
    pokemonTcgApiBaseUrl: env['POKEMON_TCG_API_BASE_URL']?.trim() || 'https://api.pokemontcg.io/v2',
    pokemonTcgApiKey: env['POKEMON_TCG_API_KEY']?.trim() || undefined,
    pokemonTcgSourceLanguage: env['POKEMON_TCG_SOURCE_LANGUAGE']?.trim() || 'EN',
    redisUrl: env['REDIS_URL']?.trim() || undefined,
  };
}
