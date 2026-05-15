import { describe, it, expect } from 'vitest';
import { computeMissing, bucketRecipe } from './recipeMatch';
import type { Recipe, InventoryRow } from '@eat/shared';

function recipe(name: string, ingredients: { canonicalFoodId: string; foodName: string; qty: number; unit: 'g' | 'ml' | 'count' }[]): Recipe {
  return {
    id: `recipe-${name}`,
    householdId: 'h',
    name,
    servings: 2,
    sourceUrl: null,
    sourceImage: null,
    instructions: null,
    ingredients: ingredients.map((i, idx) => ({
      id: `ing-${idx}`,
      recipeId: `recipe-${name}`,
      canonicalFoodId: i.canonicalFoodId,
      foodName: i.foodName,
      qty: String(i.qty),
      unit: i.unit,
      section: null,
      metricValue: null,
      optional: false,
      sortOrder: idx,
    })),
    createdAt: '2026-05-11T00:00:00Z',
    updatedAt: '2026-05-11T00:00:00Z',
  };
}

function inv(canonicalFoodId: string, foodName: string, qty: number, unit: 'g' | 'ml' | 'count' = 'count'): InventoryRow {
  return {
    id: `inv-${canonicalFoodId}`,
    householdId: 'h',
    canonicalFoodId,
    foodName,
    qty,
    unit,
    brand: null,
    location: 'pantry',
    purchasedAt: null,
    expiresAt: null,
    createdAt: '2026-05-11T00:00:00Z',
    updatedAt: '2026-05-11T00:00:00Z',
  };
}

describe('computeMissing', () => {
  it('returns [] when every ingredient is satisfied by inventory', () => {
    const r = recipe('pasta', [
      { canonicalFoodId: 'cf-pasta', foodName: 'pasta', qty: 200, unit: 'g' },
      { canonicalFoodId: 'cf-salt',  foodName: 'salt',  qty: 5,   unit: 'g' },
    ]);
    const inventory = [
      inv('cf-pasta', 'pasta', 500, 'g'),
      inv('cf-salt',  'salt',  100, 'g'),
    ];
    expect(computeMissing(r, inventory)).toEqual([]);
  });

  it('returns the names of ingredients with no matching inventory', () => {
    const r = recipe('omelette', [
      { canonicalFoodId: 'cf-egg',    foodName: 'eggs',   qty: 3, unit: 'count' },
      { canonicalFoodId: 'cf-butter', foodName: 'butter', qty: 1, unit: 'count' },
    ]);
    const inventory = [inv('cf-egg', 'eggs', 6, 'count')];
    expect(computeMissing(r, inventory)).toEqual(['butter']);
  });

  it('returns the ingredient when inventory has less than the required qty', () => {
    const r = recipe('biscuits', [
      { canonicalFoodId: 'cf-flour', foodName: 'flour', qty: 300, unit: 'g' },
    ]);
    const inventory = [inv('cf-flour', 'flour', 100, 'g')];
    expect(computeMissing(r, inventory)).toEqual(['flour']);
  });

  it('falls back to name equality when canonicalFoodId is null', () => {
    const r = recipe('soup', [
      { canonicalFoodId: 'cf-stock', foodName: 'chicken stock', qty: 500, unit: 'ml' },
    ]);
    const inventory = [
      // Inventory item without a canonical ID (manual entry), but matching name.
      { ...inv('cf-other', 'chicken stock', 1, 'count'), canonicalFoodId: null as unknown as string },
    ];
    expect(computeMissing(r, inventory)).toEqual([]);
  });
});

describe('bucketRecipe', () => {
  it('buckets to "cookable" when missing.length === 0', () => {
    expect(bucketRecipe([])).toBe('cookable');
  });
  it('buckets to "shoppable" for 1-3 missing', () => {
    expect(bucketRecipe(['a'])).toBe('shoppable');
    expect(bucketRecipe(['a', 'b', 'c'])).toBe('shoppable');
  });
  it('buckets to "library" for 4+ missing', () => {
    expect(bucketRecipe(['a', 'b', 'c', 'd'])).toBe('library');
  });
});
