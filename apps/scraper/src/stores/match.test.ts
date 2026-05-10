import { describe, it, expect } from 'vitest';
import { pickMatch, type SearchResult } from './match.js';

const item = { id: 'i1', name: 'Eggs', canonicalFoodId: 'cf-eggs' };

const preferredEgg: SearchResult = { sku: 'NW-001', name: 'Free Range Eggs Size 7 (12 pk)', brand: 'Mainland', price: 7.49, inStock: true };
const otherEgg: SearchResult     = { sku: 'NW-002', name: 'Cage Eggs Size 6 (10 pk)',         brand: 'Pams',     price: 4.99, inStock: true };
const unrelated: SearchResult    = { sku: 'NW-099', name: 'Egg Noodles 250g',                  brand: 'Pams',     price: 2.20, inStock: true };

describe('pickMatch', () => {
  it('prefers a result whose brand matches the preferred map for this canonical food', () => {
    const result = pickMatch({
      item,
      candidates: [unrelated, otherEgg, preferredEgg],
      preferredBrandsByCanonicalFood: { 'cf-eggs': new Set(['Mainland']) },
    });
    expect(result?.sku).toBe('NW-001');
  });

  it('falls back to best name match when no preferred brand matches', () => {
    const result = pickMatch({
      item,
      candidates: [unrelated, otherEgg],
      preferredBrandsByCanonicalFood: {},
    });
    expect(result?.sku).toBe('NW-002');
  });

  it('returns null when no candidate is plausible', () => {
    const noisy: SearchResult[] = [{ sku: 'NW-500', name: 'Toilet Paper 12pk', brand: null, price: 9.99, inStock: true }];
    const result = pickMatch({ item, candidates: noisy, preferredBrandsByCanonicalFood: {} });
    expect(result).toBeNull();
  });

  it('returns null on empty candidates', () => {
    const result = pickMatch({ item, candidates: [], preferredBrandsByCanonicalFood: {} });
    expect(result).toBeNull();
  });
});
