import { matchIngredients } from './food-matcher.js';
import type { ImportedIngredient, ImportedRecipe } from '@eat/shared';

interface MealDbMeal {
  idMeal: string;
  strMeal: string;
  strInstructions: string;
  strMealThumb: string;
  strSource?: string;
  strTags?: string;
  [key: string]: string | undefined;
}

function parseMeasure(raw: string): { qty: string; unit: string } {
  const s = raw.trim().toLowerCase().replace(/¼/g, '1/4').replace(/½/g, '1/2').replace(/¾/g, '3/4');
  const match = s.match(/^(\d+(?:\s+\d+\/\d+|[./]\d+)?)\s*(.*)$/);
  if (!match) return { qty: raw.trim() || '1', unit: '' };
  return { qty: match[1], unit: match[2]?.trim() ?? '' };
}

async function mealToImportedRecipe(meal: MealDbMeal): Promise<ImportedRecipe> {
  const rawIngredients: { name: string; raw: string }[] = [];
  for (let i = 1; i <= 20; i++) {
    const name = meal[`strIngredient${i}`]?.trim();
    const measure = meal[`strMeasure${i}`]?.trim() ?? '';
    if (name) rawIngredients.push({ name, raw: measure });
  }

  const matched = await matchIngredients(rawIngredients.map(i => i.name));

  const ingredients: ImportedIngredient[] = rawIngredients.map((ing, idx) => {
    const m = matched[idx];
    const parsed = ing.raw ? parseMeasure(ing.raw) : { qty: '1', unit: '' };
    return {
      rawText: ing.name,
      canonicalFoodId: m.canonicalFoodId,
      foodName: m.foodName,
      canonicalDefaultUnit: m.canonicalDefaultUnit,
      qty: parsed.qty,
      unit: parsed.unit,
      section: null,
      metric: null,
      optional: false,
      confidence: m.confidence,
    };
  });

  return {
    name: meal.strMeal,
    servings: 4,
    sourceUrl: meal.strSource || `https://www.themealdb.com/meal/${meal.idMeal}`,
    sourceImage: null,
    heroImageUrl: null,
    totalTimeMinutes: null,
    tags: meal.strTags
      ? meal.strTags.split(',').map(tag => tag.trim()).filter(Boolean)
      : [],
    instructions: meal.strInstructions || null,
    ingredients,
  };
}

export async function searchMealDb(query: string): Promise<ImportedRecipe[]> {
  const url = `https://www.themealdb.com/api/json/v1/1/search.php?s=${encodeURIComponent(query)}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(8_000) });
  if (!res.ok) throw new Error(`TheMealDB error: ${res.status}`);
  const data = await res.json() as { meals: MealDbMeal[] | null };
  if (!data.meals) return [];

  return Promise.all(data.meals.slice(0, 10).map(mealToImportedRecipe));
}
