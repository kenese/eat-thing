# Plan Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the fixed Monday–Sunday meal-plan model with a rolling 17-day window centred on today. Drop auto-generate of the shopping list; replace with an explicit "Add from planned recipes" modal that re-derives recipe-sourced items from selected days.

**Architecture:** Drop `meal_plans` table entirely; `meal_plan_entries` becomes self-contained with `household_id`. Replace week-keyed API with date-range API. Add `source_recipe_id` to `shopping_list_items` for modal pre-tick matching. New `POST /api/shopping-lists/from-plan` endpoint replaces `/generate`.

**Tech Stack:** Drizzle ORM + Postgres (Supabase), Express, TanStack Query, React 19, Vitest, Playwright. Monorepo via Turborepo: `apps/server`, `apps/web`, `packages/shared`.

**Spec:** [docs/superpowers/specs/2026-05-16-plan-refactor-design.md](../specs/2026-05-16-plan-refactor-design.md)

---

## Task 1: Database migration & Drizzle schema

**Files:**
- Create: `apps/server/drizzle/0008_plan_refactor.sql`
- Modify: `apps/server/drizzle/meta/_journal.json`
- Modify: `apps/server/src/db/schema/meal-plans.ts`
- Modify: `apps/server/src/db/schema/shopping.ts`

- [ ] **Step 1: Write the migration SQL**

Create `apps/server/drizzle/0008_plan_refactor.sql`:

```sql
-- Plan refactor: drop weekly meal_plans grouping; entries own household_id directly.
-- Add source_recipe_id to shopping_list_items for modal pre-tick matching.

-- 1. Backfill household_id on meal_plan_entries (column already exists as NOT NULL, but
--    we need to ensure the FK to meal_plans is removable). Drop FK first.
ALTER TABLE "meal_plan_entries" DROP CONSTRAINT IF EXISTS "meal_plan_entries_meal_plan_id_meal_plans_id_fk";

-- 2. Drop the meal_plan_id column from meal_plan_entries.
ALTER TABLE "meal_plan_entries" DROP COLUMN IF EXISTS "meal_plan_id";

-- 3. Drop the FK on shopping_lists.generated_from_meal_plan_id, then the column.
ALTER TABLE "shopping_lists" DROP CONSTRAINT IF EXISTS "shopping_lists_generated_from_meal_plan_id_meal_plans_id_fk";
ALTER TABLE "shopping_lists" DROP COLUMN IF EXISTS "generated_from_meal_plan_id";

-- 4. Drop the meal_plans table entirely.
DROP TABLE IF EXISTS "meal_plans";

-- 5. Add source_recipe_id to shopping_list_items (nullable; only recipe-sourced items carry it).
ALTER TABLE "shopping_list_items"
  ADD COLUMN "source_recipe_id" uuid REFERENCES "recipes"("id") ON DELETE SET NULL;
```

- [ ] **Step 2: Update the migration journal**

Read `apps/server/drizzle/meta/_journal.json` and append a new entry for `0008_plan_refactor`. Use Unix timestamp `1747526400000` (2026-05-17, one day after the previous entry's `1747440000000`):

```json
{
  "idx": 8,
  "version": "7",
  "when": 1747526400000,
  "tag": "0008_plan_refactor",
  "breakpoints": true
}
```

Insert this object inside the `entries` array, after the existing index-7 entry.

- [ ] **Step 3: Update the `meal-plans.ts` schema file**

Replace the contents of `apps/server/src/db/schema/meal-plans.ts` with:

```typescript
import { pgTable, uuid, date, doublePrecision } from 'drizzle-orm/pg-core';
import { households } from './households.js';
import { recipes } from './recipes.js';
import { mealStatusEnum } from './enums.js';

export const mealPlanEntries = pgTable('meal_plan_entries', {
  id: uuid('id').primaryKey().defaultRandom(),
  householdId: uuid('household_id').notNull().references(() => households.id, { onDelete: 'cascade' }),
  date: date('date').notNull(),
  recipeId: uuid('recipe_id').notNull().references(() => recipes.id),
  servings: doublePrecision('servings').notNull(),
  status: mealStatusEnum('status').notNull().default('planned'),
});
```

Note: the `mealPlans` export is removed; the `timestamp` import is dropped; `createdAt` is omitted (it wasn't used anywhere — confirm via grep that no code reads `mealPlanEntries.createdAt`).

- [ ] **Step 4: Update the `shopping.ts` schema file**

Modify `apps/server/src/db/schema/shopping.ts`:

1. Remove the `import { mealPlans } from './meal-plans.js';` line.
2. Remove the `generatedFromMealPlanId` column from `shoppingLists` definition.
3. Add `recipes` import: `import { recipes } from './recipes.js';`
4. Add `sourceRecipeId` column to `shoppingListItems`:

```typescript
sourceRecipeId: uuid('source_recipe_id').references(() => recipes.id, { onDelete: 'set null' }),
```

Place it after the `sourceRecipeNames` column. The final file:

```typescript
import { pgTable, uuid, text, timestamp, doublePrecision, boolean, unique } from 'drizzle-orm/pg-core';
import { households } from './households.js';
import { canonicalFoods } from './foods.js';
import { recipes } from './recipes.js';
import { shoppingSourceEnum } from './enums.js';

export const shoppingLists = pgTable('shopping_lists', {
  id: uuid('id').primaryKey().defaultRandom(),
  householdId: uuid('household_id').notNull().references(() => households.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  finalizedAt: timestamp('finalized_at'),
});

export const shoppingListItems = pgTable('shopping_list_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  shoppingListId: uuid('shopping_list_id').notNull().references(() => shoppingLists.id, { onDelete: 'cascade' }),
  householdId: uuid('household_id').notNull().references(() => households.id, { onDelete: 'cascade' }),
  canonicalFoodId: uuid('canonical_food_id').references(() => canonicalFoods.id),
  name: text('name').notNull(),
  qty: doublePrecision('qty').notNull(),
  unit: text('unit').notNull(),
  source: shoppingSourceEnum('source').notNull(),
  checked: boolean('checked').notNull().default(false),
  sourceRecipeNames: text('source_recipe_names').array(),
  sourceRecipeId: uuid('source_recipe_id').references(() => recipes.id, { onDelete: 'set null' }),
});

export const staples = pgTable('staples', {
  id: uuid('id').primaryKey().defaultRandom(),
  householdId: uuid('household_id').notNull().references(() => households.id, { onDelete: 'cascade' }),
  canonicalFoodId: uuid('canonical_food_id').notNull().references(() => canonicalFoods.id, { onDelete: 'cascade' }),
  thresholdQty: doublePrecision('threshold_qty').notNull(),
  thresholdUnit: text('threshold_unit').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, t => [unique().on(t.householdId, t.canonicalFoodId)]);
```

- [ ] **Step 5: Apply the migration**

Run: `pnpm --filter @eat/server db:migrate`

Expected output: migration `0008_plan_refactor` applied successfully (no errors).

If the migration fails because `meal_plan_entries.household_id` is NULL for existing rows (it shouldn't be — it's `NOT NULL` per the schema), inspect the existing rows; you may need a one-shot `UPDATE` first. For a fresh DB this won't happen.

- [ ] **Step 6: Verify no remaining references to `mealPlans` in server code**

Run: `grep -rn "mealPlans\b" apps/server/src --include="*.ts"`

Expected: only references inside `apps/server/src/db/dist/` (if any) or test files we'll update later. The active source files (`routes/meal-plans.ts`, `routes/shopping-lists.ts`) still reference it — they'll be rewritten in Tasks 4 and 5. **Do not commit yet** — the codebase is intentionally broken between Task 1 and Task 4.

- [ ] **Step 7: Commit**

```bash
git add apps/server/drizzle/0008_plan_refactor.sql apps/server/drizzle/meta/_journal.json apps/server/src/db/schema/meal-plans.ts apps/server/src/db/schema/shopping.ts
git commit -m "feat(db): drop meal_plans table, add source_recipe_id to shopping_list_items"
```

The server `pnpm build` will fail at this point because the route code still references `mealPlans`. That's expected — fixed in Tasks 4–5.

---

## Task 2: Shared types

**Files:**
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: Update the meal-plan types**

In `packages/shared/src/index.ts`, replace the entire `// ─── Meal plans ───` block (lines ~152–183) with:

```typescript
// ─── Meal plans ───────────────────────────────────────────────────────────────

export type MealStatus = 'planned' | 'cooked' | 'skipped';

export interface MealPlanEntry {
  id: string;
  date: string; // YYYY-MM-DD
  recipeId: string;
  recipeName: string;
  servings: number;
  status: MealStatus;
}

export interface MealPlanEntriesResponse {
  entries: MealPlanEntry[];
}

export interface CreateMealPlanEntryInput {
  date: string;
  recipeId: string;
  servings: number;
}

export interface UpdateMealPlanEntryInput {
  date?: string;
  servings?: number;
  status?: MealStatus;
}
```

Changes: removed `mealPlanId` from `MealPlanEntry`, removed `MealPlanWeek`, removed `weekStart` from `CreateMealPlanEntryInput`, added `MealPlanEntriesResponse`.

- [ ] **Step 2: Update the shopping-list types**

In the same file, in the `// ─── Shopping lists ───` block:

1. Add `sourceRecipeId: string | null;` to `ShoppingListItem` (after `sourceRecipeNames`).
2. Remove `generatedFromMealPlanId: string | null;` from `ShoppingList`.
3. Remove `GenerateShoppingListInput`.
4. Add a new input type:

```typescript
export interface ApplyPlanToShoppingListInput {
  entryIds: string[];
}
```

The `ShoppingList` and `ShoppingListItem` interfaces after editing:

```typescript
export interface ShoppingListItem {
  id: string;
  shoppingListId: string;
  canonicalFoodId: string | null;
  name: string;
  qty: number;
  unit: string;
  source: ShoppingSource;
  checked: boolean;
  category: Category;
  sourceRecipeNames: string[] | null;
  sourceRecipeId: string | null;
}

export interface ShoppingList {
  id: string;
  householdId: string;
  createdAt: string;
  finalizedAt: string | null;
  items: ShoppingListItem[];
}
```

- [ ] **Step 3: Verify shared package builds**

Run: `pnpm --filter @eat/shared build`

Expected: success. The package only has type definitions, so the build only validates TypeScript.

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/index.ts
git commit -m "feat(shared): update meal-plan and shopping-list types for plan refactor"
```

---

## Task 3: Date-window helpers

**Files:**
- Modify: `apps/web/src/lib/dateUtils.ts`
- Create: `apps/web/src/lib/dateUtils.test.ts`

- [ ] **Step 1: Write failing tests for the new helpers**

Create `apps/web/src/lib/dateUtils.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { planWindow, planWindowDays, TODAY_INDEX, WINDOW_SIZE } from './dateUtils';

describe('plan window', () => {
  it('TODAY_INDEX is 2 (third visible column)', () => {
    expect(TODAY_INDEX).toBe(2);
  });

  it('WINDOW_SIZE is 17 (today minus 2 through today plus 14)', () => {
    expect(WINDOW_SIZE).toBe(17);
  });

  it('planWindow returns from/to ISO dates centred on today', () => {
    const today = new Date('2026-05-16T10:00:00');
    const { from, to } = planWindow(today);
    expect(from).toBe('2026-05-14');
    expect(to).toBe('2026-05-30');
  });

  it('planWindowDays returns 17 day objects with today at index 2', () => {
    const today = new Date('2026-05-16T10:00:00');
    const days = planWindowDays(today);
    expect(days).toHaveLength(17);
    expect(days[0].iso).toBe('2026-05-14');
    expect(days[2].iso).toBe('2026-05-16');
    expect(days[2].isToday).toBe(true);
    expect(days[16].iso).toBe('2026-05-30');
    expect(days[0].isToday).toBe(false);
  });

  it('planWindowDays labels use short weekday + day of month', () => {
    const today = new Date('2026-05-16T10:00:00');
    const days = planWindowDays(today);
    expect(days[2].label).toMatch(/^Sat 16$/);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @eat/web test -- dateUtils.test`

Expected: FAIL — `planWindow`, `planWindowDays`, `TODAY_INDEX`, `WINDOW_SIZE` are not exported.

- [ ] **Step 3: Implement the helpers**

Append to `apps/web/src/lib/dateUtils.ts`:

```typescript
export const TODAY_INDEX = 2;
export const WINDOW_SIZE = 17;

export interface PlanWindowDay {
  date: Date;
  iso: string;
  label: string;
  isToday: boolean;
}

export function planWindow(now: Date = new Date()): { from: string; to: string } {
  const start = addDays(now, -TODAY_INDEX);
  const end = addDays(now, WINDOW_SIZE - TODAY_INDEX - 1);
  return { from: toIsoDate(start), to: toIsoDate(end) };
}

export function planWindowDays(now: Date = new Date()): PlanWindowDay[] {
  const todayIso = toIsoDate(now);
  const start = addDays(now, -TODAY_INDEX);
  const labels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return Array.from({ length: WINDOW_SIZE }, (_, i) => {
    const d = addDays(start, i);
    const iso = toIsoDate(d);
    return {
      date: d,
      iso,
      label: `${labels[d.getDay()]} ${d.getDate()}`,
      isToday: iso === todayIso,
    };
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @eat/web test -- dateUtils.test`

Expected: PASS — all 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/dateUtils.ts apps/web/src/lib/dateUtils.test.ts
git commit -m "feat(web): add rolling 17-day plan window helpers"
```

---

## Task 4: Server meal-plans route rewrite

**Files:**
- Modify: `apps/server/src/routes/meal-plans.ts`
- Modify: `apps/server/src/routes/meal-plans.test.ts`

- [ ] **Step 1: Rewrite the tests first (TDD red)**

Replace the contents of `apps/server/src/routes/meal-plans.test.ts` with:

```typescript
import { vi, describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  membershipLimit: vi.fn(),
}));

vi.mock('../auth.js', () => ({
  auth: { api: { getSession: mocks.getSession } },
}));

vi.mock('better-auth/node', () => ({
  fromNodeHeaders: (h: unknown) => h,
}));

vi.mock('drizzle-orm', () => ({
  and: (...args: unknown[]) => args,
  eq: () => null,
  gte: () => null,
  lte: () => null,
  asc: () => null,
  sql: Object.assign(() => null, { template: () => null }),
}));

vi.mock('uuid', () => ({ v4: () => 'fixed-uuid' }));

vi.mock('../db/index.js', () => {
  const membershipChain = {
    from: () => ({ where: () => ({ limit: mocks.membershipLimit }) }),
  };
  return {
    db: { select: () => membershipChain },
  };
});

vi.mock('../db/schema/index.js', () => ({
  memberships: { householdId: 'householdId', userId: 'userId' },
  mealPlanEntries: {},
  recipes: {},
}));

const { default: mealPlansRouter } = await import('./meal-plans');

describe('meal-plans router', () => {
  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use('/api/meal-plans', mealPlansRouter);
  });

  it('returns 401 for unauthenticated requests', async () => {
    mocks.getSession.mockResolvedValue(null);
    const res = await request(app).get('/api/meal-plans/entries?from=2026-05-14&to=2026-05-30');
    expect(res.status).toBe(401);
  });

  it('returns 400 when from/to are missing or malformed', async () => {
    mocks.getSession.mockResolvedValue({ user: { id: 'user-1' } });
    mocks.membershipLimit.mockResolvedValue([{ householdId: 'hh-1' }]);

    const noParams = await request(app).get('/api/meal-plans/entries');
    expect(noParams.status).toBe(400);

    const malformed = await request(app).get('/api/meal-plans/entries?from=2026-05-14&to=not-a-date');
    expect(malformed.status).toBe(400);
  });

  it('rejects POST entry with invalid date format', async () => {
    mocks.getSession.mockResolvedValue({ user: { id: 'user-1' } });
    mocks.membershipLimit.mockResolvedValue([{ householdId: 'hh-1' }]);

    const res = await request(app)
      .post('/api/meal-plans/entries')
      .send({
        date: 'not-a-date',
        recipeId: '00000000-0000-0000-0000-000000000001',
        servings: 2,
      });

    expect(res.status).toBe(400);
  });

  it('rejects POST entry with non-positive servings', async () => {
    mocks.getSession.mockResolvedValue({ user: { id: 'user-1' } });
    mocks.membershipLimit.mockResolvedValue([{ householdId: 'hh-1' }]);

    const res = await request(app)
      .post('/api/meal-plans/entries')
      .send({
        date: '2026-05-04',
        recipeId: '00000000-0000-0000-0000-000000000001',
        servings: 0,
      });

    expect(res.status).toBe(400);
  });

  it('rejects PUT entry with invalid status', async () => {
    mocks.getSession.mockResolvedValue({ user: { id: 'user-1' } });
    mocks.membershipLimit.mockResolvedValue([{ householdId: 'hh-1' }]);

    const res = await request(app)
      .put('/api/meal-plans/entries/some-id')
      .send({ status: 'gobbled' });

    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @eat/server test -- meal-plans.test`

Expected: FAIL — current `meal-plans.ts` still uses `mealPlans` (deleted in Task 1) and the old `weekStart` schema.

- [ ] **Step 3: Rewrite the route**

Replace the contents of `apps/server/src/routes/meal-plans.ts` with:

```typescript
import { Router, type Router as ExpressRouter } from 'express';
import { z } from 'zod';
import { and, eq, gte, lte, asc, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { withHousehold } from '../middleware/with-household.js';
import { db } from '../db/index.js';
import { mealPlanEntries, recipes } from '../db/schema/index.js';

const router: ExpressRouter = Router();

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'must be YYYY-MM-DD');

const createEntrySchema = z.object({
  date: isoDate,
  recipeId: z.string().uuid(),
  servings: z.number().positive().max(100),
});

const updateEntrySchema = z.object({
  date: isoDate.optional(),
  servings: z.number().positive().max(100).optional(),
  status: z.enum(['planned', 'cooked', 'skipped']).optional(),
});

const entryCols = {
  id: mealPlanEntries.id,
  date: mealPlanEntries.date,
  recipeId: mealPlanEntries.recipeId,
  recipeName: recipes.name,
  servings: mealPlanEntries.servings,
  status: mealPlanEntries.status,
};

const entryJoinOn = sql`${mealPlanEntries.recipeId} = ${recipes.id}`;

// GET /api/meal-plans/entries?from=YYYY-MM-DD&to=YYYY-MM-DD
router.get('/entries', withHousehold, async (req, res) => {
  const { from, to } = req.query as { from?: string; to?: string };
  const parse = z.object({ from: isoDate, to: isoDate }).safeParse({ from, to });
  if (!parse.success) {
    res.status(400).json({ error: 'from and to query params required (YYYY-MM-DD)' });
    return;
  }

  try {
    const entries = await db
      .select(entryCols)
      .from(mealPlanEntries)
      .innerJoin(recipes, entryJoinOn)
      .where(and(
        eq(mealPlanEntries.householdId, req.householdId),
        gte(mealPlanEntries.date, parse.data.from),
        lte(mealPlanEntries.date, parse.data.to),
      ))
      .orderBy(asc(mealPlanEntries.date));

    res.json({ entries });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/meal-plans/entries
router.post('/entries', withHousehold, async (req, res) => {
  const parse = createEntrySchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: 'Invalid input', details: parse.error.flatten() });
    return;
  }
  const { date, recipeId, servings } = parse.data;

  try {
    const [recipe] = await db
      .select({ householdId: recipes.householdId })
      .from(recipes)
      .where(eq(recipes.id, recipeId))
      .limit(1);

    if (!recipe || recipe.householdId !== req.householdId) {
      res.status(404).json({ error: 'Recipe not found' });
      return;
    }

    const entryId = uuidv4();
    await db.insert(mealPlanEntries).values({
      id: entryId,
      householdId: req.householdId,
      date,
      recipeId,
      servings,
    });

    const [full] = await db
      .select(entryCols)
      .from(mealPlanEntries)
      .innerJoin(recipes, entryJoinOn)
      .where(eq(mealPlanEntries.id, entryId));

    res.status(201).json(full);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/meal-plans/entries/:id
router.put('/entries/:id', withHousehold, async (req, res) => {
  const id = req.params['id'] as string;

  const parse = updateEntrySchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: 'Invalid input', details: parse.error.flatten() });
    return;
  }

  try {
    const [existing] = await db
      .select({ householdId: mealPlanEntries.householdId })
      .from(mealPlanEntries)
      .where(eq(mealPlanEntries.id, id))
      .limit(1);

    if (!existing) { res.status(404).json({ error: 'Entry not found' }); return; }
    if (existing.householdId !== req.householdId) { res.status(403).json({ error: 'Forbidden' }); return; }

    const d = parse.data;
    await db
      .update(mealPlanEntries)
      .set({
        ...(d.date !== undefined && { date: d.date }),
        ...(d.servings !== undefined && { servings: d.servings }),
        ...(d.status !== undefined && { status: d.status }),
      })
      .where(eq(mealPlanEntries.id, id));

    const [full] = await db
      .select(entryCols)
      .from(mealPlanEntries)
      .innerJoin(recipes, entryJoinOn)
      .where(eq(mealPlanEntries.id, id));

    res.json(full);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/meal-plans/entries/:id
router.delete('/entries/:id', withHousehold, async (req, res) => {
  const id = req.params['id'] as string;

  try {
    const [existing] = await db
      .select({ householdId: mealPlanEntries.householdId })
      .from(mealPlanEntries)
      .where(eq(mealPlanEntries.id, id))
      .limit(1);

    if (!existing) { res.status(404).json({ error: 'Entry not found' }); return; }
    if (existing.householdId !== req.householdId) { res.status(403).json({ error: 'Forbidden' }); return; }

    await db.delete(mealPlanEntries).where(eq(mealPlanEntries.id, id));
    res.json({ id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @eat/server test -- meal-plans.test`

Expected: PASS — all 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/routes/meal-plans.ts apps/server/src/routes/meal-plans.test.ts
git commit -m "feat(server): rewrite meal-plans route to date-range API"
```

---

## Task 5: Shopping-list from-plan endpoint

**Files:**
- Modify: `apps/server/src/routes/shopping-lists.ts`
- Modify: `apps/server/src/routes/shopping-lists.test.ts`

- [ ] **Step 1: Write a failing test for `from-plan`**

Read the current `shopping-lists.test.ts` first to see the test setup pattern, then append (or replace within) the existing `describe` block. The test should be added inside the existing setup. As a self-contained addition, add to the bottom of the existing describe block:

```typescript
  it('rejects from-plan POST with missing entryIds', async () => {
    mocks.getSession.mockResolvedValue({ user: { id: 'user-1' } });
    mocks.membershipLimit.mockResolvedValue([{ householdId: 'hh-1' }]);

    const res = await request(app)
      .post('/api/shopping-lists/from-plan')
      .send({});

    expect(res.status).toBe(400);
  });

  it('rejects from-plan POST with non-uuid entryIds', async () => {
    mocks.getSession.mockResolvedValue({ user: { id: 'user-1' } });
    mocks.membershipLimit.mockResolvedValue([{ householdId: 'hh-1' }]);

    const res = await request(app)
      .post('/api/shopping-lists/from-plan')
      .send({ entryIds: ['not-a-uuid'] });

    expect(res.status).toBe(400);
  });
```

Also: remove the existing `'/generate'` tests if any (search the file for `'generate'` strings and remove related test blocks). The `/generate` endpoint is being removed entirely.

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `pnpm --filter @eat/server test -- shopping-lists.test`

Expected: FAIL on the new tests — `/from-plan` does not exist yet.

- [ ] **Step 3: Remove the `/generate` endpoint and `mealPlans` import**

In `apps/server/src/routes/shopping-lists.ts`:

1. Remove `mealPlans` from the schema import (it no longer exists).
2. Remove the entire `router.post('/generate', ...)` handler block (roughly lines 82–227).
3. Remove the `generateSchema` const.
4. Remove `generatedFromMealPlanId` from the `listCols` definition (it no longer exists on the schema).
5. Remove `withCategory<T extends { category: string | null }>` — keep it; it's still used.

The updated imports at the top:

```typescript
import {
  mealPlanEntries, recipes, recipeIngredients,
  inventoryItems, canonicalFoods, staples,
  shoppingLists, shoppingListItems,
} from '../db/schema/index.js';
```

(Note: `scraperJobs` and `shoppingListPrices` may still be imported elsewhere in this file — keep them. Cross-check by running the build after.)

The updated `listCols`:

```typescript
const listCols = {
  id: shoppingLists.id,
  householdId: shoppingLists.householdId,
  createdAt: shoppingLists.createdAt,
  finalizedAt: shoppingLists.finalizedAt,
};
```

- [ ] **Step 4: Update `listItemCols` and `itemsForList` to include `sourceRecipeId`**

Add `sourceRecipeId` to the `listItemCols` select:

```typescript
const listItemCols = {
  id: shoppingListItems.id,
  shoppingListId: shoppingListItems.shoppingListId,
  canonicalFoodId: shoppingListItems.canonicalFoodId,
  name: shoppingListItems.name,
  qty: shoppingListItems.qty,
  unit: shoppingListItems.unit,
  source: shoppingListItems.source,
  checked: shoppingListItems.checked,
  category: canonicalFoods.category,
  sourceRecipeNames: shoppingListItems.sourceRecipeNames,
  sourceRecipeId: shoppingListItems.sourceRecipeId,
};
```

- [ ] **Step 5: Add the `POST /from-plan` endpoint**

Add after the imports/helpers and before `router.get('/current', ...)`:

```typescript
const fromPlanSchema = z.object({
  entryIds: z.array(z.string().uuid()),
});

// POST /api/shopping-lists/from-plan
// Replaces all recipe-sourced items on the current list with a fresh derivation from
// the given meal-plan entries. Manual and staple items are left untouched.
// Creates a new shopping list if none exists.
router.post('/from-plan', withHousehold, async (req, res) => {
  const parse = fromPlanSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: 'Invalid input', details: parse.error.flatten() });
    return;
  }
  const { entryIds } = parse.data;
  const hid = req.householdId;

  try {
    type RawIng = {
      canonicalFoodId: string; foodName: string;
      unit: string; qty: string;
      recipeServings: number; entryServings: number;
      densityGPerMl: number | null;
      countToGrams: number | null;
      recipeName: string;
      recipeId: string;
    };

    const rawIngredients: RawIng[] = entryIds.length > 0
      ? await db
          .select({
            canonicalFoodId: recipeIngredients.canonicalFoodId,
            foodName: canonicalFoods.name,
            unit: recipeIngredients.unit,
            qty: recipeIngredients.qty,
            recipeServings: recipes.servings,
            entryServings: mealPlanEntries.servings,
            densityGPerMl: canonicalFoods.densityGPerMl,
            countToGrams: canonicalFoods.countToGrams,
            recipeName: recipes.name,
            recipeId: recipes.id,
          })
          .from(mealPlanEntries)
          .innerJoin(recipes, eq(mealPlanEntries.recipeId, recipes.id))
          .innerJoin(recipeIngredients, eq(recipeIngredients.recipeId, recipes.id))
          .innerJoin(canonicalFoods, eq(recipeIngredients.canonicalFoodId, canonicalFoods.id))
          .where(and(
            eq(mealPlanEntries.householdId, hid),
            inArray(mealPlanEntries.id, entryIds),
            eq(recipeIngredients.optional, false),
          ))
      : [];

    type FoodInfo = {
      foodName: string; unit: string; qty: number;
      densityGPerMl: number | null; countToGrams: number | null;
      recipeNames: Set<string>; recipeIds: Set<string>;
    };
    const needed = new Map<string, FoodInfo>();
    for (const row of rawIngredients) {
      const amount = normalizeRecipeAmount(row.qty, row.unit);
      if (!amount) continue;
      const ratio = row.recipeServings > 0 ? row.entryServings / row.recipeServings : 1;
      const key = `${row.canonicalFoodId}::${amount.unit}`;
      const cur = needed.get(key);
      if (cur) {
        cur.qty += amount.qty * ratio;
        cur.recipeNames.add(row.recipeName);
        cur.recipeIds.add(row.recipeId);
      } else {
        needed.set(key, {
          foodName: row.foodName,
          unit: amount.unit,
          qty: amount.qty * ratio,
          densityGPerMl: row.densityGPerMl,
          countToGrams: row.countToGrams,
          recipeNames: new Set([row.recipeName]),
          recipeIds: new Set([row.recipeId]),
        });
      }
    }

    const invRows = await db
      .select({
        canonicalFoodId: inventoryItems.canonicalFoodId,
        unit: inventoryItems.unit,
        total: sql<number>`sum(${inventoryItems.qty})`,
      })
      .from(inventoryItems)
      .where(eq(inventoryItems.householdId, hid))
      .groupBy(inventoryItems.canonicalFoodId, inventoryItems.unit);

    const invByFood = new Map<string, { unit: string; qty: number }[]>();
    for (const r of invRows) {
      const rows = invByFood.get(r.canonicalFoodId) ?? [];
      rows.push({ unit: r.unit, qty: Number(r.total) });
      invByFood.set(r.canonicalFoodId, rows);
    }

    type ItemInsert = {
      canonicalFoodId: string; name: string; qty: number; unit: string;
      source: 'recipe'; checked: boolean;
      sourceRecipeNames: string[];
      sourceRecipeId: string;
    };
    const recipeItemsToInsert: ItemInsert[] = [];

    for (const [key, info] of needed) {
      const [foodId] = key.split('::');
      let available = 0;
      for (const inv of invByFood.get(foodId) ?? []) {
        available += amountInUnit(inv, info.unit, info) ?? 0;
      }
      const gap = info.qty - available;

      if (gap > 0.001) {
        // If the same food is contributed by multiple recipes, pick any one for source_recipe_id —
        // it's only used for pre-tick matching, not subtraction. Pre-tick logic in the modal
        // checks "all entries for a day have their recipe id present in the list" so as long as
        // one of the contributing recipes is on the list, the day will pre-tick when appropriate.
        const firstRecipeId = info.recipeIds.values().next().value as string;
        recipeItemsToInsert.push({
          canonicalFoodId: foodId,
          name: info.foodName,
          qty: gap,
          unit: info.unit,
          source: 'recipe',
          checked: false,
          sourceRecipeNames: [...info.recipeNames],
          sourceRecipeId: firstRecipeId,
        });
      }
    }

    // Find or create current list, then replace recipe-sourced items.
    const listId = await db.transaction(async tx => {
      const [existing] = await tx
        .select({ id: shoppingLists.id })
        .from(shoppingLists)
        .where(eq(shoppingLists.householdId, hid))
        .orderBy(desc(shoppingLists.createdAt))
        .limit(1);

      let id = existing?.id;
      if (!id) {
        id = uuidv4();
        await tx.insert(shoppingLists).values({ id, householdId: hid });
      }

      // Delete only recipe-sourced items
      await tx.delete(shoppingListItems).where(and(
        eq(shoppingListItems.shoppingListId, id),
        eq(shoppingListItems.source, 'recipe'),
      ));

      // Insert new recipe-sourced items
      if (recipeItemsToInsert.length > 0) {
        await tx.insert(shoppingListItems).values(
          recipeItemsToInsert.map(item => ({ id: uuidv4(), shoppingListId: id!, householdId: hid, ...item })),
        );
      }

      return id;
    });

    const [list] = await db.select(listCols).from(shoppingLists).where(eq(shoppingLists.id, listId));
    const items = await itemsForList(listId);
    res.status(200).json({ ...list, items });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

Make sure these imports are present at the top of the file:
- `inArray` from `drizzle-orm` (already imported)
- `desc` from `drizzle-orm` (already imported)
- `normalizeRecipeAmount` from `'../lib/recipe-quantities.js'` (already imported)
- `amountInUnit` from `'../lib/food-amounts.js'` (already imported)

The `/staples/below-threshold` logic from the old `/generate` is NOT included in `from-plan`. Staples are managed independently (existing list keeps staple items untouched; new lists won't auto-add staples). If staple auto-add is still wanted on new lists, it should be a separate user action — confirm with the user in the user-review pass; for now it's omitted per the spec.

- [ ] **Step 6: Run tests to verify they pass**

Run: `pnpm --filter @eat/server test -- shopping-lists.test`

Expected: PASS — all tests pass including the new `from-plan` validation tests.

- [ ] **Step 7: Run the server build to catch compile errors**

Run: `pnpm --filter @eat/server build`

Expected: success. If errors mention an unused `mealPlans` import in some other file (e.g. `db/schema/index.ts` re-exports), drop them. If `scraperJobs` or `shoppingListPrices` imports are now unused in `shopping-lists.ts`, remove them.

- [ ] **Step 8: Commit**

```bash
git add apps/server/src/routes/shopping-lists.ts apps/server/src/routes/shopping-lists.test.ts
git commit -m "feat(server): replace shopping-list generate with from-plan endpoint"
```

---

## Task 6: useMealPlan hook rewrite

**Files:**
- Modify: `apps/web/src/hooks/useMealPlan.ts`
- Modify: `apps/web/src/hooks/useMealPlan.test.tsx`

- [ ] **Step 1: Replace the test file**

Replace the contents of `apps/web/src/hooks/useMealPlan.test.tsx` with:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useAddMealPlanEntry, useAddToNextEmptyDays } from './useMealPlan';
import { api } from '../api/client';

vi.mock('../api/client', () => ({
  api: {
    post: vi.fn(),
    get: vi.fn(),
    del: vi.fn(),
  },
}));

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe('useAddMealPlanEntry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does NOT auto-regenerate the shopping list when a recipe is added', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({
      id: 'entry-1',
      date: '2026-05-14',
      recipeId: '00000000-0000-0000-0000-000000000001',
      recipeName: 'Pasta',
      servings: 2,
      status: 'planned',
    });

    const { result } = renderHook(() => useAddMealPlanEntry(), { wrapper });

    result.current.mutate({
      date: '2026-05-14',
      recipeId: '00000000-0000-0000-0000-000000000001',
      servings: 2,
    });

    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
    expect(api.post).toHaveBeenCalledWith('/api/meal-plans/entries', {
      date: '2026-05-14',
      recipeId: '00000000-0000-0000-0000-000000000001',
      servings: 2,
    });
    expect(api.post).not.toHaveBeenCalledWith('/api/shopping-lists/generate', expect.anything());
    expect(api.post).not.toHaveBeenCalledWith('/api/shopping-lists/from-plan', expect.anything());
  });
});

describe('useAddToNextEmptyDays', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-11T10:00:00'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('places recipes into the next N empty days starting from today, without touching shopping list', async () => {
    // Single date-range query covers the 28-day candidate window.
    vi.mocked(api.get).mockResolvedValueOnce({
      entries: [
        { id: 'e1', date: '2026-05-11', recipeId: 'rx', recipeName: 'X', servings: 2, status: 'planned' },
        { id: 'e2', date: '2026-05-12', recipeId: 'ry', recipeName: 'Y', servings: 2, status: 'planned' },
        { id: 'e3', date: '2026-05-18', recipeId: 'rz', recipeName: 'Z', servings: 2, status: 'planned' },
      ],
    });

    vi.mocked(api.post).mockResolvedValue({});

    const { result } = renderHook(() => useAddToNextEmptyDays(), { wrapper });

    const out = await result.current.mutateAsync([
      { recipeId: 'recipe-1', servings: 2 },
      { recipeId: 'recipe-2', servings: 4 },
    ]);

    expect(api.get).toHaveBeenCalledTimes(1);

    // First two empty days from today: May 13 and May 14.
    expect(api.post).toHaveBeenCalledWith('/api/meal-plans/entries', {
      date: '2026-05-13',
      recipeId: 'recipe-1',
      servings: 2,
    });
    expect(api.post).toHaveBeenCalledWith('/api/meal-plans/entries', {
      date: '2026-05-14',
      recipeId: 'recipe-2',
      servings: 4,
    });

    expect(api.post).not.toHaveBeenCalledWith('/api/shopping-lists/generate', expect.anything());
    expect(api.post).not.toHaveBeenCalledWith('/api/shopping-lists/from-plan', expect.anything());

    expect(out.skipped).toHaveLength(0);
    expect(out.addedTo).toHaveLength(2);
  });

  it('returns skipped recipes when fewer empty days than items', async () => {
    const pad = (n: number) => String(n).padStart(2, '0');
    const entries = Array.from({ length: 28 }, (_, i) => {
      const d = new Date(2026, 4, 11 + i);
      const iso = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      return { id: iso, date: iso, recipeId: 'r0', recipeName: 'Q', servings: 2, status: 'planned' as const };
    });
    vi.mocked(api.get).mockResolvedValueOnce({ entries });

    vi.mocked(api.post).mockResolvedValue({});

    const { result } = renderHook(() => useAddToNextEmptyDays(), { wrapper });

    const out = await result.current.mutateAsync([
      { recipeId: 'recipe-1', servings: 2 },
      { recipeId: 'recipe-2', servings: 4 },
    ]);

    expect(api.post).not.toHaveBeenCalledWith('/api/meal-plans/entries', expect.anything());
    expect(out.addedTo).toHaveLength(0);
    expect(out.skipped).toEqual(['recipe-1', 'recipe-2']);
  });
});
```

- [ ] **Step 2: Run the test (should fail)**

Run: `pnpm --filter @eat/web test -- useMealPlan.test`

Expected: FAIL — the hook still calls `/api/shopping-lists/generate`.

- [ ] **Step 3: Rewrite the hook**

Replace the contents of `apps/web/src/hooks/useMealPlan.ts` with:

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { addDays, toIsoDate } from '../lib/dateUtils';
import type {
  MealPlanEntry,
  MealPlanEntriesResponse,
  CreateMealPlanEntryInput,
  UpdateMealPlanEntryInput,
} from '@eat/shared';

export function useMealPlanEntries(from: string, to: string) {
  return useQuery<MealPlanEntriesResponse>({
    queryKey: ['meal-plan-entries', from, to],
    queryFn: () => api.get<MealPlanEntriesResponse>(`/api/meal-plans/entries?from=${from}&to=${to}`),
    enabled: !!from && !!to,
  });
}

export function useAddMealPlanEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateMealPlanEntryInput) =>
      api.post<MealPlanEntry>('/api/meal-plans/entries', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['meal-plan-entries'] });
    },
  });
}

export function useUpdateMealPlanEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: UpdateMealPlanEntryInput & { id: string }) =>
      api.put<MealPlanEntry>(`/api/meal-plans/entries/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['meal-plan-entries'] }),
  });
}

export function useDeleteMealPlanEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del<{ id: string }>(`/api/meal-plans/entries/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['meal-plan-entries'] }),
  });
}

export function useAddToNextEmptyDays() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (items: { recipeId: string; servings: number }[]) => {
      if (items.length === 0) return { addedTo: [] as string[], skipped: [] as string[] };

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const candidates = Array.from({ length: 28 }, (_, i) => addDays(today, i));
      const from = toIsoDate(today);
      const to = toIsoDate(addDays(today, 27));

      const { entries } = await api.get<MealPlanEntriesResponse>(`/api/meal-plans/entries?from=${from}&to=${to}`);
      const occupiedDates = new Set<string>(entries.map(e => e.date));

      const emptyDays: string[] = [];
      for (const d of candidates) {
        if (emptyDays.length >= items.length) break;
        const iso = toIsoDate(d);
        if (!occupiedDates.has(iso)) emptyDays.push(iso);
      }

      const toPlace = items.slice(0, emptyDays.length);
      const skipped = items.slice(emptyDays.length);

      await Promise.all(
        toPlace.map((item, i) =>
          api.post('/api/meal-plans/entries', {
            date: emptyDays[i],
            recipeId: item.recipeId,
            servings: item.servings,
          }),
        ),
      );

      await qc.invalidateQueries({ queryKey: ['meal-plan-entries'] });

      const addedTo = emptyDays.map(d => {
        const dt = new Date(d + 'T00:00:00');
        return dt.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
      });

      return { addedTo, skipped: skipped.map(i => i.recipeId) };
    },
  });
}
```

Note: removed `useMealPlanWeek`, removed `mondayOf` import (no longer needed), removed all auto-`/api/shopping-lists/generate` calls. `useUpdateMealPlanEntry` and `useDeleteMealPlanEntry` no longer take `weekStart` since they invalidate by hook key, not specific week.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @eat/web test -- useMealPlan.test`

Expected: PASS — all 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/hooks/useMealPlan.ts apps/web/src/hooks/useMealPlan.test.tsx
git commit -m "feat(web): rewrite useMealPlan for date-range API, drop auto-generate"
```

---

## Task 7: useShoppingList hook updates

**Files:**
- Modify: `apps/web/src/hooks/useShoppingList.ts`

- [ ] **Step 1: Replace `useGenerateShoppingList` with `useApplyPlanToShoppingList`**

In `apps/web/src/hooks/useShoppingList.ts`:

1. Remove `GenerateShoppingListInput` from the type imports.
2. Add `ApplyPlanToShoppingListInput` to the type imports.
3. Replace the `useGenerateShoppingList` function with:

```typescript
export function useApplyPlanToShoppingList() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: ApplyPlanToShoppingListInput) =>
      api.post<ShoppingList>('/api/shopping-lists/from-plan', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shopping-list'] }),
  });
}
```

The full updated file:

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import type {
  ShoppingList, ShoppingListItem,
  ApplyPlanToShoppingListInput, AddShoppingListItemInput, UpdateShoppingListItemInput,
  PurchaseShoppingListItemsInput, BatchDeleteShoppingListItemsInput,
} from '@eat/shared';

interface ApiError extends Error { status: number; }

export function useCurrentShoppingList() {
  return useQuery<ShoppingList | null>({
    queryKey: ['shopping-list', 'current'],
    queryFn: async () => {
      try {
        return await api.get<ShoppingList>('/api/shopping-lists/current');
      } catch (err: unknown) {
        if ((err as ApiError).status === 404) return null;
        throw err;
      }
    },
  });
}

export function useApplyPlanToShoppingList() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: ApplyPlanToShoppingListInput) =>
      api.post<ShoppingList>('/api/shopping-lists/from-plan', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shopping-list'] }),
  });
}

export function useUpdateShoppingListItem(listId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, ...data }: UpdateShoppingListItemInput & { itemId: string }) =>
      api.put<ShoppingListItem>(`/api/shopping-lists/${listId}/items/${itemId}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shopping-list', 'current'] }),
  });
}

export function useAddShoppingListItem(listId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: AddShoppingListItemInput) =>
      api.post<ShoppingListItem>(`/api/shopping-lists/${listId}/items`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shopping-list', 'current'] }),
  });
}

export function useDeleteShoppingListItem(listId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (itemId: string) =>
      api.del<{ id: string }>(`/api/shopping-lists/${listId}/items/${itemId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shopping-list', 'current'] }),
  });
}

export function usePurchaseShoppingListItems(listId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: PurchaseShoppingListItemsInput) =>
      api.post<ShoppingList>(`/api/shopping-lists/${listId}/items/purchase`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shopping-list'] });
      qc.invalidateQueries({ queryKey: ['inventory'] });
    },
  });
}

export function useBatchDeleteShoppingListItems(listId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: BatchDeleteShoppingListItemsInput) =>
      api.post<ShoppingList>(`/api/shopping-lists/${listId}/items/batch-delete`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shopping-list'] }),
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/hooks/useShoppingList.ts
git commit -m "feat(web): replace useGenerateShoppingList with useApplyPlanToShoppingList"
```

---

## Task 8: Update remaining call sites

**Files:**
- Modify: `apps/web/src/pages/HomePage/useHomeData.ts`
- Modify: `apps/web/src/pages/RecipesPage/RecipesPage.tsx`
- Modify: `apps/web/src/pages/PlanPage/CookModal.tsx`
- Modify: `apps/web/src/dev/mockApi.ts`

- [ ] **Step 1: Update HomePage `useHomeData`**

In `apps/web/src/pages/HomePage/useHomeData.ts`:

1. Replace import: `useMealPlanWeek` → `useMealPlanEntries`.
2. Remove `mondayOf`, `toIsoDate` import unless still used elsewhere (check). Add `planWindow` if needed.
3. Replace `weekStart` calculation and `useMealPlanWeek(weekStart)` with `useMealPlanEntries(from, to)`.

Updated section:

```typescript
import { useMealPlanEntries } from '../../hooks/useMealPlan';
import { planWindow } from '../../lib/dateUtils';
// ... rest of imports

export function useHomeData(now: Date = new Date()): HomeData {
  const { from, to } = useMemo(() => planWindow(now), [now]);

  const inventoryQ = useInventory();
  const mealPlanQ  = useMealPlanEntries(from, to);
  // ... rest unchanged
```

`entries` extraction stays the same (still `mealPlanQ.data?.entries ?? []`).

- [ ] **Step 2: Update RecipesPage**

In `apps/web/src/pages/RecipesPage/RecipesPage.tsx`, the import `import { useAddToNextEmptyDays } from '../../hooks/useMealPlan';` still works (function name unchanged). The signature is the same. No code change needed unless the page directly references `useMealPlanWeek` (check via grep).

Run: `grep -n "useMealPlanWeek\|weekStart" apps/web/src/pages/RecipesPage/RecipesPage.tsx`

Expected: no matches. If matches found, refactor those lines.

- [ ] **Step 3: Update CookModal**

In `apps/web/src/pages/PlanPage/CookModal.tsx`, the `useDeleteMealPlanEntry` and `useUpdateMealPlanEntry` signatures changed (no `weekStart` arg).

Run: `grep -n "useUpdateMealPlanEntry\|useDeleteMealPlanEntry\|weekStart" apps/web/src/pages/PlanPage/CookModal.tsx`

For each call site, drop the `weekStart` argument. E.g. `useUpdateMealPlanEntry(weekStart)` → `useUpdateMealPlanEntry()`. If `weekStart` is a prop on the component, remove it from the component's props and from the call site in `PlanPage.tsx` (that page is being rewritten next anyway).

- [ ] **Step 4: Update `dev/mockApi.ts`**

In `apps/web/src/dev/mockApi.ts`:

1. Replace `MealPlanWeek` type import with `MealPlanEntriesResponse`.
2. Update the mock function `mealPlan(weekStart: string): MealPlanWeek` to `mealPlanEntries(): MealPlanEntriesResponse` returning `{ entries: [...] }`.
3. Update the route matcher: `path.startsWith('/api/meal-plans')` should now match `/api/meal-plans/entries`.
4. Drop references to `mealPlanId` on entries (no longer in `MealPlanEntry`).
5. Drop `weekStart` from the mock response shape.

Read the existing file (`apps/web/src/dev/mockApi.ts`) carefully and update the meal-plan mock block in place. The mock should answer:
- `GET /api/meal-plans/entries?from=&to=` → `{ entries: MealPlanEntry[] }`

- [ ] **Step 5: Run web build + tests**

Run: `pnpm --filter @eat/web test`

Expected: most tests pass. If `mockApi.test.ts` fails on the shape change, update the test fixtures inline. Don't move on until green.

Run: `pnpm --filter @eat/web build`

Expected: success. If there are TypeScript errors in any other file referencing `MealPlanWeek` / `mealPlanId` / `generatedFromMealPlanId`, fix inline.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/pages/HomePage/useHomeData.ts apps/web/src/pages/RecipesPage/RecipesPage.tsx apps/web/src/pages/PlanPage/CookModal.tsx apps/web/src/dev/mockApi.ts
git commit -m "feat(web): migrate remaining call sites to new meal-plan API"
```

---

## Task 9: PlanPage rewrite

**Files:**
- Modify: `apps/web/src/pages/PlanPage/PlanPage.tsx`
- Modify: `apps/web/src/pages/PlanPage/PlanPage.css`

- [ ] **Step 1: Rewrite `PlanPage.tsx`**

Replace the contents of `apps/web/src/pages/PlanPage/PlanPage.tsx` with:

```typescript
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useRecipes } from '../../hooks/useRecipes';
import { useInventory } from '../../hooks/useInventory';
import {
  useMealPlanEntries,
  useAddMealPlanEntry,
  useUpdateMealPlanEntry,
  useDeleteMealPlanEntry,
} from '../../hooks/useMealPlan';
import { CookModal } from './CookModal';
import { PageTitle } from '../../components/PageTitle';
import { StatusChip } from '../../components/StatusChip';
import type { MealPlanEntry, Recipe } from '@eat/shared';
import { planWindow, planWindowDays, TODAY_INDEX } from '../../lib/dateUtils';
import { useNavigate } from 'react-router-dom';
import './PlanPage.css';

const DRAG_TYPE = 'application/x-eat-recipe-id';
const MAX_ENTRIES_PER_DAY = 4;

type DayKind = 'cook' | 'shop' | 'leftover' | 'open';

interface DayEntry {
  entry: MealPlanEntry;
  recipe: Recipe | undefined;
  missing: string[];
  kind: DayKind;
}

function DayCard({
  iso,
  label,
  isToday,
  entries,
  onDropRecipe,
  onUpdateEntry,
  onDeleteEntry,
  onMarkCookedEntry,
}: {
  iso: string;
  label: string;
  isToday: boolean;
  entries: DayEntry[];
  onDropRecipe: (recipeId: string) => void;
  onUpdateEntry: (id: string, patch: { servings?: number; status?: MealPlanEntry['status'] }) => void;
  onDeleteEntry: (id: string) => void;
  onMarkCookedEntry: (id: string) => void;
}) {
  const [dragOver, setDragOver] = useState(false);
  const atCapacity = entries.length >= MAX_ENTRIES_PER_DAY;

  const first = entries[0];
  const followUps = entries.slice(1);
  const kind: DayKind = first?.kind ?? 'open';

  function onDragOver(e: React.DragEvent) {
    if (atCapacity) return;
    if (e.dataTransfer.types.includes(DRAG_TYPE)) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      setDragOver(true);
    }
  }
  function onDrop(e: React.DragEvent) {
    if (atCapacity) return;
    e.preventDefault();
    setDragOver(false);
    const recipeId = e.dataTransfer.getData(DRAG_TYPE);
    if (recipeId) onDropRecipe(recipeId);
  }

  return (
    <div
      className={`day-col${dragOver ? ' drag-over' : ''}${isToday ? ' today' : ''}`}
      data-iso={iso}
      onDragOver={onDragOver}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
    >
      <div className="day-col-header">
        <span className="day-col-label">{label}</span>
        {isToday && <span className="day-col-context">today</span>}
      </div>

      {first ? (
        <>
          <div className="day-col-image">
            {first.recipe?.sourceImage
              ? <img src={first.recipe.sourceImage} alt="" />
              : <span className="day-col-image-fallback">{first.entry.recipeName}</span>}
          </div>
          <div className="day-col-name">{first.entry.recipeName}</div>
          <div className="day-col-meta">serves {first.entry.servings}</div>
          <StatusChip kind={kind === 'open' ? 'open' : kind} />
          {followUps.map((fu) => (
            <div key={fu.entry.id} className="day-col-extra">
              <span className="day-col-extra-name">{fu.entry.recipeName}</span>
              <span style={{ fontSize: 11, color: 'var(--mute)' }}>serves {fu.entry.servings}</span>
              <div className="day-col-extra-actions">
                {fu.entry.status === 'planned' && (
                  <button className="day-col-extra-btn" onClick={() => onMarkCookedEntry(fu.entry.id)} title="Mark cooked">✓</button>
                )}
                <button className="day-col-extra-btn" onClick={() => onDeleteEntry(fu.entry.id)} aria-label="Remove">✕</button>
              </div>
            </div>
          ))}
          <div style={{ marginTop: 6, display: 'flex', gap: 4 }}>
            {first.entry.status === 'planned' && (
              <button className="day-col-extra-btn" onClick={() => onMarkCookedEntry(first.entry.id)} title="Mark cooked">cooked ✓</button>
            )}
            <button className="day-col-extra-btn" onClick={() => onDeleteEntry(first.entry.id)} aria-label="Remove">remove ✕</button>
            <input
              className="day-col-extra-btn"
              type="number"
              min="0"
              step="any"
              defaultValue={first.entry.servings}
              onBlur={(e) => {
                const n = parseFloat(e.currentTarget.value);
                if (!isNaN(n) && n > 0 && n !== first.entry.servings) {
                  onUpdateEntry(first.entry.id, { servings: n });
                }
              }}
              style={{ width: 50, textAlign: 'right' }}
              title="Edit servings"
            />
          </div>
          {atCapacity && (
            <div className="day-col-cap">max 4 recipes</div>
          )}
        </>
      ) : (
        <div className="day-col-empty">
          <div className="day-col-empty-title">open seat</div>
          <div className="day-col-empty-hint">drop a recipe</div>
        </div>
      )}
    </div>
  );
}

export function PlanPage() {
  const navigate = useNavigate();
  const now = useMemo(() => new Date(), []);
  const { from, to } = useMemo(() => planWindow(now), [now]);
  const days = useMemo(() => planWindowDays(now), [now]);

  const { data: entriesResp, isLoading: planLoading } = useMealPlanEntries(from, to);
  const { data: recipes = [] } = useRecipes();
  const { data: inventory = [] } = useInventory({});
  void inventory; // reserved for richer per-day cook/shop bucketing once recipe ingredients are fetched per-entry

  const addEntry = useAddMealPlanEntry();
  const updateEntry = useUpdateMealPlanEntry();
  const deleteEntry = useDeleteMealPlanEntry();

  const [cookingEntryId, setCookingEntryId] = useState<string | null>(null);
  const cookingEntry = cookingEntryId
    ? (entriesResp?.entries ?? []).find((e) => e.id === cookingEntryId) ?? null
    : null;

  const entriesByDay = useMemo(() => {
    const map: Record<string, DayEntry[]> = {};
    for (const e of entriesResp?.entries ?? []) {
      (map[e.date] ??= []).push({
        entry: e,
        recipe: undefined,
        missing: [],
        kind: 'cook',
      });
    }
    return map;
  }, [entriesResp]);

  const totals = useMemo(() => {
    const pantryDays = Object.values(entriesByDay).filter((es) => es.some((d) => d.kind === 'cook')).length;
    const shopDays   = Object.values(entriesByDay).filter((es) => es.some((d) => d.kind === 'shop')).length;
    const leftoverDays = Object.values(entriesByDay).filter((es) => es.some((d) => d.kind === 'leftover')).length;
    const openDays   = days.filter((d) => !(entriesByDay[d.iso]?.length)).length;
    return { pantryDays, shopDays, leftoverDays, openDays };
  }, [entriesByDay, days]);

  function handleDrop(date: string, recipeId: string) {
    const recipe = recipes.find((r) => r.id === recipeId);
    addEntry.mutate({
      date,
      recipeId,
      servings: recipe?.servings ?? 1,
    });
  }

  // Scroll today into position 3 on mount.
  const weekRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!weekRef.current || planLoading) return;
    const cols = weekRef.current.querySelectorAll<HTMLDivElement>('.day-col');
    const todayCol = cols[TODAY_INDEX];
    if (todayCol) {
      // Position today as the 3rd visible column from the left.
      const parentLeft = weekRef.current.getBoundingClientRect().left;
      const todayLeft = todayCol.getBoundingClientRect().left;
      weekRef.current.scrollLeft += todayLeft - parentLeft;
    }
  }, [planLoading]);

  return (
    <div className="plan-page">
      <PageTitle
        eyebrow="THE PLAN"
        title="Coming up"
        summary={
          <>
            <strong>{totals.pantryDays} from the pantry</strong>
            {' · '}
            <span style={{ color: 'var(--persim-deep)', fontWeight: 600 }}>{totals.shopDays} need a shop</span>
            {' · '}
            <span style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 16 }}>
              {totals.openDays} open seat{totals.openDays === 1 ? '' : 's'}
            </span>
          </>
        }
      />

      <div className="plan-prop-strip">
        <div className="plan-prop-bar" aria-hidden>
          <div className="plan-prop-bar-seg plan-prop-bar-seg--cook"     style={{ flex: totals.pantryDays   }} />
          <div className="plan-prop-bar-seg plan-prop-bar-seg--leftover" style={{ flex: totals.leftoverDays }} />
          <div className="plan-prop-bar-seg plan-prop-bar-seg--shop"     style={{ flex: totals.shopDays     }} />
          <div className="plan-prop-bar-seg"                              style={{ flex: totals.openDays     }} />
        </div>
        <div className="plan-prop-legend">
          {[
            ['cook now',    totals.pantryDays,   'var(--fresh)'],
            ['leftover',    totals.leftoverDays, 'var(--ink)'],
            ['needs shop',  totals.shopDays,     'var(--persimmon)'],
            ['open',        totals.openDays,     'var(--mute)'],
          ].map(([label, n, color]) => (
            <div key={label as string} className="plan-prop-legend-item">
              <span className="plan-prop-legend-dot" style={{ background: color as string }} />
              <span>{label as string}</span>
              <span className="plan-prop-legend-count">{n as number}</span>
            </div>
          ))}
        </div>
        {totals.shopDays > 0 && (
          <div className="plan-prop-shop">
            <div className="plan-prop-shop-label">your shopping list</div>
            <div>
              <a className="plan-prop-shop-cta" href="#" onClick={(e) => { e.preventDefault(); navigate('/list'); }}>
                view list →
              </a>
            </div>
          </div>
        )}
      </div>

      <div className="plan-body">
        <aside className="plan-sidebar">
          <div className="plan-sidebar-header">Recipes<span className="dot">.</span></div>
          <div className="plan-pick-hint subtle">drag onto a day</div>
          <ul className="plan-recipe-list">
            {recipes.map((r) => (
              <li
                key={r.id}
                className="plan-recipe-item"
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData(DRAG_TYPE, r.id);
                  e.dataTransfer.effectAllowed = 'copy';
                }}
              >
                <span className="plan-recipe-name">{r.name}</span>
                <span className="plan-recipe-meta">{r.servings} serv</span>
              </li>
            ))}
          </ul>
        </aside>

        <div>
          {planLoading && <p className="plan-status">Loading…</p>}
          <div className="plan-week-scroll" ref={weekRef}>
            <div className="plan-week-rail">
              {!planLoading && days.map((d) => (
                <DayCard
                  key={d.iso}
                  iso={d.iso}
                  label={d.label}
                  isToday={d.isToday}
                  entries={entriesByDay[d.iso] ?? []}
                  onDropRecipe={(recipeId) => handleDrop(d.iso, recipeId)}
                  onUpdateEntry={(id, patch) => updateEntry.mutate({ id, ...patch })}
                  onDeleteEntry={(id) => deleteEntry.mutate(id)}
                  onMarkCookedEntry={(id) => setCookingEntryId(id)}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {cookingEntry && (
        <CookModal
          mealPlanEntryId={cookingEntry.id}
          recipeName={cookingEntry.recipeName}
          onClose={() => setCookingEntryId(null)}
        />
      )}
    </div>
  );
}
```

Note: `CookModal` no longer takes `weekStart`. If `CookModal.tsx` still has that prop, remove it (and any `weekStart` usage in its body, which was probably for query invalidation — replace with `qc.invalidateQueries({ queryKey: ['meal-plan-entries'] })`).

- [ ] **Step 2: Update PlanPage.css for horizontal scroll**

In `apps/web/src/pages/PlanPage/PlanPage.css`:

1. Replace the `.plan-week` block (currently a 7-column grid) with horizontal scroll containers.
2. Remove the `.plan-fill` block and all `.plan-fill-*` rules (FillStrip is gone).
3. Add a `.day-col-cap` rule for the capacity hint.
4. Update the media queries (no more grid stacking; scroll handles narrow viewports).

Replace lines 103–109 (`.plan-week { ... }`) with:

```css
/* Horizontal scrolling 17-day rail */
.plan-week-scroll {
  overflow-x: auto;
  scroll-snap-type: x proximity;
  -webkit-overflow-scrolling: touch;
  padding-bottom: 8px;
}
.plan-week-rail {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: minmax(220px, 1fr);
  gap: 12px;
}
.plan-week-rail .day-col { scroll-snap-align: start; }
```

Replace lines 237–299 (the `.plan-fill*` rules) with nothing — they're deleted.

Add to the end of the file (before the media query):

```css
.day-col-cap {
  font-size: 11px;
  color: var(--mute);
  font-style: italic;
  margin-top: 6px;
}
```

Replace the media query block (lines 301–307):

```css
@media (max-width: 1024px) {
  .plan-body { grid-template-columns: 1fr; }
  .plan-week-rail { grid-auto-columns: minmax(180px, 240px); }
}
@media (max-width: 640px) {
  .plan-week-rail { grid-auto-columns: minmax(160px, 200px); }
}
```

- [ ] **Step 3: Run web build to catch type/CSS errors**

Run: `pnpm --filter @eat/web build`

Expected: success. Fix any compile errors (likely `CookModal` prop changes — remove `weekStart` prop from its interface).

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/pages/PlanPage/PlanPage.tsx apps/web/src/pages/PlanPage/PlanPage.css apps/web/src/pages/PlanPage/CookModal.tsx
git commit -m "feat(web): rolling 17-day plan page with horizontal scroll"
```

---

## Task 10: AddFromPlanModal component

**Files:**
- Create: `apps/web/src/pages/ShoppingListPage/AddFromPlanModal.tsx`
- Create: `apps/web/src/pages/ShoppingListPage/AddFromPlanModal.css`
- Create: `apps/web/src/pages/ShoppingListPage/AddFromPlanModal.test.tsx`

- [ ] **Step 1: Write failing test for the modal**

Create `apps/web/src/pages/ShoppingListPage/AddFromPlanModal.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { AddFromPlanModal } from './AddFromPlanModal';
import { api } from '../../api/client';

vi.mock('../../api/client', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe('AddFromPlanModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-16T10:00:00'));
  });

  it('renders an empty state when no upcoming entries', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ entries: [] });

    render(<AddFromPlanModal currentListRecipeIds={new Set()} onClose={() => {}} />, { wrapper });

    await waitFor(() => expect(screen.getByText(/no planned recipes/i)).toBeInTheDocument());
  });

  it('shows upcoming days with pre-tick reflecting current list recipes', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      entries: [
        { id: 'e1', date: '2026-05-17', recipeId: 'r-pasta', recipeName: 'Pasta', servings: 2, status: 'planned' },
        { id: 'e2', date: '2026-05-18', recipeId: 'r-curry', recipeName: 'Curry', servings: 4, status: 'planned' },
      ],
    });

    render(
      <AddFromPlanModal
        currentListRecipeIds={new Set(['r-pasta'])}
        onClose={() => {}}
      />,
      { wrapper },
    );

    await waitFor(() => expect(screen.getByLabelText(/Pasta/)).toBeChecked());
    expect(screen.getByLabelText(/Curry/)).not.toBeChecked();
  });

  it('calls /from-plan with ticked entry ids on submit', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      entries: [
        { id: 'e1', date: '2026-05-17', recipeId: 'r-pasta', recipeName: 'Pasta', servings: 2, status: 'planned' },
        { id: 'e2', date: '2026-05-18', recipeId: 'r-curry', recipeName: 'Curry', servings: 4, status: 'planned' },
      ],
    });
    vi.mocked(api.post).mockResolvedValue({ id: 'list-1', items: [] });

    const onClose = vi.fn();
    render(
      <AddFromPlanModal
        currentListRecipeIds={new Set(['r-pasta'])}
        onClose={onClose}
      />,
      { wrapper },
    );

    await waitFor(() => expect(screen.getByLabelText(/Pasta/)).toBeChecked());

    // Tick Curry; pasta stays ticked
    fireEvent.click(screen.getByLabelText(/Curry/));

    fireEvent.click(screen.getByRole('button', { name: /Update list/i }));

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/shopping-lists/from-plan', { entryIds: ['e1', 'e2'] }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });
});
```

- [ ] **Step 2: Run test (fails — component doesn't exist)**

Run: `pnpm --filter @eat/web test -- AddFromPlanModal.test`

Expected: FAIL — cannot find module.

- [ ] **Step 3: Create the component**

Create `apps/web/src/pages/ShoppingListPage/AddFromPlanModal.tsx`:

```typescript
import { useMemo, useState, useEffect } from 'react';
import { useMealPlanEntries } from '../../hooks/useMealPlan';
import { useApplyPlanToShoppingList } from '../../hooks/useShoppingList';
import { addDays, toIsoDate } from '../../lib/dateUtils';
import type { MealPlanEntry } from '@eat/shared';
import './AddFromPlanModal.css';

export interface AddFromPlanModalProps {
  currentListRecipeIds: Set<string>;
  onClose: () => void;
}

type DayGroup = { date: string; entries: MealPlanEntry[]; label: string };

function isoFromDays(now: Date, offset: number): string {
  return toIsoDate(addDays(now, offset));
}

function formatDayLabel(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}

export function AddFromPlanModal({ currentListRecipeIds, onClose }: AddFromPlanModalProps) {
  const now = useMemo(() => new Date(), []);
  const from = useMemo(() => isoFromDays(now, 0), [now]);
  const to = useMemo(() => isoFromDays(now, 14), [now]);

  const { data: entriesResp, isLoading } = useMealPlanEntries(from, to);
  const applyMut = useApplyPlanToShoppingList();

  const dayGroups: DayGroup[] = useMemo(() => {
    const byDate: Record<string, MealPlanEntry[]> = {};
    for (const e of entriesResp?.entries ?? []) {
      (byDate[e.date] ??= []).push(e);
    }
    return Object.keys(byDate)
      .sort()
      .map((date) => ({ date, entries: byDate[date], label: formatDayLabel(date) }));
  }, [entriesResp]);

  // Pre-tick: a day is ticked if every entry's recipeId is in currentListRecipeIds.
  const [tickedDays, setTickedDays] = useState<Set<string>>(new Set());

  useEffect(() => {
    const initial = new Set<string>();
    for (const g of dayGroups) {
      if (g.entries.every((e) => currentListRecipeIds.has(e.recipeId))) {
        initial.add(g.date);
      }
    }
    setTickedDays(initial);
  }, [dayGroups, currentListRecipeIds]);

  function toggleDay(date: string) {
    setTickedDays((prev) => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  }

  async function handleSubmit() {
    const entryIds: string[] = [];
    for (const g of dayGroups) {
      if (tickedDays.has(g.date)) {
        for (const e of g.entries) entryIds.push(e.id);
      }
    }
    await applyMut.mutateAsync({ entryIds });
    onClose();
  }

  return (
    <div className="afp-overlay" role="dialog" aria-modal="true">
      <div className="afp-panel">
        <div className="afp-header">
          <h2 className="afp-title">Add from planned recipes</h2>
          <button className="afp-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {isLoading && <p className="afp-status">Loading…</p>}

        {!isLoading && dayGroups.length === 0 && (
          <p className="afp-empty">No planned recipes in the next 2 weeks. Add recipes to your plan first.</p>
        )}

        {!isLoading && dayGroups.length > 0 && (
          <ul className="afp-list">
            {dayGroups.map((g) => {
              const summary = g.entries.length === 1
                ? g.entries[0].recipeName
                : `${g.entries.length} recipes`;
              const id = `afp-${g.date}`;
              return (
                <li key={g.date} className="afp-row">
                  <input
                    id={id}
                    type="checkbox"
                    checked={tickedDays.has(g.date)}
                    onChange={() => toggleDay(g.date)}
                    aria-label={summary}
                  />
                  <label htmlFor={id} className="afp-label">
                    <span className="afp-date">{g.label}</span>
                    <span className="afp-summary">{summary}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}

        <div className="afp-actions">
          <button className="btn-outline" onClick={onClose}>Cancel</button>
          <button
            className="btn-primary"
            onClick={handleSubmit}
            disabled={applyMut.isPending || isLoading}
          >
            {applyMut.isPending ? 'Updating…' : 'Update list'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create the CSS**

Create `apps/web/src/pages/ShoppingListPage/AddFromPlanModal.css`:

```css
.afp-overlay {
  position: fixed; inset: 0;
  background: rgba(20, 20, 22, 0.45);
  display: flex; align-items: center; justify-content: center;
  z-index: 100;
}
.afp-panel {
  background: var(--paper);
  border-radius: var(--radius-card-lg);
  padding: 20px 22px;
  width: min(480px, calc(100vw - 32px));
  max-height: 80vh;
  display: flex; flex-direction: column;
  gap: 14px;
}
.afp-header {
  display: flex; align-items: baseline; justify-content: space-between;
}
.afp-title {
  font-family: var(--font-serif);
  font-style: italic;
  font-size: 24px;
  margin: 0;
}
.afp-close {
  background: transparent; border: none; cursor: pointer;
  font-size: 18px; color: var(--mute);
}
.afp-status, .afp-empty {
  text-align: center;
  color: var(--ink2);
  padding: 24px 0;
}
.afp-list {
  list-style: none;
  display: flex; flex-direction: column;
  gap: 8px;
  overflow-y: auto;
  flex: 1;
  margin: 0; padding: 0;
}
.afp-row {
  display: flex; align-items: center; gap: 12px;
  padding: 10px 12px;
  border: 1px solid var(--rule);
  border-radius: var(--radius-control);
}
.afp-label {
  flex: 1;
  display: flex; align-items: baseline; gap: 12px;
  cursor: pointer;
}
.afp-date {
  font-family: var(--font-sans);
  font-size: 12px; font-weight: 700;
  letter-spacing: 0.06em;
  color: var(--mute);
  text-transform: uppercase;
  min-width: 90px;
}
.afp-summary {
  font-size: 14px; font-weight: 500;
}
.afp-actions {
  display: flex; gap: 8px; justify-content: flex-end;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @eat/web test -- AddFromPlanModal.test`

Expected: PASS — all 3 tests pass.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/pages/ShoppingListPage/AddFromPlanModal.tsx apps/web/src/pages/ShoppingListPage/AddFromPlanModal.css apps/web/src/pages/ShoppingListPage/AddFromPlanModal.test.tsx
git commit -m "feat(web): add AddFromPlanModal for shopping list"
```

---

## Task 11: ShoppingListPage updates

**Files:**
- Modify: `apps/web/src/pages/ShoppingListPage/ShoppingListPage.tsx`
- Modify: `apps/web/src/pages/ShoppingListPage/ShoppingListPage.test.tsx`

- [ ] **Step 1: Update ShoppingListPage to use the modal**

In `apps/web/src/pages/ShoppingListPage/ShoppingListPage.tsx`:

1. Remove `useGenerateShoppingList` from the import; remove `mondayOf`, `toIsoDate` from `dateUtils` import (no longer needed unless used elsewhere — verify).
2. Add `AddFromPlanModal` import: `import { AddFromPlanModal } from './AddFromPlanModal';`
3. Inside the component:
   - Remove `const generate = useGenerateShoppingList();`
   - Remove `const thisWeekStart = toIsoDate(mondayOf(new Date()));`
   - Add `const [showAddFromPlan, setShowAddFromPlan] = useState(false);`
   - Derive `currentListRecipeIds` from the loaded list items:
     ```typescript
     const currentListRecipeIds = useMemo(() => {
       const set = new Set<string>();
       for (const item of list?.items ?? []) {
         if (item.sourceRecipeId) set.add(item.sourceRecipeId);
       }
       return set;
     }, [list]);
     ```
4. Replace the `<button ... onClick={() => generate.mutate(...)}>` with:
   ```tsx
   <button
     className="btn-primary"
     onClick={() => setShowAddFromPlan(true)}
   >
     Add from planned recipes
   </button>
   ```
5. Replace the empty-state hint `"Click 'Generate for this week'..."` with `"Click 'Add from planned recipes' to build one from your plan."`.
6. At the bottom of the rendered JSX, before the closing tag, add:
   ```tsx
   {showAddFromPlan && (
     <AddFromPlanModal
       currentListRecipeIds={currentListRecipeIds}
       onClose={() => setShowAddFromPlan(false)}
     />
   )}
   ```

Use Read on the existing file to find the exact line numbers, then Edit them in place.

- [ ] **Step 2: Update the existing `ShoppingListPage.test.tsx`**

Read `apps/web/src/pages/ShoppingListPage/ShoppingListPage.test.tsx` and update any test that:
- Asserts "Generate for this week" text — change to "Add from planned recipes"
- Mocks `/api/shopping-lists/generate` — change to `/api/shopping-lists/from-plan`
- Asserts `useGenerateShoppingList` was called — replace with `useApplyPlanToShoppingList`

Inspect the file first; then update the assertions inline.

- [ ] **Step 3: Run web tests**

Run: `pnpm --filter @eat/web test`

Expected: all pass. Fix any leftover references to the old types.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/pages/ShoppingListPage/ShoppingListPage.tsx apps/web/src/pages/ShoppingListPage/ShoppingListPage.test.tsx
git commit -m "feat(web): replace generate button with Add from planned recipes modal"
```

---

## Task 12: E2E tests update

**Files:**
- Modify: `apps/web/tests/app.spec.ts`

- [ ] **Step 1: Update the meal-plans mock**

In `apps/web/tests/app.spec.ts`, find the existing `await page.route('**/api/meal-plans*', ...)` block and replace with a mock for the new endpoint:

```typescript
await page.route('**/api/meal-plans/entries*', (route) =>
  route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      entries: [
        { id: 'entry-1', date: thisTuesday, recipeId: 'recipe-1', recipeName: 'Pasta', servings: 4, status: 'planned' },
      ],
    }),
  }),
);
```

Also: drop `mealPlanId` from the entry shape (no longer in `MealPlanEntry`).

- [ ] **Step 2: Search the file for any other route patterns that might break**

Run: `grep -n "weekStart\|mealPlanId\|generated_from_meal_plan\|shopping-lists/generate" apps/web/tests/app.spec.ts`

For each match, update to the new API:
- `/api/shopping-lists/generate` → `/api/shopping-lists/from-plan`
- Drop `mealPlanId` / `weekStart` references in mock payloads

- [ ] **Step 3: Run E2E**

Run: `pnpm test:e2e`

Expected: pass. If a test asserts the "Generate for this week" button text on the shopping list page, update it to "Add from planned recipes". If a test scrolls the plan week grid, update to scroll the new `.plan-week-scroll` element.

- [ ] **Step 4: Commit**

```bash
git add apps/web/tests/app.spec.ts
git commit -m "test(e2e): update mocks and assertions for plan refactor"
```

---

## Task 13: Full test suite verification + docs

**Files:**
- Modify: `PLAN.md`

- [ ] **Step 1: Run the full test suite (root)**

Run: `pnpm test`

Expected: all unit/component tests pass across the monorepo. If any test in another package or file breaks, fix it inline and add a follow-up commit.

- [ ] **Step 2: Run E2E**

Run: `pnpm test:e2e`

Expected: pass.

- [ ] **Step 3: Update PLAN.md**

In `PLAN.md`, under the `## Done` section, add at the top (chronological — most recent first):

```markdown
- 2026-05-16 — Plan refactor: dropped `meal_plans` table; `meal_plan_entries` now owns `household_id` directly. Plan page shows a rolling 17-day window (today − 2 → today + 14) with horizontal scroll, today auto-scrolled to the 3rd column. Up to 4 recipes per day (UI cap). Removed auto-shopping-list-generate on plan changes. Shopping list "Generate for this week" replaced by "Add from planned recipes" modal that re-derives recipe-sourced items from selected days, leaving manual + staple items untouched. Migration 0008 + new `source_recipe_id` column on `shopping_list_items` for pre-tick matching.
```

- [ ] **Step 4: Commit**

```bash
git add PLAN.md
git commit -m "docs: log plan refactor in PLAN.md"
```

- [ ] **Step 5: Manual UI verification (in browser)**

Run: `pnpm dev`

Visit `http://localhost:5173/plan`:
- [ ] today is the 3rd visible column from the left
- [ ] horizontal scrolling reveals 2 days before and 14 after today
- [ ] dropping a recipe onto a day adds an entry without changing the shopping list
- [ ] adding a 5th recipe to a day is prevented in the UI (capacity message shows)

Visit `http://localhost:5173/list`:
- [ ] header button reads "Add from planned recipes"
- [ ] clicking it opens the modal with upcoming days listed
- [ ] days whose recipe is already on the list are pre-ticked
- [ ] clicking "Update list" updates recipe items only; any manual item you add stays after the update
- [ ] empty state in the modal when no upcoming planned recipes

Report any UI bugs as new tasks; do not mark the plan complete until manual verification passes or any deferred items are explicitly noted.
