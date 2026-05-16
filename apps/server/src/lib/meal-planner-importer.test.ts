import { describe, expect, it, vi } from 'vitest';

vi.mock('@eat/meal-planning', () => ({
  searchRecipes: vi.fn(),
}));

vi.mock('./food-matcher.js', () => ({
  matchIngredients: vi.fn(),
}));

const { searchRecipes } = await import('@eat/meal-planning');
const { matchIngredients } = await import('./food-matcher.js');
const { listMealPlannerRecipes, parseMealPlannerRecipe } = await import('./meal-planner-importer.js');

describe('meal planner importer', () => {
  it('lists Meal Planner recipes and marks existing names as already imported', async () => {
    vi.mocked(searchRecipes).mockResolvedValueOnce([
      {
        id: 'mp-1',
        name: 'Lemon Pasta',
        servings: 4,
        ingredients: [],
        instructions: [],
      },
    ]);

    const rows = await listMealPlannerRecipes(new Set(['lemon pasta']));

    expect(searchRecipes).toHaveBeenCalledWith({});
    expect(rows).toEqual([
      {
        id: 'mp-1',
        title: 'Lemon Pasta',
        preview: '4 servings',
        alreadyImported: true,
      },
    ]);
  });

  it('maps structured Meal Planner recipe detail into an imported recipe draft', async () => {
    vi.mocked(searchRecipes).mockResolvedValueOnce([
      {
        id: 'mp-1',
        name: 'Lemon Pasta',
        servings: 4,
        instructions: ['Boil pasta.', 'Toss with lemon.'],
        ingredients: [
          { name: 'spaghetti', quantity: '400', unit: 'g' },
          { name: 'lemon', quantity: '1', unit: '' },
        ],
      },
    ]);
    vi.mocked(matchIngredients).mockResolvedValueOnce([
      {
        rawText: 'spaghetti',
        canonicalFoodId: 'cf-pasta',
        foodName: 'spaghetti',
        canonicalDefaultUnit: null,
        confidence: 'high',
      },
      {
        rawText: 'lemon',
        canonicalFoodId: 'cf-lemon',
        foodName: 'lemon',
        canonicalDefaultUnit: null,
        confidence: 'high',
      },
    ]);

    const recipe = await parseMealPlannerRecipe('mp-1');

    expect(recipe).toMatchObject({
      name: 'Lemon Pasta',
      servings: 4,
      sourceUrl: null,
      sourceImage: null,
      instructions: 'Boil pasta.\nToss with lemon.',
      ingredients: [
        {
          rawText: 'spaghetti',
          canonicalFoodId: 'cf-pasta',
          foodName: 'spaghetti',
          qty: '400',
          unit: 'g',
          optional: false,
          confidence: 'high',
        },
        {
          rawText: 'lemon',
          canonicalFoodId: 'cf-lemon',
          foodName: 'lemon',
          qty: '1',
          unit: '',
          optional: false,
          confidence: 'high',
        },
      ],
    });
  });

  it('throws when the selected Meal Planner recipe is missing', async () => {
    vi.mocked(searchRecipes).mockResolvedValueOnce([]);

    await expect(parseMealPlannerRecipe('missing')).rejects.toThrow('Meal Planner recipe not found');
  });
});
