import { describe, expect, it } from 'vitest';
import { amountInUnit, subtractAmount } from './food-amounts.js';

describe('food amount conversion', () => {
  const garlic = { densityGPerMl: null, countToGrams: 5 };

  it('converts inventory counts to grams with a food-specific average weight', () => {
    expect(amountInUnit({ qty: 2, unit: 'count' }, 'g', garlic)).toBe(10);
  });

  it('converts gram deductions back to count inventory units', () => {
    expect(subtractAmount(
      { qty: 3, unit: 'count' },
      { qty: 10, unit: 'g' },
      garlic,
    )).toEqual({ deductedQty: 2, remainingQty: 1 });
  });

  it('returns null when units cannot be compared', () => {
    expect(amountInUnit({ qty: 1, unit: 'count' }, 'ml', { densityGPerMl: null, countToGrams: null })).toBeNull();
  });
});
