import Anthropic from '@anthropic-ai/sdk';
import { matchIngredients } from './food-matcher.js';
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
  const client = new Anthropic();

  const prompt = `Look at this recipe image. Extract the recipe and return ONLY valid JSON with this shape:
{"name":"string","servings":4,"instructions":"string or null","ingredients":[{"name":"string","qty":1,"unit":"g|ml|count"}]}

Convert measurements to grams or ml where possible (1 cup=240ml, 1tbsp=15ml, 1tsp=5ml, 1oz=28g, 1lb=454g). Use "count" only for things like eggs. If you cannot see ingredient quantities clearly, use 1 as a default quantity.`;

  const msg = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2048,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mimeType, data: imageBase64 },
          },
          { type: 'text', text: prompt },
        ],
      },
    ],
  });

  const content = msg.content[0].type === 'text' ? msg.content[0].text : '';
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Could not extract recipe from image');

  const raw = JSON.parse(jsonMatch[0]) as {
    name: string;
    servings: number;
    instructions: string | null;
    ingredients: { name: string; qty: number; unit: 'g' | 'ml' | 'count' }[];
  };

  const matched = await matchIngredients(raw.ingredients.map(i => i.name));

  const ingredients: ImportedIngredient[] = raw.ingredients.map((ing, idx) => {
    const m = matched[idx];
    return {
      rawText: ing.name,
      canonicalFoodId: m.canonicalFoodId,
      foodName: m.foodName,
      qty: ing.qty,
      unit: ing.unit,
      optional: false,
      confidence: m.confidence,
    };
  });

  return { name: raw.name, servings: raw.servings, instructions: raw.instructions, ingredients };
}
