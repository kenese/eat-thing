import { describe, expect, it } from 'vitest';
import { getDevMockResponse } from './mockApi';

describe('getDevMockResponse', () => {
  it('returns a richer homepage inventory with expiring items', () => {
    const inventory = getDevMockResponse('/api/inventory') as Array<{
      foodName: string;
      expiresAt: string | null;
    }>;

    expect(inventory.map((item) => item.foodName)).toContain('baby spinach');
    expect(inventory.filter((item) => item.expiresAt !== null).length).toBeGreaterThanOrEqual(4);
  });

  it('returns a meal plan and recipe details that can produce cook/shop homepage cards', () => {
    const plan = getDevMockResponse('/api/meal-plans?weekStart=2026-05-11') as {
      entries: Array<{ recipeId: string; recipeName: string; date: string }>;
    };
    const recipe = getDevMockResponse('/api/recipes/recipe-risotto') as {
      name: string;
      ingredients: Array<{ foodName: string }>;
    };

    expect(plan.entries.map((entry) => entry.recipeName)).toContain('Spinach risotto');
    expect(plan.entries.find((entry) => entry.recipeName === 'Mushroom pasta')?.date).toBe('2026-05-13');
    expect(recipe.name).toBe('Spinach risotto');
    expect(recipe.ingredients.map((ingredient) => ingredient.foodName)).toContain('arborio rice');
  });

  it('returns a shopping list plus prices for the homepage shopping preview', () => {
    const list = getDevMockResponse('/api/shopping-lists') as {
      id: string;
      items: Array<{ id: string; category: string }>;
    };
    const prices = getDevMockResponse(`/api/shopping-lists/${list.id}/prices`) as {
      prices: Array<{ shoppingListItemId: string; price: number | null }>;
    };

    expect(list.items.length).toBeGreaterThanOrEqual(5);
    expect(list.items.some((item) => item.category === 'produce')).toBe(true);
    expect(prices.prices.some((price) => price.shoppingListItemId === list.items[0].id)).toBe(true);
  });
});
