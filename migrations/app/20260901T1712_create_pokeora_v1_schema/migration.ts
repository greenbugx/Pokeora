#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/713a26d29757409eb7713a15e34f042cdc579d910569fe3ee9a791f1f6bfb32b/contract';
import endContract from '../../snapshots/713a26d29757409eb7713a15e34f042cdc579d910569fe3ee9a791f1f6bfb32b/contract.json' with { type: 'json' };
import {
  Migration,
  MigrationCLI,
  checkExpression,
  col,
  fn,
  primaryKey,
} from '@prisma/orm-postgres/migration';

export default class M extends Migration<never, End> {
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createSchema({ schema: 'public' }),
      this.createTable({
        schema: 'public',
        table: 'achievement',
        columns: [
          col('active', 'bool', { notNull: true, codecRef: { codecId: 'pg/bool@1' } }),
          col('criteria', 'jsonb', { notNull: true, codecRef: { codecId: 'pg/jsonb@1' } }),
          col('description', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', '"uuid"', {
            notNull: true,
            codecRef: { codecId: 'pg/uuid@1', typeParams: {} },
          }),
          col('key', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('reward', 'int8', { notNull: true, codecRef: { codecId: 'pg/int8@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'binder',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('description', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', '"uuid"', {
            notNull: true,
            codecRef: { codecId: 'pg/uuid@1', typeParams: {} },
          }),
          col('isPublic', 'bool', { notNull: true, codecRef: { codecId: 'pg/bool@1' } }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('userId', '"uuid"', {
            notNull: true,
            codecRef: { codecId: 'pg/uuid@1', typeParams: {} },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'binderSlot',
        columns: [
          col('binderId', '"uuid"', {
            notNull: true,
            codecRef: { codecId: 'pg/uuid@1', typeParams: {} },
          }),
          col('id', '"uuid"', {
            notNull: true,
            codecRef: { codecId: 'pg/uuid@1', typeParams: {} },
          }),
          col('ownershipId', '"uuid"', {
            notNull: true,
            codecRef: { codecId: 'pg/uuid@1', typeParams: {} },
          }),
          col('page', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('position', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression('binder_slot_page_nonnegative_4d7c2ab8', 'page >= 0'),
          checkExpression('binder_slot_position_nonnegative_c03c2ccb', 'position >= 0'),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'card',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('externalId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', '"uuid"', {
            notNull: true,
            codecRef: { codecId: 'pg/uuid@1', typeParams: {} },
          }),
          col('imageLarge', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('imageSmall', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('number', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('rarity', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('setId', '"uuid"', {
            notNull: true,
            codecRef: { codecId: 'pg/uuid@1', typeParams: {} },
          }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'cardOwnership',
        columns: [
          col('condition', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('firstAcquiredAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('id', '"uuid"', {
            notNull: true,
            codecRef: { codecId: 'pg/uuid@1', typeParams: {} },
          }),
          col('lastAcquiredAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('quantity', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('userId', '"uuid"', {
            notNull: true,
            codecRef: { codecId: 'pg/uuid@1', typeParams: {} },
          }),
          col('variantId', '"uuid"', {
            notNull: true,
            codecRef: { codecId: 'pg/uuid@1', typeParams: {} },
          }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression('card_ownership_quantity_positive_4402679f', 'quantity > 0'),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'cardPrice',
        columns: [
          col('currency', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('high', 'numeric(10,2)', {
            notNull: true,
            codecRef: { codecId: 'pg/numeric@1', typeParams: { precision: 10, scale: 2 } },
          }),
          col('id', '"uuid"', {
            notNull: true,
            codecRef: { codecId: 'pg/uuid@1', typeParams: {} },
          }),
          col('low', 'numeric(10,2)', {
            notNull: true,
            codecRef: { codecId: 'pg/numeric@1', typeParams: { precision: 10, scale: 2 } },
          }),
          col('market', 'numeric(10,2)', {
            notNull: true,
            codecRef: { codecId: 'pg/numeric@1', typeParams: { precision: 10, scale: 2 } },
          }),
          col('mid', 'numeric(10,2)', {
            notNull: true,
            codecRef: { codecId: 'pg/numeric@1', typeParams: { precision: 10, scale: 2 } },
          }),
          col('recordedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('source', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('variantId', '"uuid"', {
            notNull: true,
            codecRef: { codecId: 'pg/uuid@1', typeParams: {} },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'cardVariant',
        columns: [
          col('cardId', '"uuid"', {
            notNull: true,
            codecRef: { codecId: 'pg/uuid@1', typeParams: {} },
          }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('finish', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', '"uuid"', {
            notNull: true,
            codecRef: { codecId: 'pg/uuid@1', typeParams: {} },
          }),
          col('isCollectible', 'bool', { notNull: true, codecRef: { codecId: 'pg/bool@1' } }),
          col('language', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('variantType', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'favoriteCard',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('ownershipId', '"uuid"', {
            notNull: true,
            codecRef: { codecId: 'pg/uuid@1', typeParams: {} },
          }),
          col('userId', '"uuid"', {
            notNull: true,
            codecRef: { codecId: 'pg/uuid@1', typeParams: {} },
          }),
        ],
        constraints: [primaryKey(['userId', 'ownershipId'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'idempotencyKey',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('expiresAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('key', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('operation', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('response', 'jsonb', { notNull: true, codecRef: { codecId: 'pg/jsonb@1' } }),
          col('userId', '"uuid"', {
            notNull: true,
            codecRef: { codecId: 'pg/uuid@1', typeParams: {} },
          }),
        ],
        constraints: [primaryKey(['key'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'ledgerEntry',
        columns: [
          col('amount', 'int8', { notNull: true, codecRef: { codecId: 'pg/int8@1' } }),
          col('balanceAfter', 'int8', { notNull: true, codecRef: { codecId: 'pg/int8@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('description', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', '"uuid"', {
            notNull: true,
            codecRef: { codecId: 'pg/uuid@1', typeParams: {} },
          }),
          col('referenceId', '"uuid"', {
            notNull: true,
            codecRef: { codecId: 'pg/uuid@1', typeParams: {} },
          }),
          col('referenceType', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('type', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('walletId', '"uuid"', {
            notNull: true,
            codecRef: { codecId: 'pg/uuid@1', typeParams: {} },
          }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression('ledger_entry_amount_nonzero_8af7f6c8', 'amount != 0'),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'marketListing',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('expiresAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('id', '"uuid"', {
            notNull: true,
            codecRef: { codecId: 'pg/uuid@1', typeParams: {} },
          }),
          col('ownershipId', '"uuid"', {
            notNull: true,
            codecRef: { codecId: 'pg/uuid@1', typeParams: {} },
          }),
          col('price', 'int8', { notNull: true, codecRef: { codecId: 'pg/int8@1' } }),
          col('quantity', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('sellerId', '"uuid"', {
            notNull: true,
            codecRef: { codecId: 'pg/uuid@1', typeParams: {} },
          }),
          col('status', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'marketListing_status_check_72091938',
            "\"status\" IN ('active', 'sold', 'cancelled', 'expired')",
          ),
          checkExpression('market_listing_price_nonnegative_faabb23d', 'price >= 0'),
          checkExpression('market_listing_quantity_positive_4402679f', 'quantity > 0'),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'marketTransaction',
        columns: [
          col('buyerId', '"uuid"', {
            notNull: true,
            codecRef: { codecId: 'pg/uuid@1', typeParams: {} },
          }),
          col('id', '"uuid"', {
            notNull: true,
            codecRef: { codecId: 'pg/uuid@1', typeParams: {} },
          }),
          col('listingId', '"uuid"', {
            notNull: true,
            codecRef: { codecId: 'pg/uuid@1', typeParams: {} },
          }),
          col('price', 'int8', { notNull: true, codecRef: { codecId: 'pg/int8@1' } }),
          col('purchasedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('sellerId', '"uuid"', {
            notNull: true,
            codecRef: { codecId: 'pg/uuid@1', typeParams: {} },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'outboxEvent',
        columns: [
          col('attempts', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('eventType', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', '"uuid"', {
            notNull: true,
            codecRef: { codecId: 'pg/uuid@1', typeParams: {} },
          }),
          col('payload', 'jsonb', { notNull: true, codecRef: { codecId: 'pg/jsonb@1' } }),
          col('processedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-temporal@1' } }),
          col('status', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('userId', '"uuid"', {
            notNull: true,
            codecRef: { codecId: 'pg/uuid@1', typeParams: {} },
          }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'outboxEvent_status_check_29e2c2cd',
            "\"status\" IN ('pending', 'processed', 'failed')",
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'pack',
        columns: [
          col('active', 'bool', { notNull: true, codecRef: { codecId: 'pg/bool@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('id', '"uuid"', {
            notNull: true,
            codecRef: { codecId: 'pg/uuid@1', typeParams: {} },
          }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('price', 'int8', { notNull: true, codecRef: { codecId: 'pg/int8@1' } }),
          col('setId', '"uuid"', {
            notNull: true,
            codecRef: { codecId: 'pg/uuid@1', typeParams: {} },
          }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression('pack_price_nonnegative_faabb23d', 'price >= 0'),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'packOpening',
        columns: [
          col('id', '"uuid"', {
            notNull: true,
            codecRef: { codecId: 'pg/uuid@1', typeParams: {} },
          }),
          col('openedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('result', 'jsonb', { notNull: true, codecRef: { codecId: 'pg/jsonb@1' } }),
          col('userId', '"uuid"', {
            notNull: true,
            codecRef: { codecId: 'pg/uuid@1', typeParams: {} },
          }),
          col('userPackId', '"uuid"', {
            notNull: true,
            codecRef: { codecId: 'pg/uuid@1', typeParams: {} },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'packSlot',
        columns: [
          col('count', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('id', '"uuid"', {
            notNull: true,
            codecRef: { codecId: 'pg/uuid@1', typeParams: {} },
          }),
          col('packId', '"uuid"', {
            notNull: true,
            codecRef: { codecId: 'pg/uuid@1', typeParams: {} },
          }),
          col('position', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('slotType', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression('pack_slot_count_positive_2202e1ab', 'count > 0'),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'packSlotRule',
        columns: [
          col('id', '"uuid"', {
            notNull: true,
            codecRef: { codecId: 'pg/uuid@1', typeParams: {} },
          }),
          col('packSlotId', '"uuid"', {
            notNull: true,
            codecRef: { codecId: 'pg/uuid@1', typeParams: {} },
          }),
          col('rarity', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('variantType', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('weight', 'numeric', { notNull: true, codecRef: { codecId: 'pg/numeric@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression('pack_slot_rule_weight_positive_7c35b28d', 'weight > 0'),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'quest',
        columns: [
          col('active', 'bool', { notNull: true, codecRef: { codecId: 'pg/bool@1' } }),
          col('criteria', 'jsonb', { notNull: true, codecRef: { codecId: 'pg/jsonb@1' } }),
          col('description', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', '"uuid"', {
            notNull: true,
            codecRef: { codecId: 'pg/uuid@1', typeParams: {} },
          }),
          col('key', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('reward', 'int8', { notNull: true, codecRef: { codecId: 'pg/int8@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'set',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('externalId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', '"uuid"', {
            notNull: true,
            codecRef: { codecId: 'pg/uuid@1', typeParams: {} },
          }),
          col('logoUrl', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('releaseDate', 'date', {
            notNull: true,
            codecRef: { codecId: 'pg/date-temporal@1' },
          }),
          col('series', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('symbolUrl', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('totalCards', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'setProgress',
        columns: [
          col('calculatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('completionPercent', 'numeric', {
            notNull: true,
            codecRef: { codecId: 'pg/numeric@1' },
          }),
          col('setId', '"uuid"', {
            notNull: true,
            codecRef: { codecId: 'pg/uuid@1', typeParams: {} },
          }),
          col('totalCards', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('uniqueCards', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('userId', '"uuid"', {
            notNull: true,
            codecRef: { codecId: 'pg/uuid@1', typeParams: {} },
          }),
        ],
        constraints: [primaryKey(['userId', 'setId'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'trade',
        columns: [
          col('completedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-temporal@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('expiresAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('id', '"uuid"', {
            notNull: true,
            codecRef: { codecId: 'pg/uuid@1', typeParams: {} },
          }),
          col('initiatorId', '"uuid"', {
            notNull: true,
            codecRef: { codecId: 'pg/uuid@1', typeParams: {} },
          }),
          col('receiverId', '"uuid"', {
            notNull: true,
            codecRef: { codecId: 'pg/uuid@1', typeParams: {} },
          }),
          col('status', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'trade_status_check_dd593ee5',
            "\"status\" IN ('pending', 'accepted', 'declined', 'expired')",
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'tradeItem',
        columns: [
          col('id', '"uuid"', {
            notNull: true,
            codecRef: { codecId: 'pg/uuid@1', typeParams: {} },
          }),
          col('ownershipId', '"uuid"', {
            notNull: true,
            codecRef: { codecId: 'pg/uuid@1', typeParams: {} },
          }),
          col('quantity', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('tradeId', '"uuid"', {
            notNull: true,
            codecRef: { codecId: 'pg/uuid@1', typeParams: {} },
          }),
          col('userId', '"uuid"', {
            notNull: true,
            codecRef: { codecId: 'pg/uuid@1', typeParams: {} },
          }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression('trade_item_quantity_positive_4402679f', 'quantity > 0'),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'user',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('discordId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', '"uuid"', {
            notNull: true,
            codecRef: { codecId: 'pg/uuid@1', typeParams: {} },
          }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('username', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'userAchievement',
        columns: [
          col('achievementId', '"uuid"', {
            notNull: true,
            codecRef: { codecId: 'pg/uuid@1', typeParams: {} },
          }),
          col('earnedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('userId', '"uuid"', {
            notNull: true,
            codecRef: { codecId: 'pg/uuid@1', typeParams: {} },
          }),
        ],
        constraints: [primaryKey(['userId', 'achievementId'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'userPack',
        columns: [
          col('acquiredAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('id', '"uuid"', {
            notNull: true,
            codecRef: { codecId: 'pg/uuid@1', typeParams: {} },
          }),
          col('openedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-temporal@1' } }),
          col('packId', '"uuid"', {
            notNull: true,
            codecRef: { codecId: 'pg/uuid@1', typeParams: {} },
          }),
          col('status', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('userId', '"uuid"', {
            notNull: true,
            codecRef: { codecId: 'pg/uuid@1', typeParams: {} },
          }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression('userPack_status_check_77934cc0', "\"status\" IN ('unopened', 'opened')"),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'userQuest',
        columns: [
          col('completedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-temporal@1' } }),
          col('id', '"uuid"', {
            notNull: true,
            codecRef: { codecId: 'pg/uuid@1', typeParams: {} },
          }),
          col('progress', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('questId', '"uuid"', {
            notNull: true,
            codecRef: { codecId: 'pg/uuid@1', typeParams: {} },
          }),
          col('startedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('status', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('userId', '"uuid"', {
            notNull: true,
            codecRef: { codecId: 'pg/uuid@1', typeParams: {} },
          }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'userQuest_status_check_87fdcf45',
            "\"status\" IN ('active', 'completed')",
          ),
          checkExpression('user_quest_progress_nonnegative_af0dfc79', 'progress >= 0'),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'wallet',
        columns: [
          col('balance', 'int8', { notNull: true, codecRef: { codecId: 'pg/int8@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('id', '"uuid"', {
            notNull: true,
            codecRef: { codecId: 'pg/uuid@1', typeParams: {} },
          }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('userId', '"uuid"', {
            notNull: true,
            codecRef: { codecId: 'pg/uuid@1', typeParams: {} },
          }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression('wallet_balance_nonnegative_f70191a8', 'balance >= 0'),
        ],
      }),
      this.addUnique({
        schema: 'public',
        table: 'achievement',
        constraint: 'achievement_key_key',
        columns: ['key'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'binderSlot',
        constraint: 'binderSlot_binderId_page_position_key',
        columns: ['binderId', 'page', 'position'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'card',
        constraint: 'card_externalId_key',
        columns: ['externalId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'cardOwnership',
        constraint: 'cardOwnership_userId_variantId_condition_key',
        columns: ['userId', 'variantId', 'condition'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'cardVariant',
        constraint: 'cardVariant_cardId_variantType_finish_language_key',
        columns: ['cardId', 'variantType', 'finish', 'language'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'marketTransaction',
        constraint: 'marketTransaction_listingId_key',
        columns: ['listingId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'packOpening',
        constraint: 'packOpening_userPackId_key',
        columns: ['userPackId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'packSlot',
        constraint: 'packSlot_packId_position_key',
        columns: ['packId', 'position'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'quest',
        constraint: 'quest_key_key',
        columns: ['key'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'set',
        constraint: 'set_externalId_key',
        columns: ['externalId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'user',
        constraint: 'user_discordId_key',
        columns: ['discordId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'wallet',
        constraint: 'wallet_userId_key',
        columns: ['userId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'binder',
        index: 'binder_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'binderSlot',
        index: 'binderSlot_binderId_idx_d828ce2a',
        columns: ['binderId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'binderSlot',
        index: 'binderSlot_ownershipId_idx_3189ae1b',
        columns: ['ownershipId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'card',
        index: 'card_name_idx_ce87e6ba',
        columns: ['name'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'card',
        index: 'card_rarity_idx_30c24a18',
        columns: ['rarity'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'card',
        index: 'card_setId_idx_02759a07',
        columns: ['setId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'cardOwnership',
        index: 'cardOwnership_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'cardOwnership',
        index: 'cardOwnership_variantId_idx_e16bb45d',
        columns: ['variantId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'cardPrice',
        index: 'cardPrice_variantId_idx_e16bb45d',
        columns: ['variantId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'cardPrice',
        index: 'cardPrice_variantId_recordedAt_idx_8024aa5e',
        columns: ['variantId', 'recordedAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'cardVariant',
        index: 'cardVariant_cardId_idx_c511c1e1',
        columns: ['cardId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'favoriteCard',
        index: 'favoriteCard_ownershipId_idx_3189ae1b',
        columns: ['ownershipId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'favoriteCard',
        index: 'favoriteCard_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'idempotencyKey',
        index: 'idempotencyKey_expiresAt_idx_6b6b8c10',
        columns: ['expiresAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'idempotencyKey',
        index: 'idempotencyKey_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'ledgerEntry',
        index: 'ledgerEntry_walletId_createdAt_idx_5931d2fb',
        columns: ['walletId', 'createdAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'ledgerEntry',
        index: 'ledgerEntry_walletId_idx_2e003173',
        columns: ['walletId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'marketListing',
        index: 'marketListing_ownershipId_idx_3189ae1b',
        columns: ['ownershipId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'marketListing',
        index: 'marketListing_sellerId_idx_d71255f2',
        columns: ['sellerId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'marketListing',
        index: 'marketListing_status_idx_e98638ab',
        columns: ['status'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'marketTransaction',
        index: 'marketTransaction_buyerId_idx_80be0de9',
        columns: ['buyerId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'marketTransaction',
        index: 'marketTransaction_sellerId_idx_d71255f2',
        columns: ['sellerId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'outboxEvent',
        index: 'outboxEvent_status_createdAt_idx_58610442',
        columns: ['status', 'createdAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'outboxEvent',
        index: 'outboxEvent_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'pack',
        index: 'pack_setId_idx_02759a07',
        columns: ['setId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'packOpening',
        index: 'packOpening_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'packSlot',
        index: 'packSlot_packId_idx_dbc38f09',
        columns: ['packId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'packSlotRule',
        index: 'packSlotRule_packSlotId_idx_762ee53b',
        columns: ['packSlotId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'setProgress',
        index: 'setProgress_setId_idx_02759a07',
        columns: ['setId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'setProgress',
        index: 'setProgress_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'trade',
        index: 'trade_initiatorId_idx_ce3a20ce',
        columns: ['initiatorId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'trade',
        index: 'trade_initiatorId_status_idx_e06ef5cf',
        columns: ['initiatorId', 'status'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'trade',
        index: 'trade_receiverId_idx_fe124f44',
        columns: ['receiverId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'trade',
        index: 'trade_receiverId_status_idx_1f8f1a2b',
        columns: ['receiverId', 'status'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'tradeItem',
        index: 'tradeItem_ownershipId_idx_3189ae1b',
        columns: ['ownershipId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'tradeItem',
        index: 'tradeItem_tradeId_idx_448002f6',
        columns: ['tradeId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'tradeItem',
        index: 'tradeItem_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'userAchievement',
        index: 'userAchievement_achievementId_idx_05a27a05',
        columns: ['achievementId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'userAchievement',
        index: 'userAchievement_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'userPack',
        index: 'userPack_packId_idx_dbc38f09',
        columns: ['packId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'userPack',
        index: 'userPack_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'userPack',
        index: 'userPack_userId_status_idx_e4a128ba',
        columns: ['userId', 'status'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'userQuest',
        index: 'userQuest_questId_idx_516cf617',
        columns: ['questId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'userQuest',
        index: 'userQuest_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'userQuest',
        index: 'userQuest_userId_status_idx_e4a128ba',
        columns: ['userId', 'status'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'binder',
        foreignKey: {
          name: 'binder_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'user', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'binderSlot',
        foreignKey: {
          name: 'binderSlot_binderId_fkey',
          columns: ['binderId'],
          references: { schema: 'public', table: 'binder', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'binderSlot',
        foreignKey: {
          name: 'binderSlot_ownershipId_fkey',
          columns: ['ownershipId'],
          references: { schema: 'public', table: 'cardOwnership', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'card',
        foreignKey: {
          name: 'card_setId_fkey',
          columns: ['setId'],
          references: { schema: 'public', table: 'set', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'cardOwnership',
        foreignKey: {
          name: 'cardOwnership_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'user', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'cardOwnership',
        foreignKey: {
          name: 'cardOwnership_variantId_fkey',
          columns: ['variantId'],
          references: { schema: 'public', table: 'cardVariant', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'cardPrice',
        foreignKey: {
          name: 'cardPrice_variantId_fkey',
          columns: ['variantId'],
          references: { schema: 'public', table: 'cardVariant', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'cardVariant',
        foreignKey: {
          name: 'cardVariant_cardId_fkey',
          columns: ['cardId'],
          references: { schema: 'public', table: 'card', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'favoriteCard',
        foreignKey: {
          name: 'favoriteCard_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'user', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'favoriteCard',
        foreignKey: {
          name: 'favoriteCard_ownershipId_fkey',
          columns: ['ownershipId'],
          references: { schema: 'public', table: 'cardOwnership', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'idempotencyKey',
        foreignKey: {
          name: 'idempotencyKey_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'user', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'ledgerEntry',
        foreignKey: {
          name: 'ledgerEntry_walletId_fkey',
          columns: ['walletId'],
          references: { schema: 'public', table: 'wallet', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'marketListing',
        foreignKey: {
          name: 'marketListing_sellerId_fkey',
          columns: ['sellerId'],
          references: { schema: 'public', table: 'user', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'marketListing',
        foreignKey: {
          name: 'marketListing_ownershipId_fkey',
          columns: ['ownershipId'],
          references: { schema: 'public', table: 'cardOwnership', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'marketTransaction',
        foreignKey: {
          name: 'marketTransaction_listingId_fkey',
          columns: ['listingId'],
          references: { schema: 'public', table: 'marketListing', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'marketTransaction',
        foreignKey: {
          name: 'marketTransaction_buyerId_fkey',
          columns: ['buyerId'],
          references: { schema: 'public', table: 'user', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'marketTransaction',
        foreignKey: {
          name: 'marketTransaction_sellerId_fkey',
          columns: ['sellerId'],
          references: { schema: 'public', table: 'user', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'outboxEvent',
        foreignKey: {
          name: 'outboxEvent_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'user', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'pack',
        foreignKey: {
          name: 'pack_setId_fkey',
          columns: ['setId'],
          references: { schema: 'public', table: 'set', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'packOpening',
        foreignKey: {
          name: 'packOpening_userPackId_fkey',
          columns: ['userPackId'],
          references: { schema: 'public', table: 'userPack', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'packOpening',
        foreignKey: {
          name: 'packOpening_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'user', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'packSlot',
        foreignKey: {
          name: 'packSlot_packId_fkey',
          columns: ['packId'],
          references: { schema: 'public', table: 'pack', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'packSlotRule',
        foreignKey: {
          name: 'packSlotRule_packSlotId_fkey',
          columns: ['packSlotId'],
          references: { schema: 'public', table: 'packSlot', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'setProgress',
        foreignKey: {
          name: 'setProgress_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'user', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'setProgress',
        foreignKey: {
          name: 'setProgress_setId_fkey',
          columns: ['setId'],
          references: { schema: 'public', table: 'set', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'trade',
        foreignKey: {
          name: 'trade_initiatorId_fkey',
          columns: ['initiatorId'],
          references: { schema: 'public', table: 'user', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'trade',
        foreignKey: {
          name: 'trade_receiverId_fkey',
          columns: ['receiverId'],
          references: { schema: 'public', table: 'user', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'tradeItem',
        foreignKey: {
          name: 'tradeItem_tradeId_fkey',
          columns: ['tradeId'],
          references: { schema: 'public', table: 'trade', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'tradeItem',
        foreignKey: {
          name: 'tradeItem_ownershipId_fkey',
          columns: ['ownershipId'],
          references: { schema: 'public', table: 'cardOwnership', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'tradeItem',
        foreignKey: {
          name: 'tradeItem_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'user', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'userAchievement',
        foreignKey: {
          name: 'userAchievement_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'user', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'userAchievement',
        foreignKey: {
          name: 'userAchievement_achievementId_fkey',
          columns: ['achievementId'],
          references: { schema: 'public', table: 'achievement', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'userPack',
        foreignKey: {
          name: 'userPack_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'user', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'userPack',
        foreignKey: {
          name: 'userPack_packId_fkey',
          columns: ['packId'],
          references: { schema: 'public', table: 'pack', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'userQuest',
        foreignKey: {
          name: 'userQuest_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'user', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'userQuest',
        foreignKey: {
          name: 'userQuest_questId_fkey',
          columns: ['questId'],
          references: { schema: 'public', table: 'quest', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'wallet',
        foreignKey: {
          name: 'wallet_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'user', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
