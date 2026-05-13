# Meal Planner Recipe Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Import structured recipes from the OpenBrain ecosystem's Meal Planner data instead of parsing unstructured OpenBrain recipe thoughts.

**Architecture:** Keep eat-thing as the source of truth after import. Add a Meal Planner importer behind the existing `/api/ingest` surface, normalize Meal Planner recipe JSON into `ImportedRecipe`, run ingredient matching through the existing `food-matcher`, then reuse the current edit-and-confirm `RecipeForm` save flow. Treat OpenBrain recipe-thought import as legacy/fallback UI, not the preferred OpenBrain ecosystem path.

**Tech Stack:** Express, Drizzle, `@eat/meal-planning` MCP adapter, Zod, React 19, TanStack Query, Vitest, Playwright.

---

## File Structure

- Create `packages/meal-planning`: dedicated Meal Planner MCP adapter. This import must not call through `@eat/openbrain`.
- Modify `apps/server/package.json`: depend on `@eat/meal-planning`.
- Create `apps/server/src/lib/meal-planner-importer.ts`: list Meal Planner recipes, fetch one recipe, map structured fields into `ImportedRecipe`, and call `matchIngredients`.
- Create `apps/server/src/lib/meal-planner-importer.test.ts`: unit coverage for structured mapping, ingredient matching, duplicate detection metadata, and malformed payload handling.
- Modify `apps/server/src/routes/ingest.ts`: add Meal Planner list/parse endpoints alongside existing OpenBrain endpoints.
- Modify `apps/server/src/routes/ingest.test.ts`: route tests for new endpoints and validation.
- Modify `apps/web/src/hooks/useIngest.ts`: add `useIngestMealPlannerList` and `useIngestMealPlannerParse`.
- Modify `apps/web/src/pages/RecipesPage/ImportModal.tsx`: add a `Meal Planner` tab and make it the OpenBrain ecosystem import path.
- Modify `apps/web/src/pages/RecipesPage/ImportModal.css`: style the new list state only if existing result styles are insufficient.
- Modify `apps/web/tests/app.spec.ts`: add E2E coverage for importing a Meal Planner recipe into the review form.
- Modify `PLAN.md`: add this work to Phase 2 follow-up or Cross-cutting, then move it to Done only after full test suite passes.
- Modify `DECISIONS.md`: add a decision superseding or refining D18: OpenBrain ecosystem imports prefer structured Meal Planner data over recipe thoughts.
- Modify `ARCHITECTURE.md`: update recipe ingestion/OpenBrain notes to say imports may read from Meal Planner as a migration/import source, while runtime app logic still does not depend on OpenBrain reads.

## Task 1: Discover Meal Planner MCP Contract

**Files:**
- Create: `packages/meal-planning/package.json`
- Create: `packages/meal-planning/tsconfig.json`
- Create: `packages/meal-planning/src/index.ts`
- Test: `packages/meal-planning/src/client.test.ts`

- [x] **Step 1: Inspect the available OpenBrain/Meal Planner tools**

Run a local discovery command or temporary script against the configured MCP endpoint. Record:

```text
tool name for listing Meal Planner recipes: search_recipes
tool name for fetching one Meal Planner recipe: none exposed; search_recipes returns full structured recipe rows
list response shape: JSON array of recipe objects
detail response shape: same recipe object from search_recipes result
stable recipe id field: id
servings/yield field: servings
ingredient fields: ingredients[].name, ingredients[].quantity, ingredients[].unit
instructions fields: instructions[]
source URL/image fields: none exposed; notes/tags are available
```

Expected: a concrete tool contract that can be represented in tests without live MCP.

- [x] **Step 2: Add dedicated Meal Planning adapter coverage before implementation**

In `packages/meal-planning/src/client.test.ts`, add a test shaped like this:

```ts
it('calls the Meal Planning MCP search_recipes tool and parses JSON text content', async () => {
  process.env.MEAL_PLANNING_BASE_URL = 'https://meal-planning.example/mcp';
  process.env.MEAL_PLANNING_API_KEY = 'test-key';
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    text: async () => JSON.stringify({
      result: {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              id: 'mp-1',
              name: 'Lemon Pasta',
              servings: 4,
              ingredients: [{ name: 'spaghetti', quantity: '400', unit: 'g' }],
              instructions: ['Boil pasta.', 'Toss with lemon.'],
            }),
          },
        ],
      },
    }),
  });

  const result = await searchRecipes({
    query: 'lemon',
  });
  expect(result[0]).toMatchObject({ id: 'mp-1', name: 'Lemon Pasta', servings: 4 });
});
```

Run: `pnpm --filter @eat/meal-planning test`

Expected: FAIL because `packages/meal-planning/src/index.ts` does not exist yet.

- [x] **Step 3: Implement the Meal Planning package**

In `packages/meal-planning/src/index.ts`, expose:

```ts
export interface MealPlannerRecipe {
  id: string;
  name: string;
  servings?: number | null;
  ingredients: { name: string; quantity: string; unit: string }[];
  instructions?: string[] | null;
}

export async function searchRecipes(options: {
  query?: string;
  cuisine?: string;
  ingredient?: string;
  tag?: string;
} = {}): Promise<MealPlannerRecipe[]> {
  return callMealPlanningTool<MealPlannerRecipe[]>('search_recipes', { ...options });
}
```

The package owns the Meal Planner MCP transport via `MEAL_PLANNING_BASE_URL`/`MEAL_PLANNING_API_KEY` for HTTP or `MEAL_PLANNING_COMMAND`/`MEAL_PLANNING_ARGS` for stdio.

Run: `pnpm --filter @eat/meal-planning test`

Expected: PASS.

Historical note: the first draft routed Meal Planner through `@eat/openbrain`; that was corrected. Do not reintroduce `callOpenBrainTool` for this import path.

## Task 2: Add Meal Planner Importer

**Files:**
- Create: `apps/server/src/lib/meal-planner-importer.ts`
- Create: `apps/server/src/lib/meal-planner-importer.test.ts`

- [x] **Step 1: Write importer tests against the discovered structured payload**

Use the discovered payload shape. The test should assert:

```ts
vi.mock('@eat/meal-planning', () => ({
  searchRecipes: vi.fn(),
}));

vi.mock('./food-matcher.js', () => ({
  matchIngredients: vi.fn(),
}));

it('lists Meal Planner recipes and marks existing names as already imported', async () => {
  vi.mocked(searchRecipes).mockResolvedValue([
    { id: 'mp-1', name: 'Lemon Pasta', servings: 4, ingredients: [], instructions: [] },
  ]);

  const rows = await listMealPlannerRecipes(new Set(['lemon pasta']));

  expect(rows).toEqual([
    {
      id: 'mp-1',
      title: 'Lemon Pasta',
      preview: '4 servings',
      alreadyImported: true,
    },
  ]);
});

it('maps structured Meal Planner recipe detail into ImportedRecipe', async () => {
  vi.mocked(searchRecipes).mockResolvedValue([
    {
      id: 'mp-1',
      name: 'Lemon Pasta',
      servings: 4,
      instructions: ['Boil pasta.', 'Toss with lemon.'],
      ingredients: [
        { name: 'spaghetti', quantity: '400', unit: 'g' },
        { name: 'lemon', quantity: '1', unit: '' },
      ],
    },
  ]);
  vi.mocked(matchIngredients).mockResolvedValue([
    { canonicalFoodId: 'cf-pasta', foodName: 'spaghetti', confidence: 0.98 },
    { canonicalFoodId: 'cf-lemon', foodName: 'lemon', confidence: 0.98 },
  ]);

  const recipe = await parseMealPlannerRecipe('mp-1');

  expect(recipe).toMatchObject({
    name: 'Lemon Pasta',
    servings: 4,
    sourceUrl: null,
    sourceImage: null,
    instructions: 'Boil pasta.\nToss with lemon.',
    ingredients: [
      { rawText: 'spaghetti', canonicalFoodId: 'cf-pasta', foodName: 'spaghetti', qty: 400, unit: 'g', optional: false },
      { rawText: 'lemon', canonicalFoodId: 'cf-lemon', foodName: 'lemon', qty: 1, unit: 'count', optional: false },
    ],
  });
});
```

Run: `pnpm --filter @eat/server test -- meal-planner-importer`

Expected: FAIL because the importer does not exist.

- [x] **Step 2: Implement importer normalization**

Create `apps/server/src/lib/meal-planner-importer.ts`:

```ts
import { searchRecipes, type MealPlannerRecipe } from '@eat/meal-planning';
import { matchIngredients } from './food-matcher.js';
import type { ImportedIngredient, ImportedRecipe } from '@eat/shared';

export interface MealPlannerRecipePreview {
  id: string;
  title: string;
  preview: string;
  alreadyImported: boolean;
}

export async function listMealPlannerRecipes(existingNames: Set<string>): Promise<MealPlannerRecipePreview[]> {
  const recipes = await searchRecipes({});
  return recipes.map((recipe) => ({
    id: recipe.id,
    title: recipe.name,
    preview: `${recipe.servings ?? 4} servings`,
    alreadyImported: existingNames.has(recipe.name.toLowerCase()),
  }));
}

export async function parseMealPlannerRecipe(id: string): Promise<ImportedRecipe> {
  const recipes = await searchRecipes({});
  const source = recipes.find((recipe) => recipe.id === id);
  if (!source) throw new Error('Meal Planner recipe not found');

  if (!source.ingredients.length) {
    throw new Error('Meal Planner recipe has no ingredients');
  }

  const matched = await matchIngredients(source.ingredients.map((ingredient) => ingredient.name));
  const ingredients: ImportedIngredient[] = source.ingredients.map((ingredient, index) => {
    const match = matched[index];
    return {
      rawText: ingredient.name,
      canonicalFoodId: match.canonicalFoodId,
      foodName: match.foodName,
      qty: Number.parseFloat(ingredient.quantity) || 1,
      unit: ingredient.unit === 'g' || ingredient.unit === 'ml' ? ingredient.unit : 'count',
      optional: false,
      confidence: match.confidence,
    };
  });

  const instructions = Array.isArray(source.instructions)
    ? source.instructions.join('\n')
    : source.instructions ?? null;

  return {
    name: source.name,
    servings: source.servings ?? 4,
    sourceUrl: null,
    sourceImage: null,
    instructions,
    ingredients,
  };
}
```

Meal Planner currently exposes `search_recipes` rather than a fetch-by-id tool, so `parseMealPlannerRecipe` searches and selects the matching `id`. If a fetch tool is added later, replace only the internal lookup while preserving the public functions.

Run: `pnpm --filter @eat/server test -- meal-planner-importer`

Expected: PASS.

## Task 3: Add Server Routes

**Files:**
- Modify: `apps/server/src/routes/ingest.ts`
- Modify: `apps/server/src/routes/ingest.test.ts`

- [x] **Step 1: Add failing route tests**

Mock the importer:

```ts
vi.mock('../lib/meal-planner-importer.js', () => ({
  listMealPlannerRecipes: vi.fn(),
  parseMealPlannerRecipe: vi.fn(),
}));
```

Add tests:

```ts
it('lists Meal Planner recipes with household duplicate detection', async () => {
  vi.mocked(listMealPlannerRecipes).mockResolvedValue([
    { id: 'mp-1', title: 'Lemon Pasta', preview: '4 servings', alreadyImported: false },
  ]);

  const res = await request(app).get('/api/ingest/meal-planner');

  expect(res.status).toBe(200);
  expect(res.body[0].title).toBe('Lemon Pasta');
});

it('parses a Meal Planner recipe into an imported recipe draft', async () => {
  vi.mocked(parseMealPlannerRecipe).mockResolvedValue(importedRecipe);

  const res = await request(app).post('/api/ingest/meal-planner/parse').send({ id: 'mp-1' });

  expect(res.status).toBe(200);
  expect(res.body.name).toBe(importedRecipe.name);
});

it('rejects Meal Planner parse without an id', async () => {
  const res = await request(app).post('/api/ingest/meal-planner/parse').send({});
  expect(res.status).toBe(400);
});
```

Run: `pnpm --filter @eat/server test -- ingest`

Expected: FAIL because the routes do not exist.

- [x] **Step 2: Add route handlers**

In `apps/server/src/routes/ingest.ts`, import:

```ts
import { listMealPlannerRecipes, parseMealPlannerRecipe } from '../lib/meal-planner-importer.js';
```

Add routes after the existing OpenBrain routes:

```ts
router.get('/meal-planner', withHousehold, async (req, res) => {
  try {
    const rows = await db
      .select({ name: recipes.name })
      .from(recipes)
      .where(eq(recipes.householdId, req.householdId));
    const existingNames = new Set(rows.map((r) => r.name.toLowerCase()));

    const previews = await listMealPlannerRecipes(existingNames);
    res.json(previews);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to list Meal Planner recipes';
    console.error('[ingest/meal-planner]', err);
    res.status(502).json({ error: msg });
  }
});

router.post('/meal-planner/parse', withHousehold, async (req, res) => {
  const parse = z.object({ id: z.string().min(1) }).safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: 'id is required' });
    return;
  }

  try {
    const recipe = await parseMealPlannerRecipe(parse.data.id);
    res.json(recipe);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to parse Meal Planner recipe';
    console.error('[ingest/meal-planner/parse]', err);
    res.status(422).json({ error: msg });
  }
});
```

Run: `pnpm --filter @eat/server test -- ingest`

Expected: PASS.

## Task 4: Add Web Import Hooks and UI

**Files:**
- Modify: `apps/web/src/hooks/useIngest.ts`
- Modify: `apps/web/src/pages/RecipesPage/ImportModal.tsx`
- Modify: `apps/web/src/pages/RecipesPage/ImportModal.css`

- [x] **Step 1: Add hooks**

In `apps/web/src/hooks/useIngest.ts`, add:

```ts
export interface MealPlannerRecipePreview {
  id: string;
  title: string;
  preview: string;
  alreadyImported: boolean;
}

export function useIngestMealPlannerList(enabled: boolean) {
  return useQuery({
    queryKey: ['ingest', 'meal-planner', 'list'],
    queryFn: () => api.get<MealPlannerRecipePreview[]>('/api/ingest/meal-planner'),
    enabled,
    staleTime: 60_000,
  });
}

export function useIngestMealPlannerParse() {
  return useMutation({
    mutationFn: (id: string) => api.post<ImportedRecipe>('/api/ingest/meal-planner/parse', { id }),
  });
}
```

- [x] **Step 2: Wire the tab**

In `ImportModal.tsx`, extend:

```ts
type Tab = 'url' | 'photo' | 'search' | 'mealPlanner' | 'openbrain';
```

Import and instantiate the hooks:

```ts
const mealPlannerList = useIngestMealPlannerList(tab === 'mealPlanner');
const mealPlannerParse = useIngestMealPlannerParse();
```

Include `mealPlannerParse.isPending` and `mealPlannerParse.error` in the existing loading/error aggregation.

Render tabs in this order:

```ts
(['url', 'photo', 'search', 'mealPlanner', 'openbrain'] as Tab[])
```

Use label:

```ts
t === 'mealPlanner' ? 'Meal Planner' : t === 'openbrain' ? 'OpenBrain notes' : ...
```

Add the Meal Planner panel:

```tsx
{tab === 'mealPlanner' && (
  <div className="import-form">
    <p className="import-hint">Import structured recipes from Meal Planner in your OpenBrain ecosystem.</p>
    {mealPlannerList.isLoading && <p className="recipes-status">Loading from Meal Planner...</p>}
    {mealPlannerList.isError && (
      <p className="form-error">{(mealPlannerList.error as Error).message}</p>
    )}
    {error && <p className="form-error">{error}</p>}
    {mealPlannerList.data && mealPlannerList.data.length === 0 && (
      <p className="recipes-status empty">No Meal Planner recipes found.</p>
    )}
    {mealPlannerList.data && mealPlannerList.data.length > 0 && (
      <ul className="search-results">
        {mealPlannerList.data.map((recipe) => (
          <li key={recipe.id} className="search-result-item">
            <div className="search-result-info">
              <strong>{recipe.title}</strong>
              <span>{recipe.preview || 'Structured Meal Planner recipe'}</span>
              {recipe.alreadyImported && <span className="openbrain-badge">Already in eat-thing</span>}
            </div>
            <button
              className="btn-secondary"
              disabled={isLoading}
              onClick={async () => {
                const result = await mealPlannerParse.mutateAsync(recipe.id);
                setImported(result);
              }}
            >
              {mealPlannerParse.isPending ? 'Importing...' : 'Import'}
            </button>
          </li>
        ))}
      </ul>
    )}
  </div>
)}
```

Run: `pnpm --filter @eat/web test -- ImportModal`

Expected: PASS or no matching unit test. Continue to E2E in Task 5.

## Task 5: Add E2E Coverage

**Files:**
- Modify: `apps/web/tests/app.spec.ts`

- [ ] **Step 1: Add mocked API routes and browser flow**

Add a test near the existing OpenBrain import E2E:

```ts
test('recipes page imports a Meal Planner recipe into the confirmation form', async ({ page }) => {
  await page.route('**/api/ingest/meal-planner', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: 'mp-1',
          title: 'Lemon Pasta',
          preview: '4 servings',
          alreadyImported: false,
        },
      ]),
    }),
  );

  await page.route('**/api/ingest/meal-planner/parse', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        name: 'Lemon Pasta',
        servings: 4,
        sourceUrl: null,
        sourceImage: null,
        instructions: 'Boil pasta.\nToss with lemon.',
        ingredients: [
          {
            rawText: 'spaghetti',
            canonicalFoodId: 'cf-pasta',
            foodName: 'spaghetti',
            qty: 400,
            unit: 'g',
            optional: false,
            confidence: 0.98,
          },
        ],
      }),
    }),
  );

  await page.goto('/recipes');
  await page.getByRole('button', { name: /new recipe/i }).click();
  await page.getByRole('button', { name: 'Meal Planner', exact: true }).click();
  await expect(page.getByText('Lemon Pasta')).toBeVisible();
  await page.getByRole('button', { name: 'Import', exact: true }).click();
  await expect(page.getByRole('heading', { name: /review imported recipe/i })).toBeVisible();
  await expect(page.getByDisplayValue('Lemon Pasta')).toBeVisible();
});
```

Run: `pnpm --filter @eat/web test:e2e`

Expected: PASS.

## Task 6: Update Product Docs and Decision Log

**Files:**
- Modify: `PLAN.md`
- Modify: `DECISIONS.md`
- Modify: `ARCHITECTURE.md`

- [ ] **Step 1: Add a current task to `PLAN.md`**

Add under Phase 2:

```md
- [~] Meal Planner recipe import from the OpenBrain ecosystem: structured list + parse flow replacing OpenBrain notes as the preferred import source
```

Do not move to Done until both `pnpm test` and `pnpm test:e2e` have passed.

- [ ] **Step 2: Add a decision to `DECISIONS.md`**

Append:

```md
## D19 — OpenBrain ecosystem recipe imports prefer Meal Planner structured data
**Date:** 2026-05-13
**Context:** The existing OpenBrain bulk import reads recipe thoughts and parses prose/markdown, but Meal Planner is part of the OpenBrain ecosystem and stores recipes with structured fields.
**Decision:** New OpenBrain ecosystem recipe imports read from Meal Planner first. OpenBrain recipe-thought import remains as a legacy fallback for old notes.
**Rationale:** Structured Meal Planner payloads reduce LLM parsing, preserve quantities/servings more reliably, and still satisfy the intent of importing from the OpenBrain ecosystem. Eat-thing remains the source of truth after import.
```

- [ ] **Step 3: Update `ARCHITECTURE.md`**

In "Add recipe", change:

```md
User submits (manual / URL / photo / search)
```

to:

```md
User submits (manual / URL / photo / search / Meal Planner import)
```

In "OpenBrain sync", add:

```md
Imports may read structured Meal Planner recipes as a one-off migration/import source. Runtime app behavior still does not depend on reading from OpenBrain or Meal Planner; imported recipes are copied into eat-thing tables and edited/confirmed before save.
```

## Task 7: Full Verification

**Files:**
- No source edits unless verification reveals failures.

- [ ] **Step 1: Run unit tests**

Run: `pnpm test`

Expected: PASS.

- [ ] **Step 2: Run E2E tests**

Run: `pnpm test:e2e`

Expected: PASS.

- [ ] **Step 3: Update `PLAN.md` completion state**

Only after both suites pass, move the Meal Planner import task to `Done`:

```md
- 2026-05-13 — Meal Planner recipe import from the OpenBrain ecosystem landed: structured list + parse endpoints, import modal tab, edit-and-confirm flow, unit + E2E coverage.
```

## Notes and Guardrails

- Do not insert new canonical foods silently. Unknown or low-confidence Meal Planner ingredients must pass through existing `matchIngredients` confidence handling and the `RecipeForm` review flow.
- Every server route must use `withHousehold`; duplicate detection must only look at recipes in `req.householdId`.
- Do not make runtime recipe listing depend on Meal Planner. This is an importer/migration source only.
- Preserve the existing OpenBrain notes importer until the user confirms it should be removed.
- If the Meal Planner MCP contract cannot supply quantities/units, stop and revise the plan before implementation; the point of this change is structured data, not another prose parser.
