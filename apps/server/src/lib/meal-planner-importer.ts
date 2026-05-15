import { searchRecipes, type MealPlannerRecipe } from '@eat/meal-planning';
import type { ImportedIngredient, ImportedRecipe } from '@eat/shared';
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
  const ingredients = source.ingredients.map((ingredient, index) => {
    const match = matched[index];
    return {
      rawText: ingredient.name,
      canonicalFoodId: match.canonicalFoodId,
      foodName: match.foodName,
      qty: ingredient.quantity,
      unit: ingredient.unit,
      section: null,
      metric: null,
      optional: false,
      confidence: match.confidence,
    };
  });

  return {
    name: source.name,
    servings: source.servings ?? 4,
    sourceUrl: null,
    sourceImage: null,
    heroImageUrl: null,
    instructions: source.instructions?.join('\n') ?? null,
    ingredients,
  };
}
