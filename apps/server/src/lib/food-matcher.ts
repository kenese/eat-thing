import { db } from '../db/index.js';
import { canonicalFoods } from '../db/schema/index.js';
import { generateGeminiJson } from './gemini.js';

export interface MatchedIngredient {
  rawText: string;
  canonicalFoodId: string | null;
  foodName: string | null;
  confidence: 'high' | 'low';
}

type FoodRow = { id: string; name: string; aliases: string[] };

let _foods: FoodRow[] | null = null;
async function getAllFoods(): Promise<FoodRow[]> {
  if (_foods) return _foods;
  _foods = await db.select({ id: canonicalFoods.id, name: canonicalFoods.name, aliases: canonicalFoods.aliases }).from(canonicalFoods);
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

async function llmMatch(unmatched: string[], foods: FoodRow[]): Promise<Map<string, FoodRow | null>> {
  const result = new Map<string, FoodRow | null>(unmatched.map(u => [u, null]));
  if (unmatched.length === 0) return result;

  const foodList = foods.map(f => f.name).join('\n');
  const prompt = `Given this list of canonical food names:\n${foodList}\n\nFor each ingredient string below, return the single best matching canonical food name, or "none" if nothing fits.\nReturn ONLY a JSON object: {"ingredient text": "matched canonical name or none"}\n\nIngredients:\n${unmatched.map(u => `- ${u}`).join('\n')}`;

  try {
    const parsed = await generateGeminiJson<Record<string, string>>(prompt, { maxOutputTokens: 512 });
    for (const [raw, matched] of Object.entries(parsed)) {
      if (matched === 'none') continue;
      const food = foods.find(f => f.name.toLowerCase() === matched.toLowerCase());
      if (food) result.set(raw, food);
    }
  } catch {
    // best-effort
  }
  return result;
}

export async function matchIngredients(names: string[]): Promise<MatchedIngredient[]> {
  const foods = await getAllFoods();
  const results: MatchedIngredient[] = [];
  const needsLlm: string[] = [];

  for (const raw of names) {
    const exact = findExact(raw, foods);
    if (exact) {
      results.push({ rawText: raw, canonicalFoodId: exact.id, foodName: exact.name, confidence: 'high' });
      continue;
    }
    const contains = findContains(raw, foods);
    if (contains) {
      results.push({ rawText: raw, canonicalFoodId: contains.id, foodName: contains.name, confidence: 'high' });
      continue;
    }
    results.push({ rawText: raw, canonicalFoodId: null, foodName: null, confidence: 'low' });
    needsLlm.push(raw);
  }

  if (needsLlm.length > 0) {
    const llmResults = await llmMatch(needsLlm, foods);
    for (const item of results) {
      if (item.confidence === 'low') {
        const match = llmResults.get(item.rawText);
        if (match) {
          item.canonicalFoodId = match.id;
          item.foodName = match.name;
        }
      }
    }
  }

  return results;
}
