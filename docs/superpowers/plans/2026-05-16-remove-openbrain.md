# Remove OpenBrain Integration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Completely remove the OpenBrain sync integration from the codebase while leaving the Meal Planner import, URL/photo import, MealDB search, and all other features fully intact.

**Architecture:** OpenBrain touches 5 layers: (1) a dedicated `packages/openbrain` client package, (2) server-side sync infrastructure (`sync_dirty` table, `/api/sync` routes, openbrain-worker, `synced` column on inventory), (3) server-side ingest routes for OpenBrain recipe import, (4) the web frontend ImportModal OpenBrain tab, and (5) references in docs/config. Each layer is excised independently; no new code is introduced.

**Tech Stack:** Drizzle ORM migrations, Express routes, React, Vitest, Playwright

---

## File Map

| File | Change |
|---|---|
| `apps/server/drizzle/0007_drop_openbrain_sync.sql` | **Create** — drop `sync_dirty` table + `synced` column |
| `apps/server/drizzle/meta/_journal.json` | **Modify** — add entry for migration 0007 |
| `apps/server/src/db/schema/sync.ts` | **Delete** |
| `apps/server/src/db/schema/inventory.ts` | **Modify** — remove `synced` column |
| `apps/server/src/db/schema/index.ts` | **Modify** — remove `export * from './sync.js'` |
| `apps/server/src/routes/sync.ts` | **Delete** |
| `apps/server/src/routes/ingest.ts` | **Modify** — remove OpenBrain routes + import |
| `apps/server/src/routes/ingest.test.ts` | **Modify** — remove OpenBrain tests + mock |
| `apps/server/src/routes/recipes.ts` | **Modify** — remove `syncRecipe` fire-and-forget calls |
| `apps/server/src/routes/inventory.ts` | **Modify** — remove `markInventoryDirty` helper + calls |
| `apps/server/src/routes/meal-plans.ts` | **Modify** — remove `markMealPlanDirty` helper + calls |
| `apps/server/src/routes/cook-events.ts` | **Modify** — remove `sync_dirty` INSERT |
| `apps/server/src/lib/openbrain-importer.ts` | **Delete** |
| `apps/server/src/lib/openbrain-importer.test.ts` | **Delete** |
| `apps/server/src/workers/openbrain-worker.ts` | **Delete** |
| `apps/server/src/app.ts` | **Modify** — remove sync router import + `app.use('/api/sync', ...)` |
| `apps/server/package.json` | **Modify** — remove `@eat/openbrain` dep + `worker:openbrain` script |
| `packages/openbrain/` | **Delete** — entire package directory |
| `apps/web/src/hooks/useIngest.ts` | **Modify** — remove OpenBrain hooks + interface |
| `apps/web/src/pages/RecipesPage/ImportModal.tsx` | **Modify** — remove OpenBrain tab + `debugger` statement |
| `apps/web/tests/app.spec.ts` | **Modify** — remove OpenBrain E2E test + tab assertion |
| `CLAUDE.md` | **Modify** — remove `packages/openbrain` mention |
| `ARCHITECTURE.md` | **Modify** — remove OpenBrain sync section |
| `DECISIONS.md` | **Modify** — add decision entry |

---

## Task 1: Database migration — drop sync_dirty and synced column

**Files:**
- Create: `apps/server/drizzle/0007_drop_openbrain_sync.sql`
- Modify: `apps/server/drizzle/meta/_journal.json`

- [ ] **Step 1.1: Write the migration SQL**

Create `apps/server/drizzle/0007_drop_openbrain_sync.sql`:

```sql
-- Drop the OpenBrain sync queue table
DROP TABLE IF EXISTS "sync_dirty";

-- Drop the synced flag from inventory_items (was flipped by the OpenBrain roll-up worker)
ALTER TABLE "inventory_items" DROP COLUMN IF EXISTS "synced";
```

- [ ] **Step 1.2: Register it in _journal.json**

In `apps/server/drizzle/meta/_journal.json`, add the entry at the end of the `entries` array:

```json
{
  "idx": 7,
  "version": "7",
  "when": 1747440000000,
  "tag": "0007_drop_openbrain_sync",
  "breakpoints": true
}
```

- [ ] **Step 1.3: Apply the migration**

```bash
pnpm --filter @eat/server db:migrate
```

Expected: Migration runs without error. Verify with:
```bash
pnpm --filter @eat/server db:migrate
```
(Running again should be a no-op — "No migrations to run".)

- [ ] **Step 1.4: Commit**

```bash
git add apps/server/drizzle/0007_drop_openbrain_sync.sql apps/server/drizzle/meta/_journal.json
git commit -m "feat: migration 0007 — drop sync_dirty table and inventory_items.synced column"
```

---

## Task 2: Remove server-side OpenBrain schema and infrastructure

**Files:**
- Delete: `apps/server/src/db/schema/sync.ts`
- Modify: `apps/server/src/db/schema/inventory.ts`
- Modify: `apps/server/src/db/schema/index.ts`
- Delete: `apps/server/src/routes/sync.ts`
- Modify: `apps/server/src/app.ts`

- [ ] **Step 2.1: Delete sync schema**

Delete `apps/server/src/db/schema/sync.ts` entirely.

- [ ] **Step 2.2: Remove synced column from inventory schema**

In `apps/server/src/db/schema/inventory.ts`, remove the `synced` line:

```ts
  synced: boolean('synced').notNull().default(false), // flipped by daily OpenBrain roll-up
```

- [ ] **Step 2.3: Remove sync export from schema index**

In `apps/server/src/db/schema/index.ts`, remove:

```ts
export * from './sync.js';
```

- [ ] **Step 2.4: Delete sync routes file**

Delete `apps/server/src/routes/sync.ts` entirely.

- [ ] **Step 2.5: Remove sync router from app.ts**

In `apps/server/src/app.ts`, remove:
```ts
import syncRouter from './routes/sync.js';
```
and remove:
```ts
app.use('/api/sync', syncRouter);
```

- [ ] **Step 2.6: Run server tests**

```bash
pnpm --filter @eat/server test
```

Expected: All tests pass. Any test referencing `sync_dirty` or `syncRouter` should already be gone since those were in `sync.ts`.

- [ ] **Step 2.7: Commit**

```bash
git add apps/server/src/db/schema/ apps/server/src/routes/sync.ts apps/server/src/app.ts
git commit -m "feat: remove sync_dirty schema, sync routes, and sync router registration"
```

---

## Task 3: Remove OpenBrain sync calls from route handlers

**Files:**
- Modify: `apps/server/src/routes/recipes.ts`
- Modify: `apps/server/src/routes/inventory.ts`
- Modify: `apps/server/src/routes/meal-plans.ts`
- Modify: `apps/server/src/routes/cook-events.ts`

- [ ] **Step 3.1: Remove syncRecipe from recipes.ts**

In `apps/server/src/routes/recipes.ts`:

Remove the import:
```ts
import { syncRecipe } from '@eat/openbrain';
```

Remove the two fire-and-forget calls (one after POST, one after PUT):
```ts
syncRecipe({ id: recipe.id, name: recipe.name, servings: recipe.servings, sourceUrl: recipe.sourceUrl, instructions: recipe.instructions, ingredients: fullIngredients.map(i => ({ foodName: i.foodName, qty: i.qty, unit: i.unit, optional: i.optional })) })
  .catch(err => console.error('OpenBrain recipe sync failed', err));
```

- [ ] **Step 3.2: Remove markInventoryDirty from inventory.ts**

In `apps/server/src/routes/inventory.ts`, remove the helper function:
```ts
async function markInventoryDirty(householdId: string) {
  await db.execute(
    sql`INSERT INTO sync_dirty (id, household_id, resource_type, resource_id, dirty_since)
    ...`
  );
}
```

And remove all three call sites:
```ts
markInventoryDirty(req.householdId).catch(err => console.error('sync_dirty write failed', err));
```

Also remove `sql` from the drizzle-orm import if it's no longer needed after removal.

- [ ] **Step 3.3: Remove markMealPlanDirty from meal-plans.ts**

In `apps/server/src/routes/meal-plans.ts`, remove the helper function:
```ts
async function markMealPlanDirty(householdId: string, mealPlanId: string) {
  await db.execute(
    sql`INSERT INTO sync_dirty ...`
  );
}
```

And remove all three call sites:
```ts
markMealPlanDirty(req.householdId, planId).catch(...);
markMealPlanDirty(req.householdId, full.mealPlanId).catch(...);
markMealPlanDirty(req.householdId, existing.mealPlanId).catch(...);
```

Also remove `sql` from the drizzle-orm import if no longer used.

- [ ] **Step 3.4: Remove sync_dirty INSERT from cook-events.ts**

In `apps/server/src/routes/cook-events.ts`, remove the raw `INSERT INTO sync_dirty` SQL block. Also remove `sql` from drizzle-orm imports if it's no longer used elsewhere in the file.

- [ ] **Step 3.5: Run server tests**

```bash
pnpm --filter @eat/server test
```

Expected: All tests pass.

- [ ] **Step 3.6: Commit**

```bash
git add apps/server/src/routes/recipes.ts apps/server/src/routes/inventory.ts apps/server/src/routes/meal-plans.ts apps/server/src/routes/cook-events.ts
git commit -m "feat: remove OpenBrain sync calls from recipe, inventory, meal-plan, and cook-event routes"
```

---

## Task 4: Remove OpenBrain ingest routes and importer

**Files:**
- Modify: `apps/server/src/routes/ingest.ts`
- Modify: `apps/server/src/routes/ingest.test.ts`
- Delete: `apps/server/src/lib/openbrain-importer.ts`
- Delete: `apps/server/src/lib/openbrain-importer.test.ts`
- Delete: `apps/server/src/workers/openbrain-worker.ts`

- [ ] **Step 4.1: Remove OpenBrain routes from ingest.ts**

In `apps/server/src/routes/ingest.ts`, remove:

```ts
import { listOpenBrainRecipes, parseOpenBrainThought } from '../lib/openbrain-importer.js';
```

Remove the two route handlers:
```ts
// GET /api/ingest/openbrain — list recipe thoughts from the household OpenBrain account
router.get('/openbrain', withHousehold, async (req, res) => { ... });

// POST /api/ingest/openbrain/parse — parse a specific OpenBrain thought into a structured recipe draft
router.post('/openbrain/parse', withHousehold, async (req, res) => { ... });
```

- [ ] **Step 4.2: Remove OpenBrain tests from ingest.test.ts**

In `apps/server/src/routes/ingest.test.ts`:

Remove the mock:
```ts
vi.mock('../lib/openbrain-importer.js', () => ({ ... }));
```

Remove the import of mocked functions:
```ts
const { listOpenBrainRecipes, parseOpenBrainThought } = await import('../lib/openbrain-importer.js');
```

Remove the entire `describe('GET /openbrain', ...)` and `describe('POST /openbrain/parse', ...)` blocks.

- [ ] **Step 4.3: Delete openbrain importer files**

```bash
rm apps/server/src/lib/openbrain-importer.ts
rm apps/server/src/lib/openbrain-importer.test.ts
rm apps/server/src/workers/openbrain-worker.ts
```

- [ ] **Step 4.4: Run server tests**

```bash
pnpm --filter @eat/server test
```

Expected: All tests pass. The ingest tests for URL, photo, search, and meal-planner routes should continue to pass.

- [ ] **Step 4.5: Commit**

```bash
git add apps/server/src/routes/ingest.ts apps/server/src/routes/ingest.test.ts
git commit -m "feat: remove OpenBrain ingest routes, importer, and worker"
```

---

## Task 5: Remove packages/openbrain and server dependency

**Files:**
- Delete: `packages/openbrain/` (entire directory)
- Modify: `apps/server/package.json`

- [ ] **Step 5.1: Delete the openbrain package**

```bash
rm -rf packages/openbrain
```

- [ ] **Step 5.2: Remove from server package.json**

In `apps/server/package.json`:

Remove from `dependencies`:
```json
"@eat/openbrain": "workspace:*",
```

Remove from `scripts`:
```json
"worker:openbrain": "tsx src/workers/openbrain-worker.ts"
```

- [ ] **Step 5.3: Reinstall dependencies**

```bash
pnpm install
```

Expected: Runs cleanly with no `@eat/openbrain` resolution errors.

- [ ] **Step 5.4: Run all tests**

```bash
pnpm test
```

Expected: All tests pass.

- [ ] **Step 5.5: Commit**

```bash
git add packages/openbrain apps/server/package.json pnpm-lock.yaml
git commit -m "feat: delete @eat/openbrain package and remove server dependency"
```

---

## Task 6: Remove OpenBrain from the web frontend

**Files:**
- Modify: `apps/web/src/hooks/useIngest.ts`
- Modify: `apps/web/src/pages/RecipesPage/ImportModal.tsx`
- Modify: `apps/web/tests/app.spec.ts`

- [ ] **Step 6.1: Remove OpenBrain hooks from useIngest.ts**

In `apps/web/src/hooks/useIngest.ts`, remove:

```ts
export interface OpenBrainRecipePreview {
  id: string;
  title: string;
  preview?: string;
  alreadyImported: boolean;
}
```

Remove the two hooks:
```ts
export function useIngestOpenBrainList(enabled: boolean) { ... }
export function useIngestOpenBrainParse() { ... }
```

- [ ] **Step 6.2: Remove OpenBrain tab from ImportModal.tsx**

In `apps/web/src/pages/RecipesPage/ImportModal.tsx`:

1. Remove the `debugger;` statement (line 42 in `handleUrlExtract`).

2. Remove the imports:
```ts
useIngestOpenBrainList,
useIngestOpenBrainParse,
```

3. Change the `Tab` type (remove `'openbrain'`):
```ts
type Tab = 'url' | 'photo' | 'search' | 'mealPlanner';
```

4. Remove the hook calls:
```ts
const openBrainList = useIngestOpenBrainList(tab === 'openbrain');
const openBrainParse = useIngestOpenBrainParse();
```

5. Remove `openBrainParse.isPending` and `openBrainParse.error` from the `isLoading` and `error` derivations.

6. Remove the tab button from the tab strip:
```tsx
// remove the 'openbrain' case in the tabs map
```

Update the tabs array to remove `'openbrain'`:
```ts
(['url', 'photo', 'search', 'mealPlanner'] as Tab[]).map(t => (
```
And update the label mapping to remove the `'openbrain'` branch.

7. Remove the entire `{tab === 'openbrain' && ( ... )}` JSX block.

- [ ] **Step 6.3: Remove OpenBrain E2E tests**

In `apps/web/tests/app.spec.ts`:

1. Remove `await expect(page.getByRole('button', { name: 'OpenBrain', exact: true })).toBeVisible();` from the import modal smoke test.

2. Delete the entire test:
```ts
test('recipes page imports an OpenBrain thought into the confirmation form', async ({ page }) => { ... });
```

- [ ] **Step 6.4: Run web tests**

```bash
pnpm --filter @eat/web test
```

Expected: All unit tests pass.

- [ ] **Step 6.5: Run E2E tests**

```bash
pnpm test:e2e
```

Expected: 15 tests pass (previously 14 passed + 2 failed — now the removed OpenBrain test is gone and the Meal Planner import test should still pass since it was failing for a different reason; investigate if it still fails).

- [ ] **Step 6.6: Commit**

```bash
git add apps/web/src/hooks/useIngest.ts apps/web/src/pages/RecipesPage/ImportModal.tsx apps/web/tests/app.spec.ts
git commit -m "feat: remove OpenBrain tab from ImportModal, hooks, and E2E tests; remove debugger statement"
```

---

## Task 7: Update docs and clean up config references

**Files:**
- Modify: `CLAUDE.md`
- Modify: `ARCHITECTURE.md`
- Modify: `DECISIONS.md`

- [ ] **Step 7.1: Update CLAUDE.md**

In `CLAUDE.md`, find the line:
```
- Turborepo monorepo: `apps/web` (PWA) · `apps/server` (Express + Better-Auth + Drizzle) · `apps/scraper` (Playwright on home Mac mini) · `packages/shared` · `packages/taxonomy` · `packages/openbrain`.
```

Remove `· `packages/openbrain`` from it. Also remove or update:
```
- `packages/openbrain` is a sync target only. No app logic should depend on reading from OpenBrain.
```
Delete that bullet entirely.

- [ ] **Step 7.2: Update ARCHITECTURE.md**

Remove any sections, diagrams, or bullet points that reference OpenBrain, the sync worker, the `sync_dirty` table, or the `synced` column. Keep the Meal Planner integration intact.

- [ ] **Step 7.3: Add decision entry to DECISIONS.md**

Add a new numbered entry at the top/bottom of the decisions log:

```markdown
## Decision N: Remove OpenBrain sync integration (2026-05-16)

Removed the full OpenBrain sync integration: `packages/openbrain`, the `sync_dirty` table,
`/api/sync` routes, `openbrain-worker`, the `synced` column on `inventory_items`, the OpenBrain
import tab in the ImportModal, and all associated server-side sync fire-and-forgets.

**Why:** OpenBrain is no longer the integration target. The Meal Planner integration (via MCP)
replaces it as the recipe source, and we have no need for inventory/meal-plan push sync to
an external brain store. Removing dead code simplifies the codebase and eliminates a launchd
worker that wasn't running.

**What's kept:** Meal Planner import (MCP), URL import, photo import, MealDB search.
```

- [ ] **Step 7.4: Commit**

```bash
git add CLAUDE.md ARCHITECTURE.md DECISIONS.md
git commit -m "docs: remove OpenBrain references from CLAUDE.md, ARCHITECTURE.md; add removal decision"
```

---

## Task 8: Full test suite

- [ ] **Step 8.1: Run all unit tests**

```bash
pnpm test
```

Expected: All tests pass with no failures.

- [ ] **Step 8.2: Run E2E tests**

```bash
pnpm test:e2e
```

Expected: 15 E2E tests pass. If the Meal Planner import test (previously failing) now passes — great. If it still fails, note it separately; it's pre-existing and not caused by this removal.
