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

import { computeMeals } from './homeDerivations';
import type { MealPlanEntry, Recipe } from '@eat/shared';

function recipe(id: string, ingredients: { name: string; canonicalFoodId: string; qty: number }[]): Recipe {
  return {
    id,
    householdId: 'h-1',
    name: `Recipe ${id}`,
    servings: 4,
    sourceUrl: null,
    sourceImage: null,
    instructions: null,
    ingredients: ingredients.map((ing, i) => ({
      id: `${id}-ing-${i}`,
      recipeId: id,
      canonicalFoodId: ing.canonicalFoodId,
      foodName: ing.name,
      qty: ing.qty,
      unit: 'count',
      optional: false,
      sortOrder: i,
    })),
    createdAt: '2026-05-12T00:00:00Z',
    updatedAt: '2026-05-12T00:00:00Z',
  };
}

function entry(date: string, recipeId: string): MealPlanEntry {
  return {
    id: `entry-${date}`,
    mealPlanId: 'plan-1',
    date,
    recipeId,
    recipeName: `Recipe ${recipeId}`,
    servings: 4,
    status: 'planned',
  };
}

describe('computeMeals', () => {
  // Anchor today to a known weekday so day labels are deterministic.
  const today = new Date('2026-05-11T08:00:00'); // Monday

  it('returns 5 cells starting today with correct short day labels', () => {
    const meals = computeMeals([], {}, [], today);
    expect(meals.map((m) => m.dayLabel)).toEqual(['mon', 'tue', 'wed', 'thu', 'fri']);
    expect(meals[0].isToday).toBe(true);
    expect(meals[1].isToday).toBe(false);
  });

  it('marks days with no entry as open', () => {
    const meals = computeMeals([], {}, [], today);
    expect(meals.every((m) => m.kind === 'open')).toBe(true);
  });

  it('marks a day cook when inventory covers every ingredient', () => {
    const r = recipe('r1', [{ name: 'salt', canonicalFoodId: 'cf-salt', qty: 1 }]);
    const inv = [{
      id: 'i1', householdId: 'h-1', canonicalFoodId: 'cf-salt', foodName: 'salt',
      qty: 100, unit: 'g' as const, brand: null, location: 'pantry' as const,
      purchasedAt: null, expiresAt: null,
      createdAt: '2026-05-12T00:00:00Z', updatedAt: '2026-05-12T00:00:00Z',
    }];
    const meals = computeMeals([entry('2026-05-11', 'r1')], { r1: r }, inv, today);
    expect(meals[0].kind).toBe('cook');
  });

  it('marks a day shop with missingCount when ingredients are missing', () => {
    const r = recipe('r1', [
      { name: 'salt',  canonicalFoodId: 'cf-salt',  qty: 1 },
      { name: 'flour', canonicalFoodId: 'cf-flour', qty: 1 },
    ]);
    const meals = computeMeals([entry('2026-05-11', 'r1')], { r1: r }, [], today);
    expect(meals[0].kind).toBe('shop');
    if (meals[0].kind === 'shop') expect(meals[0].missingCount).toBe(2);
  });

  it('falls back to open when the recipe is not in the recipesById map yet', () => {
    // Happens while individual useRecipe queries are still loading.
    const meals = computeMeals([entry('2026-05-11', 'r1')], {}, [], today);
    expect(meals[0].kind).toBe('open');
  });
});

import { coveragePill } from './homeDerivations';
import type { MealCellStatus } from './homeDerivations';

describe('coveragePill', () => {
  const mk = (kinds: ('cook' | 'shop' | 'open')[]): MealCellStatus[] => {
    const longDays = ['mon', 'tue', 'wed', 'thu', 'fri'];
    return kinds.map((k, i) => {
      const base = { isToday: i === 0, dayLabel: longDays[i] };
      if (k === 'cook') return { kind: 'cook', recipe: { id: `r${i}`, name: 'r' }, ...base };
      if (k === 'shop') return { kind: 'shop', recipe: { id: `r${i}`, name: 'r' }, missingCount: 1, ...base };
      return { kind: 'open', ...base };
    });
  };

  it('returns null when day 1 is not cook (hidden)', () => {
    expect(coveragePill(mk(['shop', 'cook', 'cook', 'cook', 'cook']))).toBeNull();
    expect(coveragePill(mk(['open', 'cook', 'cook', 'cook', 'cook']))).toBeNull();
  });

  it('uses long form for a single-day run', () => {
    expect(coveragePill(mk(['cook', 'shop', 'open', 'open', 'open']))).toBe(
      'you have what you need for monday',
    );
  });

  it('joins first & last with & for a 2+ day run', () => {
    expect(coveragePill(mk(['cook', 'cook', 'shop', 'open', 'open']))).toBe(
      'you have what you need for monday & tuesday',
    );
    expect(coveragePill(mk(['cook', 'cook', 'cook', 'shop', 'open']))).toBe(
      'you have what you need for monday & wednesday',
    );
  });

  it('stops the run at the first open day', () => {
    expect(coveragePill(mk(['cook', 'open', 'cook', 'cook', 'cook']))).toBe(
      'you have what you need for monday',
    );
  });

  it('covers a 5-day all-cook run', () => {
    expect(coveragePill(mk(['cook', 'cook', 'cook', 'cook', 'cook']))).toBe(
      'you have what you need for monday & friday',
    );
  });
});
