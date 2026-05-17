import { db } from '../db/index.js';
import { canonicalFoods } from '../db/schema/index.js';
import { generateGeminiJson } from './gemini.js';

export interface MatchedIngredient {
  rawText: string;
  canonicalFoodId: string | null;
  foodName: string | null;
  canonicalDefaultUnit: string | null;
  confidence: 'high' | 'low';
}

type FoodRow = { id: string; name: string; aliases: string[]; defaultUnit: string };

let _foods: FoodRow[] | null = null;
async function getAllFoods(): Promise<FoodRow[]> {
  if (_foods) return _foods;
  _foods = await db.select({ id: canonicalFoods.id, name: canonicalFoods.name, aliases: canonicalFoods.aliases, defaultUnit: canonicalFoods.defaultUnit }).from(canonicalFoods);
  return _foods;
}

function findExact(name: string, foods: FoodRow[]): FoodRow | null {
  const lower = name.toLowerCase().trim();
  return foods.find(f =>
    f.name.toLowerCase() === lower || f.aliases.some(a => a.toLowerCase() === lower),
  ) ?? null;
}

function findContains(name: string, foods: FoodRow[]): FoodRow | null {
  const lower = name.toLowerCase().trim();
  return foods.find(f =>
    lower.includes(f.name.toLowerCase()) || f.name.toLowerCase().includes(lower) ||
    f.aliases.some(a => lower.includes(a.toLowerCase()) || a.toLowerCase().includes(lower)),
  ) ?? null;
}

export async function matchIngredients(names: string[]): Promise<MatchedIngredient[]> {
  const foods = await getAllFoods();
  const results: MatchedIngredient[] = [];

  for (const raw of names) {
    const exact = findExact(raw, foods);
    if (exact) {
      results.push({ rawText: raw, canonicalFoodId: exact.id, foodName: exact.name, canonicalDefaultUnit: exact.defaultUnit, confidence: 'high' });
      continue;
    }
    const contains = findContains(raw, foods);
    if (contains) {
      results.push({ rawText: raw, canonicalFoodId: contains.id, foodName: contains.name, canonicalDefaultUnit: contains.defaultUnit, confidence: 'low' });
      continue;
    }
    results.push({ rawText: raw, canonicalFoodId: null, foodName: null, canonicalDefaultUnit: null, confidence: 'low' });
  }

  return results;
}
