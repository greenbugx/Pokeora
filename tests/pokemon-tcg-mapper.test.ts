import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ApiResponseInvalidError, mapCard, mapSet, parseListResponse, toVariantIdentity } from '../src/infrastructure/integrations/pokemon-tcg/mapper';
import type { ApiCard, ApiSet } from '../src/infrastructure/integrations/pokemon-tcg/types';

const apiSet: ApiSet = {
  id: 'swsh4',
  name: 'Vivid Voltage',
  series: 'Sword & Shield',
  releaseDate: '2020-08-14',
  printedTotal: 185,
  total: 203,
  images: { logo: 'https://logo', symbol: 'https://symbol' },
};

const apiCard: ApiCard = {
  id: 'swsh4-25',
  name: 'Charizard',
  number: '25',
  rarity: 'Rare',
  images: { small: 'https://small', large: 'https://large' },
  set: { id: 'swsh4', name: 'Vivid Voltage', series: 'Sword & Shield' },
  tcgplayer: {
    url: 'https://tcgplayer',
    prices: { normal: { market: 1 }, holofoil: { market: 10 } },
  },
};

describe('set mapping', () => {
  it('maps API fields to the domain set', () => {
    const mapped = mapSet(apiSet);
    assert.equal(mapped.externalId, 'swsh4');
    assert.equal(mapped.name, 'Vivid Voltage');
    assert.equal(mapped.series, 'Sword & Shield');
    assert.equal(mapped.totalCards, 203);
    assert.equal(mapped.logoUrl, 'https://logo');
    assert.equal(mapped.symbolUrl, 'https://symbol');
    assert.equal(mapped.releaseDate.toString(), '2020-08-14');
  });

  it('uses total, not printedTotal', () => {
    assert.equal(mapSet(apiSet).totalCards, apiSet.total);
    assert.notEqual(mapSet(apiSet).totalCards, apiSet.printedTotal);
  });

  it('rejects a set missing required fields', () => {
    assert.throws(() => mapSet({ ...apiSet, id: '' }), ApiResponseInvalidError);
    assert.throws(() => mapSet({ ...apiSet, name: '' }), ApiResponseInvalidError);
    assert.throws(() => mapSet({ ...apiSet, releaseDate: '14-08-2020' }), ApiResponseInvalidError);
    assert.throws(() => mapSet({ ...apiSet, total: -1 }), ApiResponseInvalidError);
  });
});

describe('card mapping', () => {
  it('maps API fields to the domain card', () => {
    const mapped = mapCard(apiCard);
    assert.equal(mapped.externalId, 'swsh4-25');
    assert.equal(mapped.name, 'Charizard');
    assert.equal(mapped.number, '25');
    assert.equal(mapped.rarity, 'Rare');
    assert.equal(mapped.imageSmall, 'https://small');
    assert.equal(mapped.imageLarge, 'https://large');
    assert.equal(mapped.setExternalId, 'swsh4');
  });

  it('keeps the canonical API id as externalId', () => {
    assert.equal(mapCard(apiCard).externalId, 'swsh4-25');
  });

  it('extracts recognized pricing keys as variant evidence', () => {
    assert.deepEqual(mapCard(apiCard).variantEvidenceKeys.sort(), ['holofoil', 'normal']);
  });

  it('ignores unrecognized pricing keys', () => {
    const mapped = mapCard({
      ...apiCard,
      tcgplayer: { prices: { unlimitedHolofoil: {}, normal: {} } },
    });
    assert.deepEqual(mapped.variantEvidenceKeys, ['normal']);
  });

  it('handles cards without any pricing data', () => {
    assert.deepEqual(mapCard({ ...apiCard, tcgplayer: undefined }).variantEvidenceKeys, []);
  });

  it('rejects a card missing required fields', () => {
    assert.throws(() => mapCard({ ...apiCard, id: '' }), ApiResponseInvalidError);
    assert.throws(() => mapCard({ ...apiCard, set: { id: '' } }), ApiResponseInvalidError);
    assert.throws(() => mapCard({ ...apiCard, number: '' }), ApiResponseInvalidError);
  });
});

describe('variant evidence normalization', () => {
  it('maps recognized keys to internal labels', () => {
    assert.deepEqual(toVariantIdentity('normal'), { variantType: 'NORMAL', finish: 'NON_FOIL' });
    assert.deepEqual(toVariantIdentity('holofoil'), { variantType: 'HOLO', finish: 'HOLOFOIL' });
    assert.deepEqual(toVariantIdentity('reverseHolofoil'), { variantType: 'REVERSE_HOLO', finish: 'REVERSE_HOLOFOIL' });
    assert.deepEqual(toVariantIdentity('1stEditionNormal'), { variantType: 'FIRST_EDITION', finish: 'NON_FOIL' });
    assert.deepEqual(toVariantIdentity('1stEditionHolofoil'), { variantType: 'FIRST_EDITION', finish: 'HOLOFOIL' });
  });

  it('returns null for unrecognized keys', () => {
    assert.equal(toVariantIdentity('unlimitedHolofoil'), null);
    assert.equal(toVariantIdentity(''), null);
  });
});

describe('response envelope validation', () => {
  it('accepts a well-formed envelope', () => {
    const body = parseListResponse<ApiSet>(
      { data: [apiSet], page: 1, pageSize: 250, count: 1, totalCount: 1 },
      '/sets',
    );
    assert.equal(body.data.length, 1);
    assert.equal(body.totalCount, 1);
  });

  it('rejects malformed envelopes', () => {
    assert.throws(() => parseListResponse(null, '/sets'), ApiResponseInvalidError);
    assert.throws(() => parseListResponse({ data: {} }, '/sets'), ApiResponseInvalidError);
    assert.throws(
      () => parseListResponse({ data: [], page: 0, pageSize: 250, totalCount: 0 }, '/sets'),
      ApiResponseInvalidError,
    );
  });
});
