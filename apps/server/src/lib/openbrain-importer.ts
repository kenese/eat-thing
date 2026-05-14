import { searchThoughts, fetchThought } from '@eat/openbrain';
import { matchIngredients } from './food-matcher.js';
import { generateGeminiJson } from './gemini.js';
import type { ImportedRecipe, ImportedIngredient } from '@eat/shared';

export interface OpenBrainRecipePreview {
  id: string;
  title: string;
  preview: string;
  alreadyImported: boolean;
}

// Content written by syncRecipe always starts with this prefix
const EAT_THING_PREFIX = '# Recipe: ';
const EAT_THING_EXTERNAL_ID_PREFIX = 'eat-thing:recipe:';

function isEatThingRecipe(thought: { external_id?: string; content: string }): boolean {
  if (thought.external_id?.startsWith(EAT_THING_EXTERNAL_ID_PREFIX)) return true;
  return false;
}

function extractTitleFromContent(content: string): string | null {
  const line = content.split('\n')[0]?.trim() ?? '';
  if (line.startsWith(EAT_THING_PREFIX)) return line.slice(EAT_THING_PREFIX.length).trim();
  const archiveMatch = line.match(/^Recipe from the user's Evernote archive\s+[—-]\s+(.+?)(?:\.|$)/i);
  if (archiveMatch) return archiveMatch[1].trim();
  const recipeMatch = line.match(/^Recipe:\s*(.+?)(?:\.|$)/i);
  if (recipeMatch) return recipeMatch[1].trim();
  if (line.startsWith('# ')) return line.slice(2).trim();
  return null;
}

function looksLikeRecipe(content: string): boolean {
  const lower = content.toLowerCase();
  return lower.includes('recipe') || lower.includes('ingredient') || lower.includes('## instructions') || lower.includes('servings');
}

export async function listOpenBrainRecipes(existingNames: Set<string>): Promise<OpenBrainRecipePreview[]> {
  const thoughts = await searchThoughts('recipe', { limit: 100, threshold: 0.1 });

  const previews: OpenBrainRecipePreview[] = [];
  for (const t of thoughts) {
    if (!looksLikeRecipe(t.content)) continue;

    const title = extractTitleFromContent(t.content) ?? 'Untitled recipe';
    const preview = t.content.split('\n').slice(1, 4).join(' ').replace(/#+/g, '').trim();
    const alreadyImported = isEatThingRecipe(t) || existingNames.has(title.toLowerCase());

    previews.push({ id: t.id, title, preview, alreadyImported });
  }

  return previews;
}

// ─── eat-thing markdown format parser ────────────────────────────────────────

interface RawIngredient {
  name: string;
  qty: string;
  unit: string;
}

interface RawRecipe {
  name: string;
  servings: number;
  sourceUrl: string | null;
  instructions: string | null;
  ingredients: RawIngredient[];
}

function parseEatThingFormat(content: string): RawRecipe | null {
  const lines = content.split('\n');
  const firstLine = lines[0]?.trim() ?? '';
  if (!firstLine.startsWith(EAT_THING_PREFIX)) return null;

  const name = firstLine.slice(EAT_THING_PREFIX.length).trim();
  let servings = 4;
  let sourceUrl: string | null = null;
  let instructions: string | null = null;
  const ingredients: RawIngredient[] = [];
  let section: 'header' | 'ingredients' | 'instructions' = 'header';

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]?.trim() ?? '';
    if (line === '## Ingredients') { section = 'ingredients'; continue; }
    if (line === '## Instructions') { section = 'instructions'; continue; }

    if (section === 'header') {
      const servMatch = line.match(/^Servings:\s*(\d+)/i);
      if (servMatch) { servings = parseInt(servMatch[1]) || 4; continue; }
      const srcMatch = line.match(/^Source:\s*(\S+)/i);
      if (srcMatch) { sourceUrl = srcMatch[1]; continue; }
    }

    if (section === 'ingredients' && line.startsWith('- ')) {
      const ing = parseIngredientLine(line.slice(2));
      if (ing) ingredients.push(ing);
    }

    if (section === 'instructions' && line) {
      instructions = instructions ? `${instructions}\n${line}` : line;
    }
  }

  return { name, servings, sourceUrl, instructions, ingredients };
}

function parseIngredientLine(text: string): RawIngredient | null {
  // Format: "{qty} {unit} {name}" or "{qty} {unit} {name} (optional)"
  const cleaned = text.replace(/\s*\(optional\)$/i, '').trim();
  const parts = cleaned.split(/\s+/);
  const qty = parts[0] ?? '';
  if (!qty || parts.length < 2) return null;

  const unitStr = (parts[1] ?? '').toLowerCase();
  let unit = '';
  let nameStart = 2;
  if (unitStr === 'g' || unitStr === 'ml' || unitStr === 'count') { unit = unitStr; }
  else { nameStart = 1; } // no recognised unit — whole remainder is name

  const name = parts.slice(nameStart).join(' ');
  return name ? { name, qty, unit } : null;
}

// ─── Gemini fallback parser ───────────────────────────────────────────────────

async function parseWithGemini(content: string): Promise<RawRecipe | null> {
  const prompt = `Extract the recipe from this text. Return ONLY valid JSON:
{"name":"string","servings":4,"sourceUrl":"string or null","instructions":"string or null","ingredients":[{"name":"string","qty":"1 1/2","unit":"cups"}]}

Convert measurements to grams or ml where possible. Use "count" only for countable items like eggs.

Text:
${content.slice(0, 6000)}`;

  try {
    return await generateGeminiJson<RawRecipe>(prompt, { maxOutputTokens: 2048 });
  } catch {
    return null;
  }
}

// ─── Public parse entry point ─────────────────────────────────────────────────

export async function parseOpenBrainThought(thoughtId: string): Promise<ImportedRecipe> {
  const thought = await fetchThought(thoughtId);
  if (!thought) throw new Error('Thought not found');

  const raw = parseEatThingFormat(thought.content) ?? await parseWithGemini(thought.content);
  if (!raw) throw new Error('Could not parse recipe from this thought');

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

  return {
    name: raw.name,
    servings: raw.servings,
    sourceUrl: raw.sourceUrl,
    sourceImage: null,
    instructions: raw.instructions,
    ingredients,
  };
}
