import { matchIngredients } from './food-matcher.js';
import { generateGeminiJson } from './gemini.js';
import { normalizeRecipeAmount } from './recipe-quantities.js';
import type { ImportedIngredient } from '@eat/shared';

type ImageMediaType = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';

export interface ExtractedPhotoRecipe {
  name: string;
  servings: number;
  instructions: string | null;
  ingredients: ImportedIngredient[];
}

interface GeminiSection {
  name: string | null;
  ingredients: { name: string; qty: string; unit: string }[];
  instructions: string | null;
}

interface GeminiResponse {
  name: string;
  servings: number;
  sections: GeminiSection[];
}

function formatMetricQty(qty: number): string {
  const rounded = Math.round(qty * 10) / 10;
  return rounded % 1 === 0 ? String(Math.round(rounded)) : rounded.toFixed(1);
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

  const raw = await generateGeminiJson<GeminiResponse>(prompt, {
    image: { data: imageBase64, mimeType },
    maxOutputTokens: 8192,
  });

  const flatIngredients: Array<{ name: string; qty: string; unit: string; section: string | null }> = [];
  const instructionParts: string[] = [];

  for (const sec of raw.sections ?? []) {
    const sectionName = sec.name?.trim() || null;
    for (const ing of sec.ingredients ?? []) {
      flatIngredients.push({ ...ing, section: sectionName });
    }
    if (sec.instructions?.trim()) {
      if (sectionName) instructionParts.push(`## ${sectionName}`);
      instructionParts.push(sec.instructions.trim());
    }
  }

  const annotated = flatIngredients.map(ing => {
    const canonical = normalizeRecipeAmount(ing.qty, ing.unit);
    const metric = canonical ? `${formatMetricQty(canonical.qty)} ${canonical.unit}` : null;
    return { ...ing, metric };
  });

  const matched = await matchIngredients(annotated.map(i => i.name));

  const ingredients: ImportedIngredient[] = annotated.map((ing, idx) => {
    const m = matched[idx];
    return {
      rawText: ing.name,
      canonicalFoodId: m.canonicalFoodId,
      foodName: m.foodName,
      qty: ing.qty,
      unit: ing.unit,
      section: ing.section,
      metric: ing.metric,
      optional: false,
      confidence: m.confidence,
    };
  });

  return {
    name: raw.name,
    servings: raw.servings,
    instructions: instructionParts.join('\n\n') || null,
    ingredients,
  };
}
