import { describe, expect, it } from 'vitest';
import { deriveLowStockStaples } from './low-stock-staples.js';

describe('deriveLowStockStaples', () => {
  it('returns only staples that are below threshold after unit conversion', () => {
    const lowStock = deriveLowStockStaples(
      [
        {
          id: 'staple-flour',
          householdId: 'hh-1',
          canonicalFoodId: 'food-flour',
          foodName: 'Flour',
          thresholdQty: 1000,
          thresholdUnit: 'g',
          densityGPerMl: null,
          countToGrams: null,
        },
        {
          id: 'staple-milk',
          householdId: 'hh-1',
          canonicalFoodId: 'food-milk',
          foodName: 'Milk',
          thresholdQty: 2,
          thresholdUnit: 'count',
          densityGPerMl: null,
          countToGrams: null,
        },
      ],
      [
        { canonicalFoodId: 'food-flour', qty: 0.25, unit: 'count' },
        { canonicalFoodId: 'food-flour', qty: 400, unit: 'g' },
        { canonicalFoodId: 'food-milk', qty: 2, unit: 'count' },
      ],
    );

    expect(lowStock).toEqual([
      {
        id: 'staple-flour',
        householdId: 'hh-1',
        canonicalFoodId: 'food-flour',
        foodName: 'Flour',
        thresholdQty: 1000,
        thresholdUnit: 'g',
        currentQty: 400,
        neededQty: 600,
      },
    ]);
  });

  it('uses food-specific conversions when comparing inventory to thresholds', () => {
    const lowStock = deriveLowStockStaples(
      [
        {
          id: 'staple-stock',
          householdId: 'hh-1',
          canonicalFoodId: 'food-stock',
          foodName: 'Stock',
          thresholdQty: 1500,
          thresholdUnit: 'ml',
          densityGPerMl: 1,
          countToGrams: null,
        },
      ],
      [
        { canonicalFoodId: 'food-stock', qty: 1, unit: 'count' },
        { canonicalFoodId: 'food-stock', qty: 500, unit: 'g' },
      ],
    );

    expect(lowStock).toEqual([
      {
        id: 'staple-stock',
        householdId: 'hh-1',
        canonicalFoodId: 'food-stock',
        foodName: 'Stock',
        thresholdQty: 1500,
        thresholdUnit: 'ml',
        currentQty: 500,
        neededQty: 1000,
      },
    ]);
  });
});
