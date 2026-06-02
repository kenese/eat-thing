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
    category: 'dairy',
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
    totalTimeMinutes: null,
    tags: [],
    ingredients: ingredients.map((ing, i) => ({
      id: `${id}-ing-${i}`,
      recipeId: id,
      canonicalFoodId: ing.canonicalFoodId,
      foodName: ing.name,
      qty: String(ing.qty),
      unit: 'count',
      section: null,
      metricValue: null,
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
      qty: 100, unit: 'g' as const, brand: null, category: 'pantry' as const,
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

import { computeShopSummary } from './homeDerivations';
import type { ShoppingList, ShoppingListPrice, Category } from '@eat/shared';

function listItem(partial: { name: string; category: Category; qty?: number; checked?: boolean; id?: string }) {
  return {
    id: partial.id ?? `i-${partial.name}`,
    shoppingListId: 'sl-1',
    canonicalFoodId: 'cf-1',
    name: partial.name,
    qty: partial.qty ?? 1,
    unit: 'count' as const,
    source: 'recipe' as const,
    checked: partial.checked ?? false,
    category: partial.category,
    sourceRecipeNames: null,
    sourceRecipeId: null,
  };
}

describe('computeShopSummary', () => {
  it('returns empty state when list is null', () => {
    const r = computeShopSummary(null, [], new Date('2026-05-12T08:00:00'));
    expect(r.state).toBe('empty');
    expect(r.aisles).toEqual([]);
    expect(r.total).toBeNull();
    expect(r.builtLabel).toBeNull();
  });

  it('returns empty state when list has no items', () => {
    const list: ShoppingList = {
      id: 'sl-1', householdId: 'h-1',
      createdAt: '2026-05-11T09:14:00Z', finalizedAt: null, items: [],
    };
    const r = computeShopSummary(list, [], new Date('2026-05-12T08:00:00'));
    expect(r.state).toBe('empty');
  });

  it('groups items by category and caps aisles at 4 by count desc', () => {
    const list: ShoppingList = {
      id: 'sl-1', householdId: 'h-1',
      createdAt: '2026-05-11T09:14:00Z', finalizedAt: null,
      items: [
        listItem({ name: 'apple',   category: 'produce' }),
        listItem({ name: 'kale',    category: 'produce' }),
        listItem({ name: 'carrot',  category: 'produce' }),
        listItem({ name: 'onion',   category: 'produce' }),
        listItem({ name: 'milk',    category: 'dairy' }),
        listItem({ name: 'butter',  category: 'dairy' }),
        listItem({ name: 'chicken', category: 'meat' }),
        listItem({ name: 'pasta',   category: 'pantry' }),
        listItem({ name: 'beer',    category: 'drinks' }),
      ],
    };
    const r = computeShopSummary(list, [], new Date('2026-05-12T08:00:00'));
    expect(r.state).toBe('ready');
    expect(r.aisles).toHaveLength(4);
    expect(r.aisles[0]).toMatchObject({ name: 'produce', count: 4 });
    expect(r.aisles[0].sampleItems).toEqual(['apple', 'kale', 'carrot']); // first 3
    expect(r.aisles.map((a) => a.name)).toEqual(['produce', 'dairy', 'meat', 'pantry']);
  });

  it('sums unchecked-item prices for total', () => {
    const list: ShoppingList = {
      id: 'sl-1', householdId: 'h-1',
      createdAt: '2026-05-11T09:14:00Z', finalizedAt: null,
      items: [
        listItem({ id: 'a', name: 'apple', category: 'produce', qty: 2 }),
        listItem({ id: 'b', name: 'kale',  category: 'produce', checked: true }),
        listItem({ id: 'c', name: 'milk',  category: 'dairy' }),
      ],
    };
    const prices: ShoppingListPrice[] = [
      { id: 'p1', shoppingListItemId: 'a', store: 'new_world', sku: null, name: null, price: 5.00, inStock: true, matched: true, checkedAt: '', candidates: [], chosenSku: null },
      { id: 'p2', shoppingListItemId: 'b', store: 'new_world', sku: null, name: null, price: 3.00, inStock: true, matched: true, checkedAt: '', candidates: [], chosenSku: null },
      { id: 'p3', shoppingListItemId: 'c', store: 'new_world', sku: null, name: null, price: 4.50, inStock: true, matched: true, checkedAt: '', candidates: [], chosenSku: null },
    ];
    const r = computeShopSummary(list, prices, new Date('2026-05-12T08:00:00'));
    // apple = 5 * 2, milk = 4.5 * 1, kale checked = ignored
    expect(r.total).toBe(14.5);
  });

  it('returns null total when no prices exist', () => {
    const list: ShoppingList = {
      id: 'sl-1', householdId: 'h-1',
      createdAt: '2026-05-11T09:14:00Z', finalizedAt: null,
      items: [listItem({ name: 'apple', category: 'produce' })],
    };
    const r = computeShopSummary(list, [], new Date('2026-05-12T08:00:00'));
    expect(r.total).toBeNull();
  });

  it('formats the built timestamp as short-day + lowercase am/pm', () => {
    const list: ShoppingList = {
      id: 'sl-1', householdId: 'h-1',
      createdAt: '2026-05-10T09:14:00', // local time, Sunday 9:14 am
      finalizedAt: null,
      items: [listItem({ name: 'apple', category: 'produce' })],
    };
    const r = computeShopSummary(list, [], new Date('2026-05-12T08:00:00'));
    expect(r.builtLabel).toBe('built sun 9:14 am');
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

import { subcopyDay } from './homeDerivations';
import type { ExpiringSummary } from './homeDerivations';

describe('subcopyDay', () => {
  it('returns the day name of the soonest-expiring item', () => {
    const today = new Date('2026-05-11T00:00:00'); // Monday
    const expiring: ExpiringSummary = {
      rows: [{ id: 'x', name: 'buttermilk', qtyDisplay: '½ pt', daysLeft: 2 }],
      totalCount: 1,
    };
    expect(subcopyDay(expiring, today)).toBe('wednesday'); // mon + 2 = wed
  });

  it('falls back to today when expiring is empty (never rendered when empty)', () => {
    const today = new Date('2026-05-11T00:00:00'); // Monday
    expect(subcopyDay({ rows: [], totalCount: 0 }, today)).toBe('monday');
  });
});

describe('formatQty (via computeExpiring)', () => {
  const today = new Date('2026-05-12T08:00:00');

  it('maps 0.5 to ½ fraction', () => {
    const items = [inv({ foodName: 'buttermilk', qty: 0.5, unit: 'pt', expiresAt: '2026-05-13' })];
    const result = computeExpiring(items, today);
    expect(result.rows[0].qtyDisplay).toBe('½ pt');
  });

  it('maps bn to bunch', () => {
    const items = [inv({ foodName: 'cilantro', qty: 1, unit: 'bn', expiresAt: '2026-05-13' })];
    const result = computeExpiring(items, today);
    expect(result.rows[0].qtyDisplay).toBe('1 bunch');
  });

  it('maps lf to loaf', () => {
    const items = [inv({ foodName: 'sourdough', qty: 0.5, unit: 'lf', expiresAt: '2026-05-13' })];
    const result = computeExpiring(items, today);
    expect(result.rows[0].qtyDisplay).toBe('½ loaf');
  });
});
