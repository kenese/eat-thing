import { matchIngredients } from './food-matcher.js';
import { generateGeminiJson } from './gemini.js';
import type { ImportedIngredient } from '@eat/shared';

type ImageMediaType = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';

export interface ExtractedPhotoRecipe {
  name: string;
  servings: number;
  instructions: string | null;
  ingredients: ImportedIngredient[];
}

export async function extractFromPhoto(
  imageBase64: string,
  mimeType: ImageMediaType,
): Promise<ExtractedPhotoRecipe> {
  const prompt = `Look at this recipe image. Extract the recipe and return ONLY valid JSON with this shape:
{"name":"string","servings":4,"instructions":"string or null","ingredients":[{"name":"string","qty":"1 1/2","unit":"cups"}]}

Convert measurements to grams or ml where possible (1 cup=240ml, 1tbsp=15ml, 1tsp=5ml, 1oz=28g, 1lb=454g). Use "count" only for things like eggs. If you cannot see ingredient quantities clearly, use 1 as a default quantity.`;

  const raw = await generateGeminiJson<{
    name: string;
    servings: number;
    instructions: string | null;
    ingredients: { name: string; qty: string; unit: string }[];
  }>(prompt, {
    image: { data: imageBase64, mimeType },
    maxOutputTokens: 2048,
  });

  const matched = await matchIngredients(raw.ingredients.map(i => i.name));

  const ingredients: ImportedIngredient[] = raw.ingredients.map((ing, idx) => {
    const m = matched[idx];
    return {
      rawText: ing.name,
      canonicalFoodId: m.canonicalFoodId,
      foodName: m.foodName,
      qty: ing.qty,
      unit: ing.unit,
      section: null,
      metric: null,
      optional: false,
      confidence: m.confidence,
    };
  });

  return { name: raw.name, servings: raw.servings, instructions: raw.instructions, ingredients };
}
