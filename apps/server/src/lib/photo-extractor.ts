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
{"name":"string","servings":4,"sections":[{"name":"string or null","ingredients":[{"name":"string","qty":"string","unit":"string"}],"instructions":"string or null"}]}

Rules:
- Preserve all original quantities and units exactly as written. Do not convert measurements.
- Do not paraphrase ingredients or instructions — keep the original wording.
- A recipe with no named sections should return a single section with name: null.
- Multiple components (e.g. "For the sauce", "For the pasta") should be separate sections.`;

  const raw = await generateGeminiJson<{
    name: string;
    servings: number;
    instructions: string | null;
    ingredients: { name: string; qty: string; unit: string }[];
  }>(prompt, {
    image: { data: imageBase64, mimeType },
    maxOutputTokens: 8192,
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
