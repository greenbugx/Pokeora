import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  AcquireOwnership,
  MAX_OWNERSHIP_ADJUSTMENT,
  RemoveOwnership,
} from '../src/application/use-cases/collection/ownership-mutations';
import {
  InsufficientOwnershipError,
  InvalidConditionError,
  InvalidOwnershipQuantityError,
  NonCollectibleVariantError,
  OwnershipNotFoundError,
  OwnershipUnavailableError,
  UserNotFoundError,
  VariantNotFoundError,
} from '../src/application/use-cases/collection/collection-errors';
import type {
  AcquireOwnershipOutcome,
  OwnershipRepository,
  ReleaseOwnershipOutcome,
} from '../src/domain/collection/ports/ownership-repository';
import type { CollectionEntryRecord, OwnershipRecord } from '../src/domain/collection/entities/ownership';
import { Temporal } from '@js-temporal/polyfill';

const instant = (iso: string) => Temporal.Instant.from(iso);

const fullRecord: CollectionEntryRecord = {
  id: 'own-1',
  userId: 'user-1',
  variantId: 'variant-1',
  quantity: 2,
  condition: 'NM',
  firstAcquiredAt: instant('2026-01-01T00:00:00Z'),
  lastAcquiredAt: instant('2026-01-02T00:00:00Z'),
  variantType: 'NORMAL',
  finish: 'NON_FOIL',
  language: 'EN',
  cardExternalId: 'swsh4-25',
  cardName: 'Charizard',
  cardNumber: '25',
  rarity: 'Rare',
  imageSmall: 'https://small',
  setExternalId: 'swsh4',
  setName: 'Vivid Voltage',
  setSeries: 'Sword & Shield',
};

function fakeRepo(overrides: Partial<OwnershipRepository> = {}): OwnershipRepository {
  return {
    findByIdForUser: async () => fullRecord,
    findByUserAndVariant: async () => [fullRecord],
    findCollectionPage: async () => [fullRecord],
    acquire: async () => ({ outcome: 'acquired', record: fullRecord }),
    release: async () => 'partial',
    ...overrides,
  };
}

const unitOfWork = { transactional: <T>(work: () => Promise<T>) => work() };

describe('AcquireOwnership validation', () => {
  const cases: Array<[string, number]> = [
    ['zero', 0],
    ['negative', -1],
    ['decimal', 1.5],
    ['over maximum', MAX_OWNERSHIP_ADJUSTMENT + 1],
  ];
  for (const [name, quantity] of cases) {
    it(`rejects ${name} quantity`, async () => {
      const repo = fakeRepo();
      await assert.rejects(
        new AcquireOwnership({ ownershipRepository: repo, unitOfWork }).execute({
          userId: 'user-1', variantId: 'variant-1', condition: 'NM', quantity,
        }),
        InvalidOwnershipQuantityError,
      );
      assert.equal(Object.keys(repo).length > 0, true);
    });
  }

  it('rejects NaN and non-finite quantities', async () => {
    const repo = fakeRepo();
    for (const quantity of [Number.NaN, Number.POSITIVE_INFINITY]) {
      await assert.rejects(
        new AcquireOwnership({ ownershipRepository: repo, unitOfWork }).execute({
          userId: 'user-1', variantId: 'v', condition: 'NM', quantity,
        }),
        InvalidOwnershipQuantityError,
      );
    }
  });

  it('rejects an empty condition and does not invent a default', async () => {
    const repo = fakeRepo();
    for (const condition of ['', '   ']) {
      await assert.rejects(
        new AcquireOwnership({ ownershipRepository: repo, unitOfWork }).execute({
          userId: 'user-1', variantId: 'v', condition, quantity: 1,
        }),
        InvalidConditionError,
      );
    }
  });

  it('translates variant outcomes into controlled errors', async () => {
    const outcomes: AcquireOwnershipOutcome['outcome'][] = ['variant-not-found', 'not-collectible', 'user-not-found'];
    for (const outcome of outcomes) {
      const repo = fakeRepo({ acquire: async () => ({ outcome } as AcquireOwnershipOutcome) });
      const expected =
        outcome === 'variant-not-found' ? VariantNotFoundError
        : outcome === 'not-collectible' ? NonCollectibleVariantError
        : UserNotFoundError;
      await assert.rejects(
        new AcquireOwnership({ ownershipRepository: repo, unitOfWork }).execute({
          userId: 'user-1', variantId: 'v', condition: 'NM', quantity: 1,
        }),
        expected,
      );
    }
  });

  it('wraps repository crashes as OwnershipUnavailable', async () => {
    const repo = fakeRepo({ acquire: async () => { throw new Error('db down'); } });
    await assert.rejects(
      new AcquireOwnership({ ownershipRepository: repo, unitOfWork }).execute({
        userId: 'user-1', variantId: 'v', condition: 'NM', quantity: 1,
      }),
      OwnershipUnavailableError,
    );
  });
});

describe('RemoveOwnership semantics', () => {
  it('reports partial removal with the authoritative post-state quantity', async () => {
    const repo = fakeRepo({
      release: async (): Promise<ReleaseOwnershipOutcome> => 'partial',
      findByIdForUser: async () => ({ ...fullRecord, quantity: 2 }),
    });
    const result = await new RemoveOwnership({ ownershipRepository: repo, unitOfWork }).execute({
      userId: 'user-1', ownershipId: 'own-1', quantity: 1,
    });
    assert.deepEqual(result, { outcome: 'partial', quantity: 2 });
  });

  it('reports full removal', async () => {
    const repo = fakeRepo({ release: async (): Promise<ReleaseOwnershipOutcome> => 'removed' });
    const result = await new RemoveOwnership({ ownershipRepository: repo, unitOfWork }).execute({
      userId: 'user-1', ownershipId: 'own-1', quantity: 2,
    });
    assert.deepEqual(result, { outcome: 'removed' });
  });

  it('keeps insufficient and missing distinct', async () => {
    const repo = fakeRepo({ release: async (): Promise<ReleaseOwnershipOutcome> => 'insufficient' });
    await assert.rejects(
      new RemoveOwnership({ ownershipRepository: repo, unitOfWork }).execute({
        userId: 'user-1', ownershipId: 'own-1', quantity: 5,
      }),
      InsufficientOwnershipError,
    );

    const missingRepo = fakeRepo({ release: async (): Promise<ReleaseOwnershipOutcome> => 'not-found' });
    await assert.rejects(
      new RemoveOwnership({ ownershipRepository: missingRepo, unitOfWork }).execute({
        userId: 'user-1', ownershipId: 'ghost', quantity: 1,
      }),
      OwnershipNotFoundError,
    );
  });

  it('rejects invalid quantities before touching the repository', async () => {
    const repo = fakeRepo({
      release: async () => {
        throw new Error('must not be called');
      },
    });
    await assert.rejects(
      new RemoveOwnership({ ownershipRepository: repo, unitOfWork }).execute({
        userId: 'user-1', ownershipId: 'own-1', quantity: 0,
      }),
      InvalidOwnershipQuantityError,
    );
  });

  it('rejects removal beyond available quantity with InsufficientOwnership', async () => {
    // Simulated through the repo contract: release reports insufficient.
    const repo = fakeRepo({ release: async (): Promise<ReleaseOwnershipOutcome> => 'insufficient' });
    await assert.rejects(
      new RemoveOwnership({ ownershipRepository: repo, unitOfWork }).execute({
        userId: 'user-1', ownershipId: 'own-1', quantity: 5,
      }),
      InsufficientOwnershipError,
    );
  });
});
