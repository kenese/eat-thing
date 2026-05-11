import { describe, it, expect } from 'vitest';
import { computeExpiring } from './homeDerivations';
import type { InventoryRow } from '@eat/shared';

function inv(partial: Partial<InventoryRow>): InventoryRow {
  return {
    id: partial.id ?? 'inv-1',
    householdId: 'h-1',
    canonicalFoodId: partial.canonicalFoodId ?? 'cf-1',
    foodName: partial.foodName ?? 'thing',
    qty: partial.qty ?? 1,
    unit: partial.unit ?? 'count',
    brand: null,
    location: 'fridge',
    purchasedAt: null,
    expiresAt: partial.expiresAt ?? null,
    createdAt: '2026-05-12T00:00:00Z',
    updatedAt: '2026-05-12T00:00:00Z',
  };
}

describe('computeExpiring', () => {
  const today = new Date('2026-05-12T08:00:00');

  it('sorts by daysLeft ascending and caps at 4', () => {
    const items = [
      inv({ id: 'a', foodName: 'a', expiresAt: '2026-05-15' }), // 3d
      inv({ id: 'b', foodName: 'b', expiresAt: '2026-05-13' }), // 1d
      inv({ id: 'c', foodName: 'c', expiresAt: '2026-05-14' }), // 2d
      inv({ id: 'd', foodName: 'd', expiresAt: '2026-05-12' }), // 0d
      inv({ id: 'e', foodName: 'e', expiresAt: '2026-05-16' }), // 4d
      inv({ id: 'f', foodName: 'f', expiresAt: '2026-05-17' }), // 5d
    ];
    const result = computeExpiring(items, today);
    expect(result.rows.map((r) => r.name)).toEqual(['d', 'b', 'c', 'a']);
    expect(result.totalCount).toBe(6);
  });

  it('ignores items without expires_at', () => {
    const items = [inv({ foodName: 'a' }), inv({ foodName: 'b', expiresAt: '2026-05-13' })];
    const result = computeExpiring(items, today);
    expect(result.rows.map((r) => r.name)).toEqual(['b']);
    expect(result.totalCount).toBe(1);
  });

  it('formats qty + unit into a single string', () => {
    const items = [inv({ foodName: 'milk', qty: 500, unit: 'ml', expiresAt: '2026-05-13' })];
    const result = computeExpiring(items, today);
    expect(result.rows[0].qtyDisplay).toBe('500 ml');
    expect(result.rows[0].daysLeft).toBe(1);
  });
});
