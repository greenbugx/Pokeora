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

## 🛠️ Tech Stack

* **TypeScript**
* **Node.js**
* **discord.js**
* **PostgreSQL**
* **Redis**

## 🏗️ Architecture

Pokeora is designed as a modular TypeScript application with separate application, domain, and infrastructure layers.

See [`ARCHITECTURE.md`](./ARCHITECTURE.md) for the full system design.

## 🚀 Development

### Prerequisites

* Node.js
* PostgreSQL
* Redis

### Setup

```bash
git clone https://github.com/greenbugx/Pokeora
cd pokeora
npm install
```

Create a `.env` file:

```env
DISCORD_TOKEN=
DISCORD_CLIENT_ID=
DATABASE_URL=
REDIS_URL=
POKEMON_TCG_API_KEY=
```

Then start the development server:

```bash
npm run dev
```

## 📌 Project Status

Pokeora is an early-stage project.

> [!NOTE]
> The architecture and core systems are being actively designed.

## 📄 License

License information will be added later.
