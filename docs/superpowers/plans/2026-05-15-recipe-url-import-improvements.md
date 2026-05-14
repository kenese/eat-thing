# Recipe URL Import Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve URL recipe ingestion with hero image extraction, metric annotations, no-paraphrase preservation, Readability-based HTML cleaning, and sectioned ingredient/instruction support.

**Architecture:** All changes flow through a single enriched pipeline in `recipe-extractor.ts`. A DB migration adds `section` and `metric_value` columns to `recipe_ingredients`. Shared types in `packages/shared` gain the new fields. Hero images are resolved during extraction (returned as a URL) and uploaded to Supabase Storage when the recipe is saved.

**Tech Stack:** TypeScript, Drizzle ORM (drizzle-kit for migrations), Vitest, @mozilla/readability + jsdom (already installed), Gemini via `generateGeminiJson`, Supabase Storage via `uploadPhoto`.

---

## File Map

| File | Action | What changes |
|---|---|---|
| `apps/server/src/db/schema/recipes.ts` | Modify | Add `section` and `metricValue` columns to `recipeIngredients` |
| `apps/server/drizzle/0004_recipe_ingredient_sections_metric.sql` | Create | Migration SQL for the two new columns |
| `packages/shared/src/index.ts` | Modify | Add `section`/`metricValue` to `RecipeIngredient`; add `section`/`metric`/`heroImageUrl` to `ImportedIngredient` and `ImportedRecipe` |
| `apps/server/src/lib/recipe-extractor.ts` | Modify | Refactor pipeline: Readability, no-paraphrase prompt, sections, metric annotation, hero image resolution |
| `apps/server/src/lib/recipe-extractor.test.ts` | Create | Unit tests for `parseSchemaOrg` with sections, `annotateMetric`, `resolveHeroImage` |
| `apps/server/src/routes/recipes.ts` | Modify | Accept `heroImageUrl`, fetch+upload on save; persist `section`/`metricValue` on ingredients |
| `apps/server/src/routes/ingest.test.ts` | Modify | Update `MOCK_RECIPE` fixture to include new fields |

---

## Task 1: DB schema + migration

**Files:**
- Modify: `apps/server/src/db/schema/recipes.ts`
- Create: `apps/server/drizzle/0004_recipe_ingredient_sections_metric.sql`

- [ ] **Step 1: Add columns to the Drizzle schema**

Open `apps/server/src/db/schema/recipes.ts`. The `recipeIngredients` table currently ends at `sortOrder`. Add two nullable text columns:

```ts
export const recipeIngredients = pgTable('recipe_ingredients', {
  id: uuid('id').primaryKey().defaultRandom(),
  recipeId: uuid('recipe_id').notNull().references(() => recipes.id, { onDelete: 'cascade' }),
  householdId: uuid('household_id').notNull().references(() => households.id, { onDelete: 'cascade' }),
  canonicalFoodId: uuid('canonical_food_id').notNull().references(() => canonicalFoods.id),
  qty: text('qty').notNull(),
  unit: text('unit').notNull(),
  section: text('section'),
  metricValue: text('metric_value'),
  optional: boolean('optional').notNull().default(false),
  sortOrder: integer('sort_order').notNull().default(0),
});
```

- [ ] **Step 2: Write the migration SQL**

Create `apps/server/drizzle/0004_recipe_ingredient_sections_metric.sql`:

```sql
ALTER TABLE "recipe_ingredients" ADD COLUMN "section" text;
--> statement-breakpoint
ALTER TABLE "recipe_ingredients" ADD COLUMN "metric_value" text;
```

- [ ] **Step 3: Register the migration in the journal**

Open `apps/server/drizzle/meta/_journal.json`. Append to the `entries` array:

```json
{
  "idx": 4,
  "version": "7",
  "when": 1747267200000,
  "tag": "0004_recipe_ingredient_sections_metric",
  "breakpoints": true
}
```

- [ ] **Step 4: Run the migration**

```bash
cd apps/server && pnpm drizzle-kit migrate
```

Expected: Migration applied successfully with no errors.

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/db/schema/recipes.ts apps/server/drizzle/0004_recipe_ingredient_sections_metric.sql apps/server/drizzle/meta/_journal.json
git commit -m "feat: add section and metric_value columns to recipe_ingredients"
```

---

## Task 2: Update shared types

**Files:**
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: Add fields to `RecipeIngredient`**

In the `RecipeIngredient` interface, add the two new fields after `unit`:

```ts
export interface RecipeIngredient {
  id: string;
  recipeId: string;
  canonicalFoodId: string;
  foodName: string;
  qty: string;
  unit: string;
  section: string | null;
  metricValue: string | null;
  optional: boolean;
  sortOrder: number;
}
```

- [ ] **Step 2: Add fields to `ImportedIngredient`**

```ts
export interface ImportedIngredient {
  rawText: string;
  canonicalFoodId: string | null;
  foodName: string | null;
  qty: string;
  unit: string;
  section: string | null;
  metric: string | null;
  optional: boolean;
  confidence: 'high' | 'low';
}
```

- [ ] **Step 3: Add `heroImageUrl` to `ImportedRecipe`**

```ts
export interface ImportedRecipe {
  name: string;
  servings: number;
  sourceUrl: string | null;
  sourceImage: string | null;
  heroImageUrl: string | null;
  instructions: string | null;
  ingredients: ImportedIngredient[];
}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd packages/shared && pnpm tsc --noEmit
```

Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/index.ts
git commit -m "feat: add section, metric, heroImageUrl fields to shared recipe types"
```

---

## Task 3: Rewrite `recipe-extractor.ts`

This is the main task. The file is rewritten to incorporate all five improvements. Read the full current file at `apps/server/src/lib/recipe-extractor.ts` before starting.

**Files:**
- Modify: `apps/server/src/lib/recipe-extractor.ts`

- [ ] **Step 1: Update the internal `SchemaRecipeIngredient` interface**

Add `section` to the internal type (top of file, in the interfaces section):

```ts
interface SchemaRecipeIngredient {
  name: string;
  qty: string;
  unit: string;
  section?: string;
}

interface RawExtracted {
  name: string;
  servings: number;
  instructions: string | null;
  ingredients: SchemaRecipeIngredient[];
}
```

- [ ] **Step 2: Update `extractSchemaNode` to handle `HowToSection`**

Replace the `recipeInstructions` handling block inside `extractSchemaNode`. The full updated function:

```ts
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
    const parts: string[] = [];
    for (const item of rawInstructions) {
      if (typeof item === 'string') {
        parts.push(item);
      } else if (item && typeof item === 'object') {
        const obj = item as Record<string, unknown>;
        if (obj['@type'] === 'HowToSection') {
          const sectionName = typeof obj['name'] === 'string' ? obj['name'].trim() : null;
          if (sectionName) parts.push(`## ${sectionName}`);
          const steps = Array.isArray(obj['itemListElement']) ? obj['itemListElement'] : [];
          for (const step of steps) {
            if (typeof step === 'string') {
              parts.push(step);
            } else if (step && typeof step === 'object') {
              const text = (step as Record<string, unknown>)['text'];
              if (typeof text === 'string' && text.trim()) parts.push(text.trim());
            }
          }
        } else {
          const text = obj['text'];
          if (typeof text === 'string' && text.trim()) parts.push(text.trim());
        }
      }
    }
    instructions = parts.filter(Boolean).join('\n\n') || null;
  }

  const rawIngredients = node['recipeIngredient'];
  const ingredientStrings: string[] = Array.isArray(rawIngredients)
    ? rawIngredients.filter((s): s is string => typeof s === 'string')
    : [];

  const ingredients = ingredientStrings.map(s => parseIngredientString(s));

  return { name, servings, instructions, ingredients };
}
```

- [ ] **Step 3: Replace `getCleanRecipeHTML` with `cleanHtmlWithReadability`**

Remove the old `getCleanRecipeHTML` function (which fetches by URL). Add a new function that takes HTML as a string:

```ts
function cleanHtmlWithReadability(html: string): string {
  const doc = new JSDOM(html);
  const reader = new Readability(doc.window.document);
  const article = reader.parse();
  return article?.textContent?.replace(/\s{3,}/g, '\n\n').slice(0, 12000) ?? '';
}
```

- [ ] **Step 4: Replace `stripHtml` with the call to `cleanHtmlWithReadability`**

Remove the old `stripHtml` function entirely. It is only used in `extractWithGemini`, which is updated in Step 5.

- [ ] **Step 5: Update `extractWithGemini` — new prompt and sections schema**

Replace the entire `extractWithGemini` function:

```ts
interface GeminiSection {
  name: string | null;
  ingredients: SchemaRecipeIngredient[];
  instructions: string | null;
}

interface GeminiResponse {
  name: string;
  servings: number;
  sections: GeminiSection[];
}

async function extractWithGemini(cleanText: string): Promise<RawExtracted | null> {
  const prompt = `Extract the recipe from this webpage text. Return ONLY valid JSON with this exact shape:
{"name":"string","servings":4,"sections":[{"name":"string or null","ingredients":[{"name":"string","qty":"string","unit":"string"}],"instructions":"string or null"}]}

Rules:
- Preserve all original quantities and units exactly as written. Do not convert measurements.
- Do not paraphrase ingredients or instructions — keep the original wording.
- A recipe with no named sections should return a single section with name: null.
- Multiple components (e.g. "For the sauce", "For the pasta") should be separate sections.

Webpage text:
${cleanText}`;

  try {
    const gemini = await generateGeminiJson<GeminiResponse>(prompt, { maxOutputTokens: 2048 });
    if (!gemini?.name || !Array.isArray(gemini.sections)) return null;

    // Merge sections into flat RawExtracted
    const ingredients: SchemaRecipeIngredient[] = [];
    const instructionParts: string[] = [];

    for (const sec of gemini.sections) {
      const sectionName = sec.name?.trim() || null;
      for (const ing of sec.ingredients ?? []) {
        ingredients.push({ ...ing, ...(sectionName ? { section: sectionName } : {}) });
      }
      if (sec.instructions?.trim()) {
        if (sectionName) instructionParts.push(`## ${sectionName}`);
        instructionParts.push(sec.instructions.trim());
      }
    }

    return {
      name: gemini.name,
      servings: gemini.servings ?? 4,
      instructions: instructionParts.join('\n\n') || null,
      ingredients,
    };
  } catch (e) {
    throw e;
  }
}
```

- [ ] **Step 6: Add `annotateMetric` function**

Add after `extractWithGemini`:

```ts
import { normalizeRecipeAmount } from './recipe-quantities.js';

function annotateMetric(ingredients: SchemaRecipeIngredient[]): Array<SchemaRecipeIngredient & { metric: string | null }> {
  return ingredients.map(ing => {
    const canonical = normalizeRecipeAmount(ing.qty, ing.unit);
    let metric: string | null = null;
    if (canonical) {
      metric = `${canonical.qty} ${canonical.unit}`;
    }
    return { ...ing, metric };
  });
}
```

Note: `normalizeRecipeAmount` is already imported from `./recipe-quantities.js` — add the import if not present.

- [ ] **Step 7: Add `resolveHeroImage` function**

Add after `annotateMetric`:

```ts
function resolveHeroImage(html: string, baseUrl: string): string | null {
  // Try og:image and twitter:image meta tags
  const ogMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
    ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
  if (ogMatch?.[1]) return resolveUrl(ogMatch[1], baseUrl);

  const twitterMatch = html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i)
    ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i);
  if (twitterMatch?.[1]) return resolveUrl(twitterMatch[1], baseUrl);

  // Fall back to first <img> with a photo extension
  const imgMatch = html.match(/<img[^>]+src=["']([^"']+\.(?:jpg|jpeg|png|webp))["']/i);
  if (imgMatch?.[1] && !imgMatch[1].startsWith('data:')) {
    return resolveUrl(imgMatch[1], baseUrl);
  }

  return null;
}

function resolveUrl(src: string, baseUrl: string): string {
  try {
    return new URL(src, baseUrl).href;
  } catch {
    return src;
  }
}
```

- [ ] **Step 8: Update `ExtractedRecipe` and `extractFromUrl`**

Replace the `ExtractedRecipe` interface and `extractFromUrl` function:

```ts
export interface ExtractedRecipe {
  name: string;
  servings: number;
  sourceUrl: string;
  heroImageUrl: string | null;
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

  const schemaRaw = parseSchemaOrg(html);
  const raw = schemaRaw ?? await extractWithGemini(cleanHtmlWithReadability(html));
  if (!raw) throw new Error('Could not extract recipe from this URL');

  const annotated = annotateMetric(raw.ingredients);
  const heroImageUrl = resolveHeroImage(html, url);

  const matched = await matchIngredients(annotated.map(i => i.name));

  const ingredients: ImportedIngredient[] = annotated.map((ing, idx) => {
    const m = matched[idx];
    return {
      rawText: ing.name,
      canonicalFoodId: m.canonicalFoodId,
      foodName: m.foodName,
      qty: ing.qty,
      unit: ing.unit,
      section: ing.section ?? null,
      metric: ing.metric,
      optional: false,
      confidence: m.confidence,
    };
  });

  return {
    name: raw.name,
    servings: raw.servings,
    sourceUrl: url,
    heroImageUrl,
    instructions: raw.instructions,
    ingredients,
  };
}
```

- [ ] **Step 9: Add the missing import for `normalizeRecipeAmount`**

At the top of `recipe-extractor.ts`, ensure this import is present (add if missing):

```ts
import { normalizeRecipeAmount } from './recipe-quantities.js';
```

- [ ] **Step 10: Verify TypeScript compiles**

```bash
cd apps/server && pnpm tsc --noEmit
```

Expected: No errors.

- [ ] **Step 11: Commit**

```bash
git add apps/server/src/lib/recipe-extractor.ts
git commit -m "feat: rewrite recipe extractor — Readability, no-paraphrase, sections, metric annotation, hero image"
```

---

## Task 4: Unit tests for the extractor

**Files:**
- Create: `apps/server/src/lib/recipe-extractor.test.ts`

- [ ] **Step 1: Write the test file**

Create `apps/server/src/lib/recipe-extractor.test.ts`:

```ts
import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('./food-matcher.js', () => ({
  matchIngredients: vi.fn(async (names: string[]) =>
    names.map(() => ({ canonicalFoodId: null, foodName: null, confidence: 'low' as const }))
  ),
}));

vi.mock('./gemini.js', () => ({
  generateGeminiJson: vi.fn(),
}));

// Import after mocks
const { parseSchemaOrg: _parseSchemaOrg } = await import('./recipe-extractor.js');
```

Wait — `parseSchemaOrg`, `annotateMetric`, and `resolveHeroImage` are not exported. To keep the public API minimal, test them through `extractFromUrl` or export them. The cleanest approach: export the three functions under test with a `// @internal` comment.

Add these exports to the bottom of `recipe-extractor.ts`:

```ts
// Exported for testing only
export { parseSchemaOrg, annotateMetric, resolveHeroImage };
```

Then the full test file:

```ts
import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('./food-matcher.js', () => ({
  matchIngredients: vi.fn(async (names: string[]) =>
    names.map(() => ({ canonicalFoodId: null, foodName: null, confidence: 'low' as const }))
  ),
}));

vi.mock('./gemini.js', () => ({
  generateGeminiJson: vi.fn(),
}));

const { parseSchemaOrg, annotateMetric, resolveHeroImage } = await import('./recipe-extractor.js');

describe('parseSchemaOrg', () => {
  it('returns null when no ld+json script is present', () => {
    expect(parseSchemaOrg('<html><body>No schema here</body></html>')).toBeNull();
  });

  it('extracts a flat Recipe node', () => {
    const html = `<script type="application/ld+json">${JSON.stringify({
      '@type': 'Recipe',
      name: 'Simple Soup',
      recipeYield: '4',
      recipeIngredient: ['1 cup water', '1 tsp salt'],
      recipeInstructions: [{ '@type': 'HowToStep', text: 'Boil water.' }],
    })}</script>`;
    const result = parseSchemaOrg(html);
    expect(result?.name).toBe('Simple Soup');
    expect(result?.servings).toBe(4);
    expect(result?.ingredients).toHaveLength(2);
    expect(result?.instructions).toBe('Boil water.');
  });

  it('handles HowToSection in recipeInstructions', () => {
    const html = `<script type="application/ld+json">${JSON.stringify({
      '@type': 'Recipe',
      name: 'Layered Cake',
      recipeYield: '8',
      recipeIngredient: ['200g flour'],
      recipeInstructions: [
        {
          '@type': 'HowToSection',
          name: 'For the batter',
          itemListElement: [
            { '@type': 'HowToStep', text: 'Mix flour and eggs.' },
            { '@type': 'HowToStep', text: 'Pour into tin.' },
          ],
        },
        {
          '@type': 'HowToSection',
          name: 'For the icing',
          itemListElement: [
            { '@type': 'HowToStep', text: 'Beat butter and sugar.' },
          ],
        },
      ],
    })}</script>`;
    const result = parseSchemaOrg(html);
    expect(result?.instructions).toContain('## For the batter');
    expect(result?.instructions).toContain('Mix flour and eggs.');
    expect(result?.instructions).toContain('## For the icing');
    expect(result?.instructions).toContain('Beat butter and sugar.');
  });

  it('finds Recipe inside @graph array', () => {
    const html = `<script type="application/ld+json">${JSON.stringify({
      '@graph': [
        { '@type': 'WebPage', name: 'My blog' },
        { '@type': 'Recipe', name: 'Graph Pasta', recipeYield: '2', recipeIngredient: ['100g pasta'], recipeInstructions: 'Boil.' },
      ],
    })}</script>`;
    const result = parseSchemaOrg(html);
    expect(result?.name).toBe('Graph Pasta');
  });
});

describe('annotateMetric', () => {
  it('converts known volume units', () => {
    const result = annotateMetric([{ name: 'water', qty: '1', unit: 'cup' }]);
    expect(result[0].metric).toBe('240 ml');
  });

  it('converts known mass units', () => {
    const result = annotateMetric([{ name: 'butter', qty: '1', unit: 'oz' }]);
    expect(result[0].metric).toBe('28 g');
  });

  it('converts tablespoons', () => {
    const result = annotateMetric([{ name: 'oil', qty: '1', unit: 'tbsp' }]);
    expect(result[0].metric).toBe('15 ml');
  });

  it('converts teaspoons', () => {
    const result = annotateMetric([{ name: 'salt', qty: '1', unit: 'tsp' }]);
    expect(result[0].metric).toBe('5 ml');
  });

  it('returns null for unconvertible quantities', () => {
    const result = annotateMetric([
      { name: 'pepper', qty: 'pinch', unit: '' },
      { name: 'herbs', qty: 'a sprig', unit: '' },
    ]);
    expect(result[0].metric).toBeNull();
    expect(result[1].metric).toBeNull();
  });

  it('preserves section field', () => {
    const result = annotateMetric([{ name: 'milk', qty: '1', unit: 'cup', section: 'For the sauce' }]);
    expect(result[0].section).toBe('For the sauce');
    expect(result[0].metric).toBe('240 ml');
  });
});

describe('resolveHeroImage', () => {
  it('returns og:image URL', () => {
    const html = `<html><head><meta property="og:image" content="https://example.com/hero.jpg"></head></html>`;
    expect(resolveHeroImage(html, 'https://example.com/recipe')).toBe('https://example.com/hero.jpg');
  });

  it('returns twitter:image when og:image is absent', () => {
    const html = `<html><head><meta name="twitter:image" content="https://example.com/tweet.jpg"></head></html>`;
    expect(resolveHeroImage(html, 'https://example.com/recipe')).toBe('https://example.com/tweet.jpg');
  });

  it('falls back to first photo img tag', () => {
    const html = `<html><body><img src="/images/recipe-photo.jpg" /></body></html>`;
    expect(resolveHeroImage(html, 'https://example.com/recipe')).toBe('https://example.com/images/recipe-photo.jpg');
  });

  it('resolves relative og:image against base URL', () => {
    const html = `<html><head><meta property="og:image" content="/og/hero.png"></head></html>`;
    expect(resolveHeroImage(html, 'https://example.com/recipe')).toBe('https://example.com/og/hero.png');
  });

  it('returns null when no image is found', () => {
    const html = `<html><body><p>No images here</p></body></html>`;
    expect(resolveHeroImage(html, 'https://example.com/recipe')).toBeNull();
  });

  it('ignores data URIs in img tags', () => {
    const html = `<html><body><img src="data:image/png;base64,abc" /></body></html>`;
    expect(resolveHeroImage(html, 'https://example.com/recipe')).toBeNull();
  });
});
```

- [ ] **Step 2: Add the internal exports to `recipe-extractor.ts`**

At the very bottom of `apps/server/src/lib/recipe-extractor.ts`, add:

```ts
// Exported for testing only
export { parseSchemaOrg, annotateMetric, resolveHeroImage };
```

- [ ] **Step 3: Run the new tests and verify they pass**

```bash
cd apps/server && pnpm vitest run src/lib/recipe-extractor.test.ts
```

Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add apps/server/src/lib/recipe-extractor.ts apps/server/src/lib/recipe-extractor.test.ts
git commit -m "test: add unit tests for parseSchemaOrg, annotateMetric, resolveHeroImage"
```

---

## Task 5: Update recipes route to persist new fields and handle heroImageUrl

**Files:**
- Modify: `apps/server/src/routes/recipes.ts`

- [ ] **Step 1: Add `heroImageUrl` to the create schema and ingredient schema**

In `recipes.ts`, update the schemas:

```ts
const ingredientSchema = z.object({
  canonicalFoodId: z.string().uuid(),
  qty: z.string().trim().min(1).max(40),
  unit: z.string().trim().max(40),
  section: z.string().nullable().optional(),
  metricValue: z.string().nullable().optional(),
  optional: z.boolean().optional(),
});

const createSchema = z.object({
  name: z.string().trim().min(1).max(200),
  servings: z.number().positive().max(100),
  sourceUrl: z.string().trim().url().nullable().optional(),
  sourceImage: z.string().nullable().optional(),
  heroImageUrl: z.string().url().nullable().optional(),
  instructions: z.string().nullable().optional(),
  ingredients: z.array(ingredientSchema).min(1),
  photoBase64: z.string().optional(),
  photoMimeType: z.string().optional(),
});
```

Also update `updateSchema`:

```ts
const updateSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  servings: z.number().positive().max(100).optional(),
  sourceUrl: z.string().trim().url().nullable().optional(),
  sourceImage: z.string().nullable().optional(),
  heroImageUrl: z.string().url().nullable().optional(),
  instructions: z.string().nullable().optional(),
  ingredients: z.array(ingredientSchema).min(1).optional(),
  photoBase64: z.string().optional(),
  photoMimeType: z.string().optional(),
});
```

- [ ] **Step 2: Handle `heroImageUrl` in the POST route**

In the POST route, the `resolvedImage` block currently handles `photoBase64`. Extend it to also handle `heroImageUrl` when no `photoBase64` is provided:

```ts
const { name, servings, sourceUrl, sourceImage, heroImageUrl, instructions, ingredients, photoBase64, photoMimeType } = parse.data;
const recipeId = uuidv4();

let resolvedImage: string | null = sourceImage ?? null;
if (photoBase64 && photoMimeType) {
  try {
    resolvedImage = await uploadPhoto(photoBase64, photoMimeType);
  } catch (err) {
    console.error('[recipes] photo upload failed', err);
  }
} else if (heroImageUrl) {
  try {
    const imgRes = await fetch(heroImageUrl, { signal: AbortSignal.timeout(8_000) });
    if (imgRes.ok) {
      const contentType = imgRes.headers.get('content-type') ?? 'image/jpeg';
      const mimeType = contentType.split(';')[0].trim();
      const buffer = await imgRes.arrayBuffer();
      const base64 = Buffer.from(buffer).toString('base64');
      resolvedImage = await uploadPhoto(base64, mimeType);
    }
  } catch (err) {
    console.error('[recipes] hero image download/upload failed', err);
  }
}
```

- [ ] **Step 3: Persist `section` and `metricValue` on ingredients in the POST route**

Update the `tx.insert(recipeIngredients)` call to include the new fields:

```ts
await tx.insert(recipeIngredients).values(
  ingredients.map((ing, idx) => ({
    id: uuidv4(),
    recipeId,
    householdId: req.householdId,
    canonicalFoodId: ing.canonicalFoodId,
    qty: ing.qty,
    unit: ing.unit,
    section: ing.section ?? null,
    metricValue: ing.metricValue ?? null,
    optional: ing.optional ?? false,
    sortOrder: idx,
  })),
);
```

- [ ] **Step 4: Add `section` and `metricValue` to the `ingredientCols` select**

Update `ingredientCols` so the new columns are returned when loading a recipe:

```ts
const ingredientCols = {
  id: recipeIngredients.id,
  recipeId: recipeIngredients.recipeId,
  canonicalFoodId: recipeIngredients.canonicalFoodId,
  foodName: canonicalFoods.name,
  qty: recipeIngredients.qty,
  unit: recipeIngredients.unit,
  section: recipeIngredients.section,
  metricValue: recipeIngredients.metricValue,
  optional: recipeIngredients.optional,
  sortOrder: recipeIngredients.sortOrder,
};
```

- [ ] **Step 5: Apply same ingredient changes to the PUT route**

In the `tx.insert(recipeIngredients)` inside the PUT route, add `section` and `metricValue` the same way as Step 3.

- [ ] **Step 6: Verify TypeScript compiles**

```bash
cd apps/server && pnpm tsc --noEmit
```

Expected: No errors.

- [ ] **Step 7: Commit**

```bash
git add apps/server/src/routes/recipes.ts
git commit -m "feat: persist section, metricValue on ingredients; fetch+upload heroImageUrl on recipe save"
```

---

## Task 6: Update ingest route tests

**Files:**
- Modify: `apps/server/src/routes/ingest.test.ts`

- [ ] **Step 1: Update `MOCK_RECIPE` to include new fields**

In `ingest.test.ts`, update `MOCK_RECIPE`:

```ts
const MOCK_RECIPE = {
  name: 'Test Recipe',
  servings: 4,
  sourceUrl: 'https://example.com/recipe',
  sourceImage: null as null,
  heroImageUrl: 'https://example.com/hero.jpg' as string | null,
  instructions: 'Mix and bake.',
  ingredients: [
    {
      rawText: 'flour',
      canonicalFoodId: 'cf-1',
      foodName: 'flour',
      qty: '200',
      unit: 'g',
      section: null as null,
      metric: '200 g' as string | null,
      optional: false,
      confidence: 'high' as const,
    },
  ],
};
```

- [ ] **Step 2: Add assertion that heroImageUrl is returned**

In the `'returns extracted recipe on success'` test for `POST /url`:

```ts
it('returns extracted recipe on success', async () => {
  vi.mocked(extractFromUrl).mockResolvedValueOnce(MOCK_RECIPE);
  const res = await request(app).post('/api/ingest/url').send({ url: 'https://example.com/recipe' });
  expect(res.status).toBe(200);
  expect(res.body.name).toBe('Test Recipe');
  expect(res.body.heroImageUrl).toBe('https://example.com/hero.jpg');
  expect(res.body.ingredients[0].metric).toBe('200 g');
  expect(res.body.ingredients).toHaveLength(1);
});
```

- [ ] **Step 3: Run the ingest tests**

```bash
cd apps/server && pnpm vitest run src/routes/ingest.test.ts
```

Expected: All tests pass.

- [ ] **Step 4: Run the full test suite**

```bash
cd /Users/keneselautusi/Documents/Code/PROJECTS/eat-thing && pnpm test
```

Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/routes/ingest.test.ts
git commit -m "test: update ingest fixtures for heroImageUrl, section, metric fields"
```

---

## Task 7: Update PLAN.md

**Files:**
- Modify: `PLAN.md`

- [ ] **Step 1: Add the new phase before Phase 4**

In `PLAN.md`, insert a new phase section between the Phase 3 Slice 2 block and Phase 4. Add it after the Pak'nSave/Woolworths deferred note and before the `## Phase 4` heading:

```markdown
## Phase 3.5 — Recipe URL import improvements

- [x] Readability HTML cleaning before LLM fallback
- [x] No-paraphrase: preserve original ingredient text and units
- [x] Metric annotation: `metric_value` stored alongside original qty/unit (display only)
- [x] Hero image: OG tag → first photo img → uploaded to Supabase Storage on save
- [x] Sections: `HowToSection` schema.org support; Gemini sections in prompt; `section` column on recipe_ingredients; markdown headers in instructions
```

Mark all as `[x]` once the tasks above are complete.

- [ ] **Step 2: Move to Done log**

Add to the Done section at the bottom:

```markdown
- 2026-05-15 — Phase 3.5: Recipe URL import improvements landed — Readability cleaning, no-paraphrase prompt, metric annotation (display-only), hero image extraction + upload, sections support (schema.org HowToSection + Gemini sections schema + section column on recipe_ingredients).
```

- [ ] **Step 3: Commit**

```bash
git add PLAN.md
git commit -m "docs: update PLAN.md with Phase 3.5 recipe URL import improvements"
```

---

## Task 8: Note metric-as-source-of-truth in IDEAS.md

**Files:**
- Modify: `IDEAS.md`

- [ ] **Step 1: Add the idea**

Open `IDEAS.md` and append:

```markdown
## Metric values as shopping-list / cook-event source of truth

Currently `metric_value` on `recipe_ingredients` is display-only. Long-term, these pre-computed values could replace the runtime `toCanonical()` call in the shopping-list generator and cook-event route. This would make aggregation deterministic (no surprise conversion failures at list-generate time) and remove the dependency on `@eat/taxonomy` from the hot path. Would require updating `apps/server/src/lib/shopping-list-generator.ts` and the cook-event route.
```

- [ ] **Step 2: Commit**

```bash
git add IDEAS.md
git commit -m "docs: note metric-as-source-of-truth idea in IDEAS.md"
```
