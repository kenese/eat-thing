import { matchIngredients } from './food-matcher.js';
import { generateGeminiJson } from './gemini.js';
import type { ImportedIngredient } from '@eat/shared';

interface SchemaRecipeIngredient {
  name: string;
  qty: string;
  unit: string;
}

interface RawExtracted {
  name: string;
  servings: number;
  instructions: string | null;
  ingredients: SchemaRecipeIngredient[];
}

// ─── Schema.org parser ───────────────────────────────────────────────────────

function parseSchemaOrg(html: string): RawExtracted | null {
  const scriptRe = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;

  while ((match = scriptRe.exec(html)) !== null) {
    try {
      const raw = JSON.parse(match[1]);
      const nodes: unknown[] = Array.isArray(raw) ? raw : raw['@graph'] ? raw['@graph'] : [raw];
      for (const node of nodes) {
        if (
          node &&
          typeof node === 'object' &&
          (node as Record<string, unknown>)['@type'] === 'Recipe'
        ) {
          return extractSchemaNode(node as Record<string, unknown>);
        }
      }
    } catch {
      continue;
    }
  }
  return null;
}

function extractSchemaNode(node: Record<string, unknown>): RawExtracted | null {
  const name = typeof node['name'] === 'string' ? node['name'].trim() : null;
  if (!name) return null;

  const yieldRaw = node['recipeYield'];
  let servings = 4;
  if (Array.isArray(yieldRaw) && typeof yieldRaw[0] === 'string') {
    servings = parseInt(yieldRaw[0]) || 4;
  } else if (typeof yieldRaw === 'string') {
    servings = parseInt(yieldRaw) || 4;
  } else if (typeof yieldRaw === 'number') {
    servings = yieldRaw;
  }

  const rawInstructions = node['recipeInstructions'];
  let instructions: string | null = null;
  if (typeof rawInstructions === 'string') {
    instructions = rawInstructions.trim() || null;
  } else if (Array.isArray(rawInstructions)) {
    instructions = rawInstructions
      .map((s: unknown) => {
        if (typeof s === 'string') return s;
        if (s && typeof s === 'object') return (s as Record<string, unknown>)['text'] ?? '';
        return '';
      })
      .filter(Boolean)
      .join('\n\n') || null;
  }

  const rawIngredients = node['recipeIngredient'];
  const ingredientStrings: string[] = Array.isArray(rawIngredients)
    ? rawIngredients.filter((s): s is string => typeof s === 'string')
    : [];

  const ingredients = ingredientStrings.map(s => parseIngredientString(s));

  return { name, servings, instructions, ingredients };
}

// Very basic ingredient string parser — qty unit name
function parseIngredientString(raw: string): SchemaRecipeIngredient {
  const cleaned = raw.trim().replace(/¼/g, '1/4').replace(/½/g, '1/2').replace(/¾/g, '3/4');
  const parts = cleaned.split(/\s+/);
  let qty = '1';
  let unit = '';
  let nameStart = 0;

  const numMatch = cleaned.match(/^(\d+(?:\s+\d+\/\d+|[./]\d+)?)/);
  if (numMatch) {
    qty = numMatch[1];
    nameStart = qty.includes(' ') ? 2 : 1;
  }

  const unitStr = (parts[nameStart] ?? '').toLowerCase();
  if (['g', 'gram', 'grams', 'gr', 'ml', 'milliliter', 'milliliters', 'kg', 'kilogram', 'kilograms', 'l', 'liter', 'liters', 'litre', 'litres', 'cup', 'cups', 'tbsp', 'tablespoon', 'tablespoons', 'tsp', 'teaspoon', 'teaspoons', 'oz', 'ounce', 'ounces', 'lb', 'pound', 'pounds'].includes(unitStr)) {
    unit = parts[nameStart] ?? '';
    nameStart++;
  }

  const name = parts.slice(nameStart).join(' ') || raw;
  return { name, qty, unit };
}

// ─── Gemini text extractor ───────────────────────────────────────────────────

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s{3,}/g, '\n\n')
    .slice(0, 8000); // keep prompt manageable
}

async function extractWithGemini(text: string): Promise<RawExtracted | null> {
  const prompt = `Extract the recipe from this webpage text. Return ONLY valid JSON with this shape:
{"name":"string","servings":4,"instructions":"string or null","ingredients":[{"name":"string","qty":1,"unit":"g|ml|count"}]}

Convert measurements to grams or ml where possible (1 cup=240ml, 1tbsp=15ml, 1tsp=5ml, 1oz=28g, 1lb=454g). Use "count" only for things like eggs or items truly countable. Return null for ingredients with no clear quantity.

Webpage text:
${text}`;

  try {
    return await generateGeminiJson<RawExtracted>(prompt, { maxOutputTokens: 2048 });
  } catch (e) {
    throw e;
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

export interface ExtractedRecipe {
  name: string;
  servings: number;
  sourceUrl: string;
  instructions: string | null;
  ingredients: ImportedIngredient[];
}

export async function extractFromUrl(url: string): Promise<ExtractedRecipe> {
  const html = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; eat-thing-bot/1.0)' },
    signal: AbortSignal.timeout(10_000),
  }).then(r => {
    if (!r.ok) throw new Error(`Fetch failed: ${r.status}`);
    return r.text();
  });

  const raw = parseSchemaOrg(html) ?? await extractWithGemini(stripHtml(html));
  if (!raw) throw new Error('Could not extract recipe from this URL with Gemini');

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

  return { name: raw.name, servings: raw.servings, sourceUrl: url, instructions: raw.instructions, ingredients };
}
