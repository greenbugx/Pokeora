# Pokeora

A Pokémon collection game for Discord.

Open booster packs, collect cards, build your binders, trade with other players, complete sets, and build your ultimate collection.

## ✨ Features

> 🚧 Pokeora is currently in development.

* 🎁 Open Pokémon TCG booster packs
* 📚 Collect and organize cards
* 📖 Build custom binders
* 🔎 Search card and set information
* 💰 In-game Pokécoins economy
* 🤝 Trade cards with other players
* 🏪 Player marketplace
* 🏆 Achievements and collection milestones
* 📈 Track set completion and collection progress

### Implemented so far

* ` /register` — registers a Discord player and creates their wallet (User + Wallet vertical slice)
* Pokémon TCG catalog synchronization — sets, cards, and source-backed card variants from the official [Pokémon TCG API](https://pokemontcg.io/) into PostgreSQL

## 🛠️ Tech Stack

* **TypeScript**
* **Node.js** (26+)
* **discord.js**
* **Prisma 8** (contract-first workflow: `src/prisma/contract.prisma`)
* **PostgreSQL** (15+)
* **Redis** (optional — caches exact catalog lookups and pagination contexts; PostgreSQL alone is sufficient)

## 🏗️ Architecture

Pokeora is a modular monolith with Presentation, Application, Domain, Ports, and Infrastructure layers. PostgreSQL is the authoritative store; the Pokémon TCG catalog is synchronized by a background sync worker.

See [`ARCHITECTURE.md`](./ARCHITECTURE.md) for the full system design and [`SCHEMA.md`](./SCHEMA.md) for the locked database model.

## 🚀 Development

### Prerequisites

* Node.js 26+
* pnpm (`corepack enable`)
* PostgreSQL 15+

### Setup

```bash
git clone https://github.com/greenbugx/Pokeora
cd pokeora
pnpm install
```

Create a `.env` file (see [`.env.example`](./.env.example)):

```env
DATABASE_URL=
DISCORD_TOKEN=
DISCORD_CLIENT_ID=
DISCORD_GUILD_ID=
INITIAL_POKECOINS=
POKEMON_TCG_API_BASE_URL=
POKEMON_TCG_API_KEY=
POKEMON_TCG_SOURCE_LANGUAGE=
```

Apply the database migration and synchronize the Pokémon TCG catalog:

```bash
pnpm prisma db migrate --db $DATABASE_URL
pnpm sync:cards
```

### Commands

| Command | Purpose |
| --- | --- |
| `pnpm start` | Start the Discord bot |
| `pnpm test` | Run unit + integration tests |
| `pnpm typecheck` | TypeScript compilation check |
| `pnpm contract:emit` | Regenerate Prisma contract artifacts |
| `pnpm sync:cards` | Run the card/set catalog sync worker |

## 📌 Project Status

Early stage. The database contract (27 models), the registration slice, and catalog synchronization are working end-to-end. Cards, packs, economy, marketplace, and trading are designed but not yet implemented.

## 📄 License

[MIT](./LICENSE)
