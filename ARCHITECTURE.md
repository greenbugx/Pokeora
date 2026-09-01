# OVERALL SYSTEM ARCHITECTURE

```mermaid
flowchart TB

    %% =========================
    %% CLIENTS
    %% =========================
    subgraph CLIENTS["Clients"]
        DISCORD_USER["Discord Users"]
        ADMIN["Admin / Moderator"]
    end

    %% =========================
    %% PRESENTATION / DISCORD
    %% =========================
    subgraph PRESENTATION["Presentation Layer"]
        DISCORD["Discord Bot<br/>discord.js + TypeScript"]

        COMMANDS["Slash Commands"]
        COMPONENTS["Buttons / Select Menus / Modals"]
        EVENTS["Discord Event Handlers"]

        COMMANDS --> DISCORD
        COMPONENTS --> DISCORD
        EVENTS --> DISCORD
    end

    %% =========================
    %% APPLICATION
    %% =========================
    subgraph APPLICATION["Application Layer"]

        ROUTER["Command / Interaction Router"]

        AUTH["Authorization"]
        RATE_LIMIT["Rate Limits / Cooldowns"]
        IDEMPOTENCY["Idempotency Checks"]

        CARD_APP["Card Queries"]
        COLLECTION_APP["Collection"]
        BINDER_APP["Binder"]
        PACK_APP["Pack Opening"]
        ECONOMY_APP["Economy"]
        MARKET_APP["Marketplace"]
        TRADE_APP["Trading"]
        REWARD_APP["Rewards / Achievements"]
        PROFILE_APP["Player Profile"]
    end

    %% =========================
    %% DOMAIN
    %% =========================
    subgraph DOMAIN["Domain Layer"]

        CARD["Card Domain"]
        PACK["Pack Domain"]
        COLLECTION["Collection Domain"]
        BINDER["Binder Domain"]
        ECONOMY["Economy Domain"]
        MARKET["Marketplace Domain"]
        TRADE["Trading Domain"]
        PROGRESSION["Progression Domain"]

        RNG["Secure RNG / Drop Logic"]
        OWNERSHIP["Ownership Rules"]
        TRANSACTIONS["Transaction Rules"]
    end

    %% =========================
    %% PORTS
    %% =========================
    subgraph PORTS["Domain Ports / Interfaces"]

        REPOSITORIES["Repository Interfaces"]
        EVENT_PUBLISHER["Event Publisher Interface"]
        CLOCK["Clock / Time Interface"]
    end

    %% =========================
    %% INFRASTRUCTURE
    %% =========================
    subgraph INFRA["Infrastructure Layer"]

        POSTGRES[(PostgreSQL)]
        REDIS[(Redis)]

        OUTBOX["Transactional Outbox"]
        OUTBOX_WORKER["Outbox Worker"]

        CARD_SYNC["Card / Set Sync Worker"]
        PRICE_SYNC["Price Sync Worker"]

        TCG_CLIENT["Pokémon TCG API Client"]
        PRICE_CLIENT["Pricing Provider Client"]

        OBJECT_STORAGE["Object Storage / CDN"]

        LOGGING["Logging / Observability"]
    end

    %% =========================
    %% EXTERNAL
    %% =========================
    subgraph EXTERNAL["External Services"]

        PTCG["Pokémon TCG API"]
        PRICE["Pricing Providers"]
    end

    %% =========================
    %% CLIENT FLOW
    %% =========================

    DISCORD_USER --> COMMANDS
    DISCORD_USER --> COMPONENTS
    ADMIN --> COMMANDS

    DISCORD --> ROUTER

    ROUTER --> AUTH
    AUTH --> RATE_LIMIT
    RATE_LIMIT --> IDEMPOTENCY

    IDEMPOTENCY --> CARD_APP
    IDEMPOTENCY --> COLLECTION_APP
    IDEMPOTENCY --> BINDER_APP
    IDEMPOTENCY --> PACK_APP
    IDEMPOTENCY --> ECONOMY_APP
    IDEMPOTENCY --> MARKET_APP
    IDEMPOTENCY --> TRADE_APP
    IDEMPOTENCY --> REWARD_APP
    IDEMPOTENCY --> PROFILE_APP

    %% =========================
    %% APPLICATION → DOMAIN
    %% =========================

    CARD_APP --> CARD
    COLLECTION_APP --> COLLECTION
    BINDER_APP --> BINDER
    PACK_APP --> PACK
    ECONOMY_APP --> ECONOMY
    MARKET_APP --> MARKET
    TRADE_APP --> TRADE
    REWARD_APP --> PROGRESSION
    PROFILE_APP --> PROGRESSION

    %% =========================
    %% DOMAIN RELATIONSHIPS
    %% =========================

    PACK --> RNG
    PACK --> CARD

    COLLECTION --> OWNERSHIP
    BINDER --> OWNERSHIP

    ECONOMY --> TRANSACTIONS
    MARKET --> TRANSACTIONS
    TRADE --> TRANSACTIONS

    MARKET --> CARD
    TRADE --> COLLECTION

    %% =========================
    %% DOMAIN → PORTS
    %% =========================

    CARD --> REPOSITORIES
    PACK --> REPOSITORIES
    COLLECTION --> REPOSITORIES
    BINDER --> REPOSITORIES
    ECONOMY --> REPOSITORIES
    MARKET --> REPOSITORIES
    TRADE --> REPOSITORIES
    PROGRESSION --> REPOSITORIES

    CARD --> EVENT_PUBLISHER
    PACK --> EVENT_PUBLISHER
    COLLECTION --> EVENT_PUBLISHER
    ECONOMY --> EVENT_PUBLISHER
    MARKET --> EVENT_PUBLISHER
    TRADE --> EVENT_PUBLISHER

    %% =========================
    %% INFRASTRUCTURE IMPLEMENTATION
    %% =========================

    REPOSITORIES -. cached through .-> REDIS
    REPOSITORIES -. implemented by .-> POSTGRES

    EVENT_PUBLISHER -. implemented by .-> OUTBOX

    %% =========================
    %% BACKGROUND PROCESSING
    %% =========================

%% =========================
    %% EVENT PROCESSING
    %% =========================

    subgraph EVENT_PROCESSING["Event Processing"]

        EVENT_BUS["Event Bus"]

        ACHIEVEMENTS["Achievements"]
        QUESTS["Quests"]
        STATISTICS["Statistics"]
        PROFILE["Profile"]
        NOTIFICATIONS["Notifications"]
    end

    OUTBOX --> OUTBOX_WORKER
    OUTBOX_WORKER --> EVENT_BUS

    EVENT_BUS --> ACHIEVEMENTS
    EVENT_BUS --> QUESTS
    EVENT_BUS --> STATISTICS
    EVENT_BUS --> PROFILE
    EVENT_BUS --> NOTIFICATIONS

    %% =========================
    %% DATA SYNCHRONIZATION
    %% =========================

    subgraph DATA_SYNC["Data Synchronization"]

        SCHEDULER["Scheduler"]
    end

    SCHEDULER --> CARD_SYNC
    SCHEDULER --> PRICE_SYNC

    CARD_SYNC --> TCG_CLIENT
    PRICE_SYNC --> PRICE_CLIENT

    TCG_CLIENT --> TCG["Pokémon TCG API"]
    PRICE_CLIENT --> PRICE["Pricing Providers"]

    %% =========================
    %% DATABASE
    %% =========================

    DB[(PostgreSQL)]

    CARD_SYNC --> DB
    PRICE_SYNC --> DB

    %% =========================
    %% STORAGE
    %% =========================

    CARD -. image metadata .-> OBJECT_STORAGE

    %% =========================
    %% OBSERVABILITY
    %% =========================

    DISCORD --> LOGGING
    OUTBOX_WORKER --> LOGGING
    CARD_SYNC --> LOGGING
    PRICE_SYNC --> LOGGING
    POSTGRES --> LOGGING
```

# TYPESCRIPT ARCHITECTURE

```mermaid
flowchart TB

    SRC["src/"]

    %% =========================
    %% PRESENTATION
    %% =========================

    subgraph PRESENTATION["Presentation"]

        COMMANDS["commands/"]
        COMPONENTS["components/"]
        DISCORD_EVENTS["events/"]

        COMMANDS --> APPLICATION
        COMPONENTS --> APPLICATION
        DISCORD_EVENTS --> APPLICATION
    end

    %% =========================
    %% APPLICATION
    %% =========================

    subgraph APPLICATION["Application"]

        USE_CASES["use-cases/"]

        CARD_UC["card/"]
        PACK_UC["pack/"]
        COLLECTION_UC["collection/"]
        BINDER_UC["binder/"]
        ECONOMY_UC["economy/"]
        MARKET_UC["market/"]
        TRADE_UC["trade/"]
        PROGRESSION_UC["progression/"]

        DTO["dto/"]
        POLICIES["policies/"]

        USE_CASES --> CARD_UC
        USE_CASES --> PACK_UC
        USE_CASES --> COLLECTION_UC
        USE_CASES --> BINDER_UC
        USE_CASES --> ECONOMY_UC
        USE_CASES --> MARKET_UC
        USE_CASES --> TRADE_UC
        USE_CASES --> PROGRESSION_UC
    end

    %% =========================
    %% DOMAIN
    %% =========================

    subgraph DOMAIN["Domain"]

        CARD_DOMAIN["card/"]
        PACK_DOMAIN["pack/"]
        COLLECTION_DOMAIN["collection/"]
        BINDER_DOMAIN["binder/"]
        ECONOMY_DOMAIN["economy/"]
        MARKET_DOMAIN["market/"]
        TRADE_DOMAIN["trade/"]
        PROGRESSION_DOMAIN["progression/"]

        SHARED["shared/"]
    end

    CARD_UC --> CARD_DOMAIN
    PACK_UC --> PACK_DOMAIN
    COLLECTION_UC --> COLLECTION_DOMAIN
    BINDER_UC --> BINDER_DOMAIN
    ECONOMY_UC --> ECONOMY_DOMAIN
    MARKET_UC --> MARKET_DOMAIN
    TRADE_UC --> TRADE_DOMAIN
    PROGRESSION_UC --> PROGRESSION_DOMAIN

    CARD_DOMAIN --> SHARED
    PACK_DOMAIN --> SHARED
    COLLECTION_DOMAIN --> SHARED
    BINDER_DOMAIN --> SHARED
    ECONOMY_DOMAIN --> SHARED
    MARKET_DOMAIN --> SHARED
    TRADE_DOMAIN --> SHARED
    PROGRESSION_DOMAIN --> SHARED

    %% =========================
    %% DOMAIN PORTS
    %% =========================

    subgraph PORTS["Ports / Interfaces"]

        REPOSITORIES["repositories/"]
        EVENTS["events/"]
        SERVICES["services/"]
    end

    CARD_DOMAIN --> REPOSITORIES
    PACK_DOMAIN --> REPOSITORIES
    COLLECTION_DOMAIN --> REPOSITORIES
    ECONOMY_DOMAIN --> REPOSITORIES
    MARKET_DOMAIN --> REPOSITORIES
    TRADE_DOMAIN --> REPOSITORIES
    PROGRESSION_DOMAIN --> REPOSITORIES

    DOMAIN --> EVENTS
    DOMAIN --> SERVICES

    %% =========================
    %% INFRASTRUCTURE
    %% =========================

    subgraph INFRA["Infrastructure"]

        DATABASE["database/"]
        CACHE["cache/"]
        INTEGRATIONS["integrations/"]
        STORAGE["storage/"]
        EVENT_BUS["events/"]
        WORKERS["workers/"]
        LOGGING["logging/"]

        DATABASE --> REPOSITORIES
        CACHE --> REPOSITORIES

        INTEGRATIONS --> SERVICES
        EVENT_BUS --> EVENTS
    end

    %% =========================
    %% ROOT
    %% =========================

    SRC --> PRESENTATION
    SRC --> APPLICATION
    SRC --> DOMAIN
    SRC --> INFRA
```

# COLLECTOR DOMAIN

```mermaid
erDiagram

    USER ||--o{ CARD_OWNERSHIP : owns
    CARD ||--o{ CARD_OWNERSHIP : owned_as

    CARD ||--o{ CARD_VARIANT : has
    SET ||--o{ CARD : contains

    USER ||--o{ BINDER : creates
    BINDER ||--o{ BINDER_SLOT : contains
    CARD_OWNERSHIP ||--o{ BINDER_SLOT : displayed_in

    USER ||--o{ FAVORITE_CARD : favorites
    CARD_OWNERSHIP ||--o{ FAVORITE_CARD : marked

    USER ||--o{ SET_PROGRESS : tracks
    SET ||--o{ SET_PROGRESS : has

    USER ||--o{ USER_PACK : owns
    PACK ||--o{ USER_PACK : instance_of

    USER_PACK ||--o| PACK_OPENING : opened_by

    USER {
        uuid id PK
        string discord_id UK
        string username
        timestamp created_at
        timestamp updated_at
    }

    SET {
        uuid id PK
        string external_id UK
        string name
        string series
        date release_date
        int total_cards
        string logo_url
        string symbol_url
    }

    CARD {
        uuid id PK
        string external_id UK
        uuid set_id FK
        string name
        string number
        string rarity
        string image_small
        string image_large
        timestamp created_at
        timestamp updated_at
    }

    CARD_VARIANT {
        uuid id PK
        uuid card_id FK
        string variant_type
        string finish
        string language
        boolean is_collectible
    }

    CARD_OWNERSHIP {
        uuid id PK
        uuid user_id FK
        uuid card_id FK
        uuid variant_id FK
        int quantity
        timestamp first_acquired_at
        timestamp last_acquired_at
    }

    BINDER {
        uuid id PK
        uuid user_id FK
        string name
        string description
        boolean is_public
        timestamp created_at
    }

    BINDER_SLOT {
        uuid id PK
        uuid binder_id FK
        uuid ownership_id FK
        int page
        int position
    }

    FAVORITE_CARD {
        uuid user_id FK
        uuid ownership_id FK
        timestamp created_at
    }

    SET_PROGRESS {
        uuid user_id FK
        uuid set_id FK
        int unique_cards
        int total_cards
        decimal completion_percent
        timestamp calculated_at
    }

    PACK {
        uuid id PK
        uuid set_id FK
        string name
        int price
        boolean active
    }

    USER_PACK {
        uuid id PK
        uuid user_id FK
        uuid pack_id FK
        string status
        timestamp acquired_at
        timestamp opened_at
    }

    PACK_OPENING {
        uuid id PK
        uuid user_pack_id FK
        uuid user_id FK
        jsonb result
        timestamp opened_at
    }
```

# PACK OPENING ARCHITECTURE

```mermaid
sequenceDiagram

    actor User

    participant Discord
    participant Router
    participant Auth
    participant Idempotency
    participant PackService
    participant PackEngine
    participant CardPool
    participant RNG

    participant DB
    participant Collection
    participant Outbox

    User->>Discord: /open-pack

    Discord->>Router: Interaction
    Router->>Auth: Authorize user

    Auth-->>Router: Authorized

    Router->>Idempotency: Check request

    Idempotency-->>Router: New request

    Router->>PackService: OpenPack(userPackId)

    PackService->>DB: Load USER_PACK

    DB-->>PackService: Unopened pack

    PackService->>PackEngine: Generate contents(pack)

    PackEngine->>CardPool: Load eligible pools
    CardPool-->>PackEngine: Card pools

    PackEngine->>RNG: Roll slots

    RNG-->>PackEngine: Card IDs

    PackEngine-->>PackService: Generated cards

    PackService->>DB: BEGIN TRANSACTION

    PackService->>Collection: Grant cards

    Collection->>DB: Update ownership

    PackService->>DB: Mark USER_PACK opened

    PackService->>DB: Create PACK_OPENING

    PackService->>Outbox: Create PACK_OPENED event

    Outbox->>DB: Insert outbox event

    PackService->>DB: COMMIT

    PackService-->>Discord: Pack result

    Discord-->>User: Reveal animation    
```

# PACK ENGINE

```mermaid
flowchart TD

    PACK["Pack"]

    PACK --> TEMPLATE["Pack Template"]

    TEMPLATE --> SLOTS["Pack Slots"]

    SLOTS --> SLOT1["Common Slot"]
    SLOTS --> SLOT2["Uncommon Slot"]
    SLOTS --> SLOT3["Energy Slot"]
    SLOTS --> REVERSE["Reverse / Variant Slot"]
    SLOTS --> RARE_SLOT["Rare / Hit Slot"]

    SLOT1 --> RULES1["Eligibility Rules"]
    SLOT2 --> RULES2["Eligibility Rules"]
    SLOT3 --> RULES3["Eligibility Rules"]
    REVERSE --> RULES4["Eligibility Rules"]
    RARE_SLOT --> RULES5["Eligibility Rules"]

    RULES1 --> POOL1["Card Pool"]
    RULES2 --> POOL2["Card Pool"]
    RULES3 --> POOL3["Card Pool"]
    RULES4 --> POOL4["Card Pool"]

    RULES5 --> RARITY["Rarity Distribution"]

    RARITY --> COMMON["Rare"]
    RARITY --> HOLO["Holo Rare"]
    RARITY --> ULTRA["Ultra Rare"]
    RARITY --> IR["Illustration Rare"]
    RARITY --> SIR["Special Illustration Rare"]
    RARITY --> HR["Hyper Rare"]

    COMMON --> HITPOOL["Eligible Hit Pool"]
    HOLO --> HITPOOL
    ULTRA --> HITPOOL
    IR --> HITPOOL
    SIR --> HITPOOL
    HR --> HITPOOL

    POOL1 --> SELECT["Card Selection"]
    POOL2 --> SELECT
    POOL3 --> SELECT
    POOL4 --> SELECT
    HITPOOL --> SELECT

    SELECT --> RNG["Cryptographically Secure RNG"]

    RNG --> RESULT["Pack Result"]

    RESULT --> VALIDATE["Validate Result"]

    VALIDATE --> COMPLETE["Complete Opening"]
```

# ECONOMY ARCHITECTURE

```mermaid
flowchart TD

    USER["Player"]

    USER --> WALLET["Wallet"]

    WALLET --> BALANCE["Cached Balance"]

    WALLET --> COMMAND["Economy Command"]

    COMMAND --> TRANSACTION["Create Transaction"]

    TRANSACTION --> LEDGER["Immutable Ledger"]

    LEDGER --> EARN["Credits"]

    EARN --> DAILY["Daily Reward"]
    EARN --> QUEST["Quest Reward"]
    EARN --> SALE["Card Sale"]
    EARN --> TRADE["Trade Transfer"]
    EARN --> ADMIN_CREDIT["Admin Grant"]

    LEDGER --> SPEND["Debits"]

    SPEND --> PACK["Pack Purchase"]
    SPEND --> MARKET["Marketplace Purchase"]
    SPEND --> AUCTION["Auction Payment"]
    SPEND --> FEE["Transaction Fee"]
    SPEND --> ADMIN_DEBIT["Admin Adjustment"]

    LEDGER --> UPDATE["Balance Projection"]

    UPDATE --> BALANCE

    LEDGER --> OUTBOX["Outbox Event"]

    OUTBOX --> EVENTS["Domain Event"]

    EVENTS --> ACHIEVEMENTS["Achievements"]
    EVENTS --> QUESTS["Quests"]
    EVENTS --> STATS["Statistics"]

    LEDGER --> DB[(PostgreSQL)]
    BALANCE --> DB  
```

# PACK OWNERSHIP / INVENTORY

```mermaid
flowchart LR

    USER["Player"]

    USER --> PACKS["Owned Packs"]
    USER --> CARDS["Card Collection"]

    PACKS --> PACK_INSTANCE["USER_PACK"]

    PACK_INSTANCE --> UNOPENED["Unopened"]

    UNOPENED --> OPEN["Open Pack"]

    OPEN --> PACK_OPENING["PACK_OPENING"]

    PACK_OPENING --> CARDS_GRANTED["Cards Generated"]

    CARDS_GRANTED --> COLLECTION["CARD_OWNERSHIP"]

    COLLECTION --> BINDER["Binder"]
    COLLECTION --> FAVORITE["Favorites"]
    COLLECTION --> MARKET["Marketplace"]
    COLLECTION --> TRADE["Trading"]

    MARKET --> OTHER_USER["Another Player"]
    TRADE --> OTHER_USER
```

# OUTBOX + EVENT ARCHITECTURE

```mermaid
flowchart LR

    DOMAIN["Domain Operation"]

    TX["Database Transaction"]

    DB[(PostgreSQL)]

    OUTBOX["Transactional Outbox"]

    WORKER["Outbox Worker"]

    BUS["Event Bus"]

    ACH["Achievements"]
    QUEST["Quests"]
    STATS["Statistics"]
    PROFILE["Profile"]
    NOTIFY["Notifications"]

    DOMAIN --> TX

    TX --> DB
    TX --> OUTBOX

    OUTBOX --> DB

    OUTBOX --> WORKER

    WORKER --> BUS

    BUS --> ACH
    BUS --> QUEST
    BUS --> STATS
    BUS --> PROFILE
    BUS --> NOTIFY
```

# SECURITY / REQUEST HANDLING

```mermaid
flowchart LR

    DISCORD["Discord Interaction"]

    PARSE["Parse Input"]

    AUTH["Authorization"]

    RATE["Rate Limit / Cooldown"]

    IDEMPOTENCY["Idempotency Check"]

    VALIDATE["Business Validation"]

    USECASE["Execute Use Case"]

    TRANSACTION["Database Transaction"]

    RESULT["Response"]

    DISCORD --> PARSE
    PARSE --> AUTH
    AUTH --> RATE
    RATE --> IDEMPOTENCY
    IDEMPOTENCY --> VALIDATE
    VALIDATE --> USECASE
    USECASE --> TRANSACTION
    TRANSACTION --> RESULT
    RESULT --> DISCORD
```

# MARKETPLACE + TRADING

```mermaid
flowchart TB

    USER["Player"]

    subgraph MARKET["Marketplace"]
        CREATE["Create Listing"]
        SEARCH["Search Listings"]
        BUY["Buy Listing"]
        CANCEL["Cancel Listing"]
    end

    subgraph TRADE["Trading"]
        CREATE_TRADE["Create Trade"]
        ADD_ITEMS["Add Items"]
        ACCEPT["Accept"]
        DECLINE["Decline"]
        EXPIRE["Expire"]
    end

    subgraph OWNERSHIP["Ownership"]
        COLLECTION["Card Ownership"]
    end

    subgraph ECONOMY["Economy"]
        WALLET["Wallet"]
        LEDGER["Ledger"]
    end

    USER --> CREATE
    USER --> SEARCH
    USER --> BUY
    USER --> CANCEL

    USER --> CREATE_TRADE
    USER --> ACCEPT
    USER --> DECLINE

    CREATE --> COLLECTION
    BUY --> COLLECTION
    BUY --> WALLET
    BUY --> LEDGER

    CREATE_TRADE --> ADD_ITEMS
    ADD_ITEMS --> COLLECTION

    ACCEPT --> COLLECTION
    ACCEPT --> WALLET
    ACCEPT --> LEDGER

    CANCEL --> COLLECTION
    EXPIRE --> COLLECTION
```

# EXTERNAL Pokémon DATA PIPELINE

```mermaid
flowchart LR

    SCHEDULER["Scheduler"]

    subgraph SYNC["Data Synchronization"]

        CARD_SYNC["Card / Set Sync"]
        PRICE_SYNC["Price Sync"]

        NORMALIZE["Normalize"]
        VALIDATE["Validate"]
        UPSERT["Upsert"]
    end

    subgraph SOURCE["External Sources"]

        PTCG["Pokémon TCG API"]
        PRICE["Pricing Providers"]
    end

    DB[(PostgreSQL)]

    CACHE[(Redis)]

    SCHEDULER --> CARD_SYNC
    SCHEDULER --> PRICE_SYNC

    CARD_SYNC --> PTCG
    PTCG --> NORMALIZE

    PRICE_SYNC --> PRICE
    PRICE --> NORMALIZE

    NORMALIZE --> VALIDATE
    VALIDATE --> UPSERT

    UPSERT --> DB

    DB --> CACHE
```

# DATA FLOW

```mermaid
flowchart TB

    USER["Discord Player"]

    subgraph DISCORD["Discord Layer"]
        SLASH["Slash Commands"]
        BUTTON["Buttons"]
        MODAL["Modals"]
        SELECT["Select Menus"]
    end

    subgraph APPLICATION["Application Layer"]
        CARD_APP["Card Queries"]
        PACK_APP["Pack Opening"]
        COLLECTION_APP["Collection"]
        BINDER_APP["Binder"]
        ECONOMY_APP["Economy"]
        MARKET_APP["Marketplace"]
        TRADE_APP["Trading"]
        PROFILE_APP["Profile"]
        REWARD_APP["Rewards"]
    end

    subgraph DOMAIN["Domain Layer"]
        CARD_DOMAIN["Card Model"]
        PACK_DOMAIN["Pack Engine"]
        COLLECTION_DOMAIN["Collection Engine"]
        BINDER_DOMAIN["Binder Engine"]
        ECONOMY_DOMAIN["Economy Engine"]
        MARKET_DOMAIN["Marketplace Engine"]
        TRADE_DOMAIN["Trade Engine"]
        PROGRESSION_DOMAIN["Progression Engine"]
    end

    subgraph INFRASTRUCTURE["Infrastructure"]
        REPO["Repositories"]
        CACHE["Redis Cache"]
        EVENTS["Domain Events"]
        JOBS["Background Jobs"]
    end

    subgraph DATABASE["Database"]
        POSTGRES["PostgreSQL"]
    end

    subgraph EXTERNAL["External Data"]
        POKEMON["Pokémon TCG API"]
        PRICES["Price Sources"]
    end

    USER --> SLASH
    USER --> BUTTON
    USER --> MODAL
    USER --> SELECT

    SLASH --> CARD_APP
    SLASH --> PACK_APP
    SLASH --> COLLECTION_APP
    SLASH --> BINDER_APP
    SLASH --> ECONOMY_APP
    SLASH --> MARKET_APP
    SLASH --> TRADE_APP
    SLASH --> PROFILE_APP
    SLASH --> REWARD_APP

    BUTTON --> PACK_APP
    BUTTON --> TRADE_APP
    BUTTON --> MARKET_APP

    CARD_APP --> CARD_DOMAIN
    PACK_APP --> PACK_DOMAIN
    COLLECTION_APP --> COLLECTION_DOMAIN
    BINDER_APP --> BINDER_DOMAIN
    ECONOMY_APP --> ECONOMY_DOMAIN
    MARKET_APP --> MARKET_DOMAIN
    TRADE_APP --> TRADE_DOMAIN
    REWARD_APP --> PROGRESSION_DOMAIN

    CARD_DOMAIN --> REPO
    PACK_DOMAIN --> REPO
    COLLECTION_DOMAIN --> REPO
    BINDER_DOMAIN --> REPO
    ECONOMY_DOMAIN --> REPO
    MARKET_DOMAIN --> REPO
    TRADE_DOMAIN --> REPO
    PROGRESSION_DOMAIN --> REPO

    REPO --> POSTGRES

    CARD_DOMAIN --> CACHE
    PACK_DOMAIN --> CACHE

    PACK_DOMAIN --> EVENTS
    ECONOMY_DOMAIN --> EVENTS
    MARKET_DOMAIN --> EVENTS
    TRADE_DOMAIN --> EVENTS
    COLLECTION_DOMAIN --> EVENTS

    EVENTS --> PROGRESSION_DOMAIN

    JOBS --> POKEMON
    JOBS --> PRICES
    JOBS --> POSTGRES    
```

# EVENT-DRIVEN PROGRESSION

```mermaid
flowchart LR

    PACK["PACK_OPENED"]
    CARD["CARD_ACQUIRED"]
    RARE["RARE_CARD_ACQUIRED"]
    SET["SET_COMPLETED"]
    TRADE["TRADE_COMPLETED"]
    MARKET["MARKETPLACE_SALE"]

    OUTBOX["Transactional Outbox"]

    BUS["Event Bus"]

    ACH["Achievement Engine"]
    QUEST["Quest Engine"]
    STATS["Statistics Engine"]
    PROFILE["Profile Engine"]

    PACK --> OUTBOX
    CARD --> OUTBOX
    RARE --> OUTBOX
    SET --> OUTBOX
    TRADE --> OUTBOX
    MARKET --> OUTBOX

    OUTBOX --> BUS

    BUS --> ACH
    BUS --> QUEST
    BUS --> STATS
    BUS --> PROFILE
```

# FINAL ARCHITECTURE DESIGN

```mermaid
flowchart TB

    %% =========================================
    %% DISCORD
    %% =========================================

    USER["Discord Player"]

    subgraph PRESENTATION["PRESENTATION"]
        DISCORD["Discord Bot"]
        COMMANDS["Commands"]
        COMPONENTS["Buttons / Menus / Modals"]
    end

    USER --> DISCORD

    DISCORD --> COMMANDS
    DISCORD --> COMPONENTS

    %% =========================================
    %% APPLICATION
    %% =========================================

    subgraph APPLICATION["APPLICATION LAYER"]

        SECURITY["Authorization / Rate Limits / Idempotency"]

        USECASES["Use Cases"]

        CARD_UC["Cards"]
        PACK_UC["Packs"]
        COLLECTION_UC["Collection"]
        BINDER_UC["Binder"]
        ECONOMY_UC["Economy"]
        MARKET_UC["Marketplace"]
        TRADE_UC["Trading"]
        PROGRESSION_UC["Progression"]
    end

    COMMANDS --> SECURITY
    COMPONENTS --> SECURITY

    SECURITY --> USECASES

    USECASES --> CARD_UC
    USECASES --> PACK_UC
    USECASES --> COLLECTION_UC
    USECASES --> BINDER_UC
    USECASES --> ECONOMY_UC
    USECASES --> MARKET_UC
    USECASES --> TRADE_UC
    USECASES --> PROGRESSION_UC

    %% =========================================
    %% DOMAIN
    %% =========================================

    subgraph DOMAIN["DOMAIN LAYER"]

        CARD["Card Domain"]
        PACK["Pack Domain"]
        COLLECTION["Collection Domain"]
        BINDER["Binder Domain"]
        ECONOMY["Economy Domain"]
        MARKET["Marketplace Domain"]
        TRADE["Trading Domain"]
        PROGRESSION["Progression Domain"]

        RNG["Secure RNG"]
        OWNERSHIP["Ownership Rules"]
        LEDGER["Transaction Rules"]
    end

    CARD_UC --> CARD
    PACK_UC --> PACK
    COLLECTION_UC --> COLLECTION
    BINDER_UC --> BINDER
    ECONOMY_UC --> ECONOMY
    MARKET_UC --> MARKET
    TRADE_UC --> TRADE
    PROGRESSION_UC --> PROGRESSION

    PACK --> RNG
    COLLECTION --> OWNERSHIP
    BINDER --> OWNERSHIP
    ECONOMY --> LEDGER
    MARKET --> LEDGER
    TRADE --> LEDGER

    %% =========================================
    %% PORTS
    %% =========================================

    subgraph PORTS["DOMAIN PORTS"]

        REPOSITORIES["Repository Interfaces"]
        EVENTS["Event Publisher"]
        CLOCK["Clock / Time"]
    end

    CARD --> REPOSITORIES
    PACK --> REPOSITORIES
    COLLECTION --> REPOSITORIES
    BINDER --> REPOSITORIES
    ECONOMY --> REPOSITORIES
    MARKET --> REPOSITORIES
    TRADE --> REPOSITORIES
    PROGRESSION --> REPOSITORIES

    PACK --> EVENTS
    COLLECTION --> EVENTS
    ECONOMY --> EVENTS
    MARKET --> EVENTS
    TRADE --> EVENTS

    %% =========================================
    %% INFRASTRUCTURE
    %% =========================================

    subgraph INFRA["INFRASTRUCTURE"]

        DB[(PostgreSQL)]
        CACHE[(Redis)]

        OUTBOX["Transactional Outbox"]
        OUTBOX_WORKER["Outbox Worker"]
        EVENT_BUS["Event Bus"]

        CARD_SYNC["Card / Set Sync Worker"]
        PRICE_SYNC["Price Sync Worker"]

        API["Pokémon TCG API Client"]
        PRICES["Pricing Provider Client"]

        STORAGE["Object Storage / CDN"]
        OBS["Logging / Metrics / Tracing"]
    end

    REPOSITORIES -. implemented by .-> DB
    REPOSITORIES -. cached through .-> CACHE

    EVENTS -. implemented by .-> OUTBOX

    %% =========================================
    %% EVENT PIPELINE
    %% =========================================

    OUTBOX --> OUTBOX_WORKER
    OUTBOX_WORKER --> EVENT_BUS
    EVENT_BUS --> PROGRESS["Achievements / Quests / Stats"]

    %% =========================================
    %% DATA SYNC
    %% =========================================

    CARD_SYNC --> API
    PRICE_SYNC --> PRICES

    API --> TCG["Pokémon TCG API"]
    PRICES --> PRICE["Price Providers"]

    CARD_SYNC --> DB
    PRICE_SYNC --> DB

    %% =========================================
    %% STORAGE
    %% =========================================

    CARD --> STORAGE

    %% =========================================
    %% OBSERVABILITY
    %% =========================================

    DISCORD --> OBS
    OUTBOX_WORKER --> OBS
    CARD_SYNC --> OBS
    PRICE_SYNC --> OBS
    DB --> OBS
```
