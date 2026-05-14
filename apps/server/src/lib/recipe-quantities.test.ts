import { describe, expect, it } from 'vitest';
import { normalizeRecipeAmount } from './recipe-quantities.js';

describe('normalizeRecipeAmount', () => {
  it('keeps numeric canonical recipe amounts comparable for shopping list math', () => {
    expect(normalizeRecipeAmount('1 1/2', 'cups')).toEqual({ qty: 375, unit: 'ml' });
    expect(normalizeRecipeAmount('400', 'g')).toEqual({ qty: 400, unit: 'g' });
    expect(normalizeRecipeAmount('2', '')).toEqual({ qty: 2, unit: 'count' });
  });

  it('returns null for free-form recipe amounts that cannot be used arithmetically', () => {
    expect(normalizeRecipeAmount('to taste', '')).toBeNull();
    expect(normalizeRecipeAmount('', 'pinch')).toBeNull();
  });
});
