import { searchRecipes, type MealPlannerRecipe } from '@eat/meal-planning';
import type { CanonicalUnit, ImportedIngredient, ImportedRecipe } from '@eat/shared';
import { matchIngredients } from './food-matcher.js';

export interface MealPlannerRecipePreview {
  id: string;
  title: string;
  preview: string;
  alreadyImported: boolean;
}

type MealPlannerSearchResponse = MealPlannerRecipe[];

async function searchMealPlannerRecipes(): Promise<MealPlannerSearchResponse> {
  return searchRecipes({});
}

function parseQuantity(value: string): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function normalizeUnit(unit: string): CanonicalUnit {
  const normalized = unit.trim().toLowerCase();
  if (normalized === 'g' || normalized === 'gram' || normalized === 'grams') return 'g';
  if (normalized === 'ml' || normalized === 'millilitre' || normalized === 'millilitres') return 'ml';
  return 'count';
}

export async function listMealPlannerRecipes(existingNames: Set<string>): Promise<MealPlannerRecipePreview[]> {
  const recipes = await searchMealPlannerRecipes();

  return recipes.map((recipe) => ({
    id: recipe.id,
    title: recipe.name,
    preview: `${recipe.servings ?? 4} servings`,
    alreadyImported: existingNames.has(recipe.name.toLowerCase()),
  }));
}

export async function parseMealPlannerRecipe(id: string): Promise<ImportedRecipe> {
  const recipes = await searchMealPlannerRecipes();
  const source = recipes.find((recipe) => recipe.id === id);
  if (!source) throw new Error('Meal Planner recipe not found');
  if (!source.ingredients.length) throw new Error('Meal Planner recipe has no ingredients');

  const matched = await matchIngredients(source.ingredients.map((ingredient) => ingredient.name));
  const ingredients: ImportedIngredient[] = source.ingredients.map((ingredient, index) => {
    const match = matched[index];
    return {
      rawText: ingredient.name,
      canonicalFoodId: match.canonicalFoodId,
      foodName: match.foodName,
      qty: parseQuantity(ingredient.quantity),
      unit: normalizeUnit(ingredient.unit),
      optional: false,
      confidence: match.confidence,
    };
  });

  return {
    name: source.name,
    servings: source.servings ?? 4,
    sourceUrl: null,
    sourceImage: null,
    instructions: source.instructions?.join('\n') ?? null,
    ingredients,
  };
}
