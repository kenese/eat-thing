import { matchIngredients } from './food-matcher.js';
import type { ImportedIngredient, ImportedRecipe } from '@eat/shared';

interface MealDbMeal {
  idMeal: string;
  strMeal: string;
  strInstructions: string;
  strMealThumb: string;
  strSource?: string;
  [key: string]: string | undefined;
}

function parseMeasure(raw: string): { qty: number; unit: 'g' | 'ml' | 'count' } {
  const s = raw.trim().toLowerCase().replace(/¼/g, '0.25').replace(/½/g, '0.5').replace(/¾/g, '0.75');
  const numMatch = s.match(/^(\d+(?:[./]\d+)?)\s*/);
  let qty = numMatch ? eval(numMatch[1].replace('/', '/')) || 1 : 1;
  const rest = s.replace(/^(\d+(?:[./]\d+)?)\s*/, '');

  if (rest.startsWith('kg')) { qty *= 1000; return { qty, unit: 'g' }; }
  if (rest.startsWith('g') || rest.startsWith('gram')) return { qty, unit: 'g' };
  if (/^l(iter|itre)?s?\b/.test(rest)) { qty *= 1000; return { qty, unit: 'ml' }; }
  if (rest.startsWith('ml') || rest.startsWith('millil')) return { qty, unit: 'ml' };
  if (/^cup/.test(rest)) return { qty: qty * 240, unit: 'ml' };
  if (/^tbsp|tablespoon/.test(rest)) return { qty: qty * 15, unit: 'ml' };
  if (/^tsp|teaspoon/.test(rest)) return { qty: qty * 5, unit: 'ml' };
  if (/^oz|ounce/.test(rest)) return { qty: qty * 28, unit: 'g' };
  if (/^lb|pound/.test(rest)) return { qty: qty * 454, unit: 'g' };
  return { qty, unit: 'count' };
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
    const parsed = ing.raw ? parseMeasure(ing.raw) : { qty: 1, unit: 'count' as const };
    return {
      rawText: ing.name,
      canonicalFoodId: m.canonicalFoodId,
      foodName: m.foodName,
      qty: Math.round(parsed.qty * 100) / 100,
      unit: parsed.unit,
      optional: false,
      confidence: m.confidence,
    };
  });

  return {
    name: meal.strMeal,
    servings: 4,
    sourceUrl: meal.strSource || `https://www.themealdb.com/meal/${meal.idMeal}`,
    sourceImage: null,
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
