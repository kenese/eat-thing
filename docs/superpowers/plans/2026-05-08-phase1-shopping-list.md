# Phase 1: Shopping List Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Staples CRUD and a Shopping List generator that computes what to buy based on the week's meal plan minus current inventory plus staple items below their replenishment threshold.

**Architecture:** Three layers — shared types define the data shapes; Express routes handle the generation algorithm (server-side join across meal plan → recipes → ingredients, inventory subtraction, staple threshold check) and CRUD; React hooks + components expose the feature in a `/list` page. All stored quantities are already in canonical units (g/ml/count), so only g↔ml cross-conversion (via `canonical_foods.density_g_per_ml`) is needed at generation time.

**Tech Stack:** Express + Drizzle ORM + Zod (server); TanStack Query (client); `@eat/shared` types package; React + CSS Modules (UI); existing `api` client (`apps/web/src/api/client.ts`).

---

## File Map

**New files:**
- `apps/server/src/routes/staples.ts` — Staples CRUD router (GET/POST/PUT/DELETE)
- `apps/server/src/routes/staples.test.ts` — validation + auth unit tests
- `apps/server/src/routes/shopping-lists.ts` — generate + read + item CRUD router
- `apps/server/src/routes/shopping-lists.test.ts` — validation + auth unit tests
- `apps/web/src/hooks/useStaples.ts` — TanStack Query hooks for staples
- `apps/web/src/hooks/useShoppingList.ts` — TanStack Query hooks for shopping lists
- `apps/web/src/pages/ShoppingListPage/ShoppingListPage.tsx` — main shopping list page
- `apps/web/src/pages/ShoppingListPage/ShoppingListPage.css` — styles
- `apps/web/src/pages/ShoppingListPage/StaplesModal.tsx` — staples management modal

**Modified files:**
- `packages/shared/src/index.ts` — add Staple + ShoppingList types
- `apps/server/src/app.ts` — wire staplesRouter + shoppingListsRouter
- `apps/web/src/App.tsx` — replace `/list` PlaceholderPage with ShoppingListPage
- `apps/web/tests/app.spec.ts` — add stub routes + update /list heading assertion

---

## Task 1: Shared types

No runtime test needed — pure TypeScript. Run tsc to verify.

**Files:**
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: Append Staple + ShoppingList types to `packages/shared/src/index.ts`**

```typescript
// ─── Staples ──────────────────────────────────────────────────────────────────

export interface Staple {
  id: string;
  householdId: string;
  canonicalFoodId: string;
  foodName: string;
  thresholdQty: number;
  thresholdUnit: CanonicalUnit;
  createdAt: string;
}

export interface CreateStapleInput {
  canonicalFoodId: string;
  thresholdQty: number;
  thresholdUnit: CanonicalUnit;
}

export interface UpdateStapleInput {
  thresholdQty?: number;
  thresholdUnit?: CanonicalUnit;
}

// ─── Shopping lists ───────────────────────────────────────────────────────────

export type ShoppingSource = 'recipe' | 'staple' | 'manual';

export interface ShoppingListItem {
  id: string;
  shoppingListId: string;
  canonicalFoodId: string | null;
  name: string;
  qty: number;
  unit: CanonicalUnit;
  source: ShoppingSource;
  checked: boolean;
}

export interface ShoppingList {
  id: string;
  householdId: string;
  generatedFromMealPlanId: string | null;
  createdAt: string;
  finalizedAt: string | null;
  items: ShoppingListItem[];
}

export interface GenerateShoppingListInput {
  weekStart: string;
}

export interface AddShoppingListItemInput {
  name: string;
  qty: number;
  unit: CanonicalUnit;
  canonicalFoodId?: string | null;
}

export interface UpdateShoppingListItemInput {
  checked?: boolean;
  qty?: number;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
pnpm --filter @eat/shared build
```

Expected: exits 0 with no type errors.

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/index.ts
git commit -m "feat(shared): add Staple and ShoppingList types"
```

---

## Task 2: Staples server routes

**Files:**
- Create: `apps/server/src/routes/staples.ts`
- Create: `apps/server/src/routes/staples.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `apps/server/src/routes/staples.test.ts`:

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
vi.mock('better-auth/node', () => ({ fromNodeHeaders: (h: unknown) => h }));
vi.mock('drizzle-orm', () => ({
  and: (...args: unknown[]) => args,
  eq: () => null,
  asc: () => null,
  sql: Object.assign(() => null, { template: () => null }),
}));
vi.mock('uuid', () => ({ v4: () => 'fixed-uuid' }));
vi.mock('../db/index.js', () => {
  const chain = { from: () => ({ where: () => ({ limit: mocks.membershipLimit }) }) };
  return { db: { select: () => chain } };
});
vi.mock('../db/schema/index.js', () => ({
  memberships: { householdId: 'householdId', userId: 'userId' },
  staples: {},
  canonicalFoods: {},
}));

const { default: staplesRouter } = await import('./staples');

describe('staples router', () => {
  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use('/api/staples', staplesRouter);
  });

  it('returns 401 for unauthenticated requests', async () => {
    mocks.getSession.mockResolvedValue(null);
    const res = await request(app).get('/api/staples');
    expect(res.status).toBe(401);
  });

  it('POST rejects missing canonicalFoodId', async () => {
    mocks.getSession.mockResolvedValue({ user: { id: 'u1' } });
    mocks.membershipLimit.mockResolvedValue([{ householdId: 'hh-1' }]);
    const res = await request(app).post('/api/staples').send({ thresholdQty: 500, thresholdUnit: 'g' });
    expect(res.status).toBe(400);
  });

  it('POST rejects non-positive thresholdQty', async () => {
    mocks.getSession.mockResolvedValue({ user: { id: 'u1' } });
    mocks.membershipLimit.mockResolvedValue([{ householdId: 'hh-1' }]);
    const res = await request(app)
      .post('/api/staples')
      .send({ canonicalFoodId: '00000000-0000-0000-0000-000000000001', thresholdQty: 0, thresholdUnit: 'g' });
    expect(res.status).toBe(400);
  });

  it('POST rejects invalid thresholdUnit', async () => {
    mocks.getSession.mockResolvedValue({ user: { id: 'u1' } });
    mocks.membershipLimit.mockResolvedValue([{ householdId: 'hh-1' }]);
    const res = await request(app)
      .post('/api/staples')
      .send({ canonicalFoodId: '00000000-0000-0000-0000-000000000001', thresholdQty: 500, thresholdUnit: 'oz' });
    expect(res.status).toBe(400);
  });

  it('PUT rejects invalid thresholdUnit', async () => {
    mocks.getSession.mockResolvedValue({ user: { id: 'u1' } });
    mocks.membershipLimit.mockResolvedValue([{ householdId: 'hh-1' }]);
    const res = await request(app).put('/api/staples/some-id').send({ thresholdUnit: 'lb' });
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run tests to confirm failure**

```bash
pnpm --filter @eat/server test -- --reporter=verbose staples.test.ts
```

Expected: `Cannot find module './staples'` or similar import error.

- [ ] **Step 3: Implement staples routes**

Create `apps/server/src/routes/staples.ts`:

```typescript
import { Router, type Router as ExpressRouter } from 'express';
import { z } from 'zod';
import { and, eq, asc, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { withHousehold } from '../middleware/with-household.js';
import { db } from '../db/index.js';
import { staples, canonicalFoods } from '../db/schema/index.js';

const router: ExpressRouter = Router();

const createSchema = z.object({
  canonicalFoodId: z.string().uuid(),
  thresholdQty: z.number().positive(),
  thresholdUnit: z.enum(['g', 'ml', 'count']),
});

const updateSchema = z.object({
  thresholdQty: z.number().positive().optional(),
  thresholdUnit: z.enum(['g', 'ml', 'count']).optional(),
});

const joinOn = sql`${staples.canonicalFoodId} = ${canonicalFoods.id}`;

const cols = {
  id: staples.id,
  householdId: staples.householdId,
  canonicalFoodId: staples.canonicalFoodId,
  foodName: canonicalFoods.name,
  thresholdQty: staples.thresholdQty,
  thresholdUnit: staples.thresholdUnit,
  createdAt: staples.createdAt,
};

// GET /api/staples
router.get('/', withHousehold, async (req, res) => {
  try {
    const rows = await db
      .select(cols)
      .from(staples)
      .innerJoin(canonicalFoods, joinOn)
      .where(eq(staples.householdId, req.householdId))
      .orderBy(asc(canonicalFoods.name));
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/staples
router.post('/', withHousehold, async (req, res) => {
  const parse = createSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: 'Invalid input', details: parse.error.flatten() });
    return;
  }
  const { canonicalFoodId, thresholdQty, thresholdUnit } = parse.data;
  const id = uuidv4();

  try {
    await db.insert(staples).values({ id, householdId: req.householdId, canonicalFoodId, thresholdQty, thresholdUnit });
    const [full] = await db.select(cols).from(staples).innerJoin(canonicalFoods, joinOn).where(eq(staples.id, id));
    res.status(201).json(full);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/staples/:id
router.put('/:id', withHousehold, async (req, res) => {
  const id = req.params['id'] as string;
  const parse = updateSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: 'Invalid input', details: parse.error.flatten() });
    return;
  }

  try {
    const [existing] = await db
      .select({ householdId: staples.householdId })
      .from(staples)
      .where(eq(staples.id, id))
      .limit(1);
    if (!existing) { res.status(404).json({ error: 'Staple not found' }); return; }
    if (existing.householdId !== req.householdId) { res.status(403).json({ error: 'Forbidden' }); return; }

    const d = parse.data;
    await db
      .update(staples)
      .set({
        ...(d.thresholdQty !== undefined && { thresholdQty: d.thresholdQty }),
        ...(d.thresholdUnit !== undefined && { thresholdUnit: d.thresholdUnit }),
      })
      .where(eq(staples.id, id));

    const [full] = await db.select(cols).from(staples).innerJoin(canonicalFoods, joinOn).where(eq(staples.id, id));
    res.json(full);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/staples/:id
router.delete('/:id', withHousehold, async (req, res) => {
  const id = req.params['id'] as string;
  try {
    const [existing] = await db
      .select({ householdId: staples.householdId })
      .from(staples)
      .where(eq(staples.id, id))
      .limit(1);
    if (!existing) { res.status(404).json({ error: 'Staple not found' }); return; }
    if (existing.householdId !== req.householdId) { res.status(403).json({ error: 'Forbidden' }); return; }

    await db.delete(staples).where(eq(staples.id, id));
    res.json({ id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
pnpm --filter @eat/server test -- --reporter=verbose staples.test.ts
```

Expected: 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/routes/staples.ts apps/server/src/routes/staples.test.ts
git commit -m "feat(server): add staples CRUD routes"
```

---

## Task 3: Shopping list server routes

**Files:**
- Create: `apps/server/src/routes/shopping-lists.ts`
- Create: `apps/server/src/routes/shopping-lists.test.ts`

- [ ] **Step 1: Write failing tests**

Create `apps/server/src/routes/shopping-lists.test.ts`:

```typescript
import { vi, describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  membershipLimit: vi.fn(),
}));

vi.mock('../auth.js', () => ({ auth: { api: { getSession: mocks.getSession } } }));
vi.mock('better-auth/node', () => ({ fromNodeHeaders: (h: unknown) => h }));
vi.mock('drizzle-orm', () => ({
  and: (...args: unknown[]) => args,
  eq: () => null,
  asc: () => null,
  desc: () => null,
  sql: Object.assign((...args: unknown[]) => args, { template: () => null }),
}));
vi.mock('uuid', () => ({ v4: () => 'fixed-uuid' }));
vi.mock('../db/index.js', () => {
  const chain = { from: () => ({ where: () => ({ limit: mocks.membershipLimit }) }) };
  return { db: { select: () => chain } };
});
vi.mock('../db/schema/index.js', () => ({
  memberships: { householdId: 'householdId', userId: 'userId' },
  mealPlans: {}, mealPlanEntries: {}, recipes: {}, recipeIngredients: {},
  inventoryItems: {}, canonicalFoods: {}, staples: {},
  shoppingLists: {}, shoppingListItems: {},
}));

const { default: shoppingListsRouter } = await import('./shopping-lists');

describe('shopping-lists router', () => {
  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use('/api/shopping-lists', shoppingListsRouter);
  });

  it('returns 401 for unauthenticated requests', async () => {
    mocks.getSession.mockResolvedValue(null);
    const res = await request(app).post('/api/shopping-lists/generate').send({ weekStart: '2026-05-05' });
    expect(res.status).toBe(401);
  });

  it('POST /generate rejects missing weekStart', async () => {
    mocks.getSession.mockResolvedValue({ user: { id: 'u1' } });
    mocks.membershipLimit.mockResolvedValue([{ householdId: 'hh-1' }]);
    const res = await request(app).post('/api/shopping-lists/generate').send({});
    expect(res.status).toBe(400);
  });

  it('POST /generate rejects malformed weekStart', async () => {
    mocks.getSession.mockResolvedValue({ user: { id: 'u1' } });
    mocks.membershipLimit.mockResolvedValue([{ householdId: 'hh-1' }]);
    const res = await request(app).post('/api/shopping-lists/generate').send({ weekStart: 'not-a-date' });
    expect(res.status).toBe(400);
  });

  it('PUT item rejects non-boolean checked', async () => {
    mocks.getSession.mockResolvedValue({ user: { id: 'u1' } });
    mocks.membershipLimit.mockResolvedValue([{ householdId: 'hh-1' }]);
    const res = await request(app)
      .put('/api/shopping-lists/list-id/items/item-id')
      .send({ checked: 'yes' });
    expect(res.status).toBe(400);
  });

  it('POST manual item rejects missing name', async () => {
    mocks.getSession.mockResolvedValue({ user: { id: 'u1' } });
    mocks.membershipLimit.mockResolvedValue([{ householdId: 'hh-1' }]);
    const res = await request(app)
      .post('/api/shopping-lists/list-id/items')
      .send({ qty: 2, unit: 'count' });
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
pnpm --filter @eat/server test -- --reporter=verbose shopping-lists.test.ts
```

Expected: `Cannot find module './shopping-lists'`

- [ ] **Step 3: Implement shopping-lists router**

Create `apps/server/src/routes/shopping-lists.ts`:

```typescript
import { Router, type Router as ExpressRouter } from 'express';
import { z } from 'zod';
import { and, eq, asc, desc, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { withHousehold } from '../middleware/with-household.js';
import { db } from '../db/index.js';
import {
  mealPlans, mealPlanEntries, recipes, recipeIngredients,
  inventoryItems, canonicalFoods, staples,
  shoppingLists, shoppingListItems,
} from '../db/schema/index.js';

const router: ExpressRouter = Router();

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'must be YYYY-MM-DD');
const generateSchema = z.object({ weekStart: isoDate });
const addItemSchema = z.object({
  name: z.string().trim().min(1).max(200),
  qty: z.number().positive(),
  unit: z.enum(['g', 'ml', 'count']),
  canonicalFoodId: z.string().uuid().nullable().optional(),
});
const updateItemSchema = z.object({
  checked: z.boolean().optional(),
  qty: z.number().positive().optional(),
}).refine(d => d.checked !== undefined || d.qty !== undefined, {
  message: 'At least one of checked or qty must be provided',
});

const listItemCols = {
  id: shoppingListItems.id,
  shoppingListId: shoppingListItems.shoppingListId,
  canonicalFoodId: shoppingListItems.canonicalFoodId,
  name: shoppingListItems.name,
  qty: shoppingListItems.qty,
  unit: shoppingListItems.unit,
  source: shoppingListItems.source,
  checked: shoppingListItems.checked,
};

async function itemsForList(listId: string) {
  return db
    .select(listItemCols)
    .from(shoppingListItems)
    .where(eq(shoppingListItems.shoppingListId, listId))
    .orderBy(asc(shoppingListItems.source), asc(shoppingListItems.name));
}

// POST /api/shopping-lists/generate
// Computes: Σ recipe ingredients (scaled) − inventory + staples below threshold
router.post('/generate', withHousehold, async (req, res) => {
  const parse = generateSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: 'Invalid input', details: parse.error.flatten() });
    return;
  }
  const { weekStart } = parse.data;
  const hid = req.householdId;

  try {
    // 1. Find meal plan for this week
    const [plan] = await db
      .select({ id: mealPlans.id })
      .from(mealPlans)
      .where(and(eq(mealPlans.householdId, hid), eq(mealPlans.weekStart, weekStart)))
      .limit(1);

    // 2. Fetch recipe ingredients scaled by entry servings
    type RawIng = {
      canonicalFoodId: string; foodName: string;
      unit: 'g' | 'ml' | 'count'; qty: number;
      recipeServings: number; entryServings: number;
      densityGPerMl: number | null;
    };

    const rawIngredients: RawIng[] = plan
      ? await db
          .select({
            canonicalFoodId: recipeIngredients.canonicalFoodId,
            foodName: canonicalFoods.name,
            unit: recipeIngredients.unit,
            qty: recipeIngredients.qty,
            recipeServings: recipes.servings,
            entryServings: mealPlanEntries.servings,
            densityGPerMl: canonicalFoods.densityGPerMl,
          })
          .from(mealPlanEntries)
          .innerJoin(recipes, eq(mealPlanEntries.recipeId, recipes.id))
          .innerJoin(recipeIngredients, eq(recipeIngredients.recipeId, recipes.id))
          .innerJoin(canonicalFoods, eq(recipeIngredients.canonicalFoodId, canonicalFoods.id))
          .where(and(
            eq(mealPlanEntries.mealPlanId, plan.id),
            eq(recipeIngredients.optional, false),
          ))
      : [];

    // 3. Aggregate by (canonicalFoodId, unit)
    type FoodInfo = { foodName: string; unit: 'g' | 'ml' | 'count'; qty: number; densityGPerMl: number | null };
    const needed = new Map<string, FoodInfo>();
    for (const row of rawIngredients) {
      const ratio = row.recipeServings > 0 ? row.entryServings / row.recipeServings : 1;
      const key = `${row.canonicalFoodId}::${row.unit}`;
      const cur = needed.get(key);
      if (cur) { cur.qty += row.qty * ratio; }
      else { needed.set(key, { foodName: row.foodName, unit: row.unit, qty: row.qty * ratio, densityGPerMl: row.densityGPerMl }); }
    }

    // 4. Get inventory totals by (canonicalFoodId, unit)
    const invRows = await db
      .select({
        canonicalFoodId: inventoryItems.canonicalFoodId,
        unit: inventoryItems.unit,
        total: sql<number>`sum(${inventoryItems.qty})`,
      })
      .from(inventoryItems)
      .where(eq(inventoryItems.householdId, hid))
      .groupBy(inventoryItems.canonicalFoodId, inventoryItems.unit);

    const invMap = new Map<string, number>();
    for (const r of invRows) invMap.set(`${r.canonicalFoodId}::${r.unit}`, Number(r.total));

    // 5. Compute gaps (needed − available), with g↔ml cross-conversion via density
    type ItemInsert = Omit<typeof shoppingListItems.$inferInsert, 'id' | 'shoppingListId' | 'householdId'>;
    const toInsert: ItemInsert[] = [];

    for (const [key, info] of needed) {
      const [foodId] = key.split('::');
      let gap = info.qty - (invMap.get(key) ?? 0);

      if (gap > 0 && info.densityGPerMl != null) {
        const altUnit = info.unit === 'g' ? 'ml' : info.unit === 'ml' ? 'g' : null;
        if (altUnit) {
          const altAvail = invMap.get(`${foodId}::${altUnit}`) ?? 0;
          const altInSameUnit = info.unit === 'g' ? altAvail * info.densityGPerMl : altAvail / info.densityGPerMl;
          gap = Math.max(0, gap - altInSameUnit);
        }
      }

      if (gap > 0.001) {
        toInsert.push({ canonicalFoodId: foodId, name: info.foodName, qty: gap, unit: info.unit, source: 'recipe', checked: false });
      }
    }

    // 6. Add staples below threshold
    const staplesRows = await db
      .select({
        canonicalFoodId: staples.canonicalFoodId,
        foodName: canonicalFoods.name,
        thresholdQty: staples.thresholdQty,
        thresholdUnit: staples.thresholdUnit,
        densityGPerMl: canonicalFoods.densityGPerMl,
      })
      .from(staples)
      .innerJoin(canonicalFoods, sql`${staples.canonicalFoodId} = ${canonicalFoods.id}`)
      .where(eq(staples.householdId, hid));

    for (const st of staplesRows) {
      let available = invMap.get(`${st.canonicalFoodId}::${st.thresholdUnit}`) ?? 0;
      if (st.densityGPerMl != null) {
        const altUnit = st.thresholdUnit === 'g' ? 'ml' : st.thresholdUnit === 'ml' ? 'g' : null;
        if (altUnit) {
          const altAvail = invMap.get(`${st.canonicalFoodId}::${altUnit}`) ?? 0;
          available += st.thresholdUnit === 'g' ? altAvail * st.densityGPerMl : altAvail / st.densityGPerMl;
        }
      }
      const gap = st.thresholdQty - available;
      if (gap > 0.001) {
        toInsert.push({ canonicalFoodId: st.canonicalFoodId, name: st.foodName, qty: gap, unit: st.thresholdUnit, source: 'staple', checked: false });
      }
    }

    // 7. Create shopping list + items in a transaction
    const listId = uuidv4();
    await db.transaction(async tx => {
      await tx.insert(shoppingLists).values({ id: listId, householdId: hid, generatedFromMealPlanId: plan?.id ?? null });
      if (toInsert.length > 0) {
        await tx.insert(shoppingListItems).values(
          toInsert.map(item => ({ id: uuidv4(), shoppingListId: listId, householdId: hid, ...item })),
        );
      }
    });

    const [list] = await db
      .select({ id: shoppingLists.id, householdId: shoppingLists.householdId, generatedFromMealPlanId: shoppingLists.generatedFromMealPlanId, createdAt: shoppingLists.createdAt, finalizedAt: shoppingLists.finalizedAt })
      .from(shoppingLists)
      .where(eq(shoppingLists.id, listId));
    const items = await itemsForList(listId);
    res.status(201).json({ ...list, items });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/shopping-lists/current
// Returns the most recently created list for the household (404 if none).
router.get('/current', withHousehold, async (req, res) => {
  try {
    const [list] = await db
      .select({ id: shoppingLists.id, householdId: shoppingLists.householdId, generatedFromMealPlanId: shoppingLists.generatedFromMealPlanId, createdAt: shoppingLists.createdAt, finalizedAt: shoppingLists.finalizedAt })
      .from(shoppingLists)
      .where(eq(shoppingLists.householdId, req.householdId))
      .orderBy(desc(shoppingLists.createdAt))
      .limit(1);
    if (!list) { res.status(404).json({ error: 'No shopping list found' }); return; }
    const items = await itemsForList(list.id);
    res.json({ ...list, items });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/shopping-lists/:listId/items/:itemId
router.put('/:listId/items/:itemId', withHousehold, async (req, res) => {
  const itemId = req.params['itemId'] as string;
  const parse = updateItemSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: 'Invalid input', details: parse.error.flatten() });
    return;
  }
  try {
    const [existing] = await db
      .select({ householdId: shoppingListItems.householdId })
      .from(shoppingListItems)
      .where(eq(shoppingListItems.id, itemId))
      .limit(1);
    if (!existing) { res.status(404).json({ error: 'Item not found' }); return; }
    if (existing.householdId !== req.householdId) { res.status(403).json({ error: 'Forbidden' }); return; }

    const d = parse.data;
    await db.update(shoppingListItems)
      .set({ ...(d.checked !== undefined && { checked: d.checked }), ...(d.qty !== undefined && { qty: d.qty }) })
      .where(eq(shoppingListItems.id, itemId));
    const [full] = await db.select(listItemCols).from(shoppingListItems).where(eq(shoppingListItems.id, itemId));
    res.json(full);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/shopping-lists/:listId/items — manual add
router.post('/:listId/items', withHousehold, async (req, res) => {
  const listId = req.params['listId'] as string;
  const parse = addItemSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: 'Invalid input', details: parse.error.flatten() });
    return;
  }
  try {
    const [list] = await db
      .select({ householdId: shoppingLists.householdId })
      .from(shoppingLists)
      .where(eq(shoppingLists.id, listId))
      .limit(1);
    if (!list) { res.status(404).json({ error: 'Shopping list not found' }); return; }
    if (list.householdId !== req.householdId) { res.status(403).json({ error: 'Forbidden' }); return; }

    const id = uuidv4();
    await db.insert(shoppingListItems).values({
      id, shoppingListId: listId, householdId: req.householdId,
      canonicalFoodId: parse.data.canonicalFoodId ?? null,
      name: parse.data.name, qty: parse.data.qty, unit: parse.data.unit,
      source: 'manual', checked: false,
    });
    const [full] = await db.select(listItemCols).from(shoppingListItems).where(eq(shoppingListItems.id, id));
    res.status(201).json(full);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/shopping-lists/:listId/items/:itemId
router.delete('/:listId/items/:itemId', withHousehold, async (req, res) => {
  const itemId = req.params['itemId'] as string;
  try {
    const [existing] = await db
      .select({ householdId: shoppingListItems.householdId })
      .from(shoppingListItems)
      .where(eq(shoppingListItems.id, itemId))
      .limit(1);
    if (!existing) { res.status(404).json({ error: 'Item not found' }); return; }
    if (existing.householdId !== req.householdId) { res.status(403).json({ error: 'Forbidden' }); return; }
    await db.delete(shoppingListItems).where(eq(shoppingListItems.id, itemId));
    res.json({ id: itemId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
pnpm --filter @eat/server test -- --reporter=verbose shopping-lists.test.ts
```

Expected: 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/routes/shopping-lists.ts apps/server/src/routes/shopping-lists.test.ts
git commit -m "feat(server): add shopping list generate + item CRUD routes"
```

---

## Task 4: Wire routes in app.ts

**Files:**
- Modify: `apps/server/src/app.ts`

- [ ] **Step 1: Add imports**

In `apps/server/src/app.ts`, add after the existing imports:

```typescript
import staplesRouter from './routes/staples.js';
import shoppingListsRouter from './routes/shopping-lists.js';
```

- [ ] **Step 2: Mount routes**

After the existing `app.use('/api/meal-plans', mealPlansRouter);` line, add:

```typescript
app.use('/api/staples', staplesRouter);
app.use('/api/shopping-lists', shoppingListsRouter);
```

- [ ] **Step 3: Run full server test suite**

```bash
pnpm --filter @eat/server test
```

Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add apps/server/src/app.ts
git commit -m "feat(server): wire staples and shopping-lists routes"
```

---

## Task 5: Client hooks

**Files:**
- Create: `apps/web/src/hooks/useStaples.ts`
- Create: `apps/web/src/hooks/useShoppingList.ts`

No unit tests needed — these are thin TanStack Query wrappers; behaviour is covered by E2E.

- [ ] **Step 1: Create useStaples.ts**

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import type { Staple, CreateStapleInput, UpdateStapleInput } from '@eat/shared';

export function useStaples() {
  return useQuery<Staple[]>({
    queryKey: ['staples'],
    queryFn: () => api.get<Staple[]>('/api/staples'),
  });
}

export function useCreateStaple() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateStapleInput) => api.post<Staple>('/api/staples', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['staples'] }),
  });
}

export function useUpdateStaple() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: UpdateStapleInput & { id: string }) =>
      api.put<Staple>(`/api/staples/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['staples'] }),
  });
}

export function useDeleteStaple() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del<{ id: string }>(`/api/staples/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['staples'] }),
  });
}
```

- [ ] **Step 2: Create useShoppingList.ts**

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import type {
  ShoppingList, ShoppingListItem,
  GenerateShoppingListInput, AddShoppingListItemInput, UpdateShoppingListItemInput,
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

export function useGenerateShoppingList() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: GenerateShoppingListInput) =>
      api.post<ShoppingList>('/api/shopping-lists/generate', data),
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
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/hooks/useStaples.ts apps/web/src/hooks/useShoppingList.ts
git commit -m "feat(web): add useStaples and useShoppingList hooks"
```

---

## Task 6: StaplesModal component

**Files:**
- Create: `apps/web/src/pages/ShoppingListPage/StaplesModal.tsx`

- [ ] **Step 1: Implement StaplesModal**

Create `apps/web/src/pages/ShoppingListPage/StaplesModal.tsx`:

```tsx
import React, { useState } from 'react';
import { useFoodSearch } from '../../hooks/useFoodSearch';
import { useStaples, useCreateStaple, useDeleteStaple } from '../../hooks/useStaples';
import type { CanonicalUnit } from '@eat/shared';

interface Props {
  onClose: () => void;
}

export function StaplesModal({ onClose }: Props) {
  const { data: staples = [], isLoading } = useStaples();
  const createStaple = useCreateStaple();
  const deleteStaple = useDeleteStaple();

  const [foodQuery, setFoodQuery] = useState('');
  const [selectedFood, setSelectedFood] = useState<{ id: string; name: string; defaultUnit: CanonicalUnit } | null>(null);
  const [thresholdQty, setThresholdQty] = useState('');
  const [thresholdUnit, setThresholdUnit] = useState<CanonicalUnit>('g');
  const [formError, setFormError] = useState('');

  const { data: foodSuggestions = [] } = useFoodSearch(foodQuery);

  function handleSelectFood(food: { id: string; name: string; defaultUnit: CanonicalUnit }) {
    setSelectedFood(food);
    setFoodQuery(food.name);
    setThresholdUnit(food.defaultUnit);
  }

  async function handleAdd() {
    if (!selectedFood) { setFormError('Select a food'); return; }
    const qty = parseFloat(thresholdQty);
    if (isNaN(qty) || qty <= 0) { setFormError('Enter a positive quantity'); return; }
    setFormError('');
    await createStaple.mutateAsync({ canonicalFoodId: selectedFood.id, thresholdQty: qty, thresholdUnit });
    setFoodQuery('');
    setSelectedFood(null);
    setThresholdQty('');
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Manage staples</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="modal-body">
          {isLoading && <p>Loading…</p>}

          {staples.length > 0 && (
            <ul className="staples-list">
              {staples.map(s => (
                <li key={s.id} className="staples-item">
                  <span className="staples-name">{s.foodName}</span>
                  <span className="staples-threshold">{s.thresholdQty} {s.thresholdUnit}</span>
                  <button
                    className="staples-delete"
                    onClick={() => deleteStaple.mutate(s.id)}
                    aria-label={`Delete ${s.foodName}`}
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}

          {staples.length === 0 && !isLoading && (
            <p className="staples-empty">No staples yet. Add items that you always want to have on hand.</p>
          )}

          <div className="staples-add-form">
            <h3>Add staple</h3>
            <div className="food-search-wrap">
              <input
                className="form-input"
                placeholder="Search food…"
                value={foodQuery}
                onChange={e => { setFoodQuery(e.target.value); setSelectedFood(null); }}
              />
              {foodSuggestions.length > 0 && !selectedFood && (
                <ul className="food-suggestions">
                  {foodSuggestions.map(f => (
                    <li key={f.id} onClick={() => handleSelectFood(f)} className="food-suggestion-item">
                      {f.name}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="form-row">
              <input
                className="form-input form-input--sm"
                type="number"
                min="0"
                step="any"
                placeholder="Qty"
                value={thresholdQty}
                onChange={e => setThresholdQty(e.target.value)}
              />
              <select
                className="form-select"
                value={thresholdUnit}
                onChange={e => setThresholdUnit(e.target.value as CanonicalUnit)}
              >
                <option value="g">g</option>
                <option value="ml">ml</option>
                <option value="count">count</option>
              </select>
              <button
                className="btn btn-primary"
                onClick={handleAdd}
                disabled={createStaple.isPending}
              >
                Add
              </button>
            </div>
            {formError && <p className="form-error">{formError}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/pages/ShoppingListPage/StaplesModal.tsx
git commit -m "feat(web): add StaplesModal component"
```

---

## Task 7: ShoppingListPage component

**Files:**
- Create: `apps/web/src/pages/ShoppingListPage/ShoppingListPage.tsx`
- Create: `apps/web/src/pages/ShoppingListPage/ShoppingListPage.css`

- [ ] **Step 1: Implement ShoppingListPage**

Create `apps/web/src/pages/ShoppingListPage/ShoppingListPage.tsx`:

```tsx
import React, { useState } from 'react';
import { useCurrentShoppingList, useGenerateShoppingList, useUpdateShoppingListItem, useAddShoppingListItem, useDeleteShoppingListItem } from '../../hooks/useShoppingList';
import { StaplesModal } from './StaplesModal';
import type { ShoppingList, ShoppingListItem, CanonicalUnit } from '@eat/shared';
import { mondayOf, toIsoDate } from '../PlanPage/dateUtils';
import './ShoppingListPage.css';

const SOURCE_LABELS: Record<string, string> = {
  recipe: 'From recipes',
  staple: 'Staples',
  manual: 'Manual',
};

interface ItemRowProps {
  item: ShoppingListItem;
  onToggle: (checked: boolean) => void;
  onDelete: () => void;
}

function ItemRow({ item, onToggle, onDelete }: ItemRowProps) {
  return (
    <li className={`list-item${item.checked ? ' checked' : ''}`}>
      <input
        type="checkbox"
        className="list-item-check"
        checked={item.checked}
        onChange={e => onToggle(e.target.checked)}
        id={`item-${item.id}`}
      />
      <label htmlFor={`item-${item.id}`} className="list-item-label">
        <span className="list-item-name">{item.name}</span>
        <span className="list-item-qty">{Math.ceil(item.qty * 10) / 10} {item.unit}</span>
      </label>
      <button className="list-item-delete" onClick={onDelete} aria-label={`Remove ${item.name}`}>✕</button>
    </li>
  );
}

interface AddItemFormProps {
  listId: string;
}

function AddItemForm({ listId }: AddItemFormProps) {
  const addItem = useAddShoppingListItem(listId);
  const [name, setName] = useState('');
  const [qty, setQty] = useState('');
  const [unit, setUnit] = useState<CanonicalUnit>('count');

  async function handleAdd() {
    const parsedQty = parseFloat(qty);
    if (!name.trim() || isNaN(parsedQty) || parsedQty <= 0) return;
    await addItem.mutateAsync({ name: name.trim(), qty: parsedQty, unit });
    setName('');
    setQty('');
  }

  return (
    <div className="add-item-form">
      <input
        className="form-input"
        placeholder="Item name…"
        value={name}
        onChange={e => setName(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && handleAdd()}
      />
      <input
        className="form-input form-input--sm"
        type="number"
        min="0"
        step="any"
        placeholder="Qty"
        value={qty}
        onChange={e => setQty(e.target.value)}
      />
      <select className="form-select" value={unit} onChange={e => setUnit(e.target.value as CanonicalUnit)}>
        <option value="g">g</option>
        <option value="ml">ml</option>
        <option value="count">count</option>
      </select>
      <button className="btn btn-secondary" onClick={handleAdd} disabled={addItem.isPending}>
        + Add
      </button>
    </div>
  );
}

interface ListViewProps {
  list: ShoppingList;
}

function ListView({ list }: ListViewProps) {
  const updateItem = useUpdateShoppingListItem(list.id);
  const deleteItem = useDeleteShoppingListItem(list.id);

  const groups: Record<string, ShoppingListItem[]> = { recipe: [], staple: [], manual: [] };
  for (const item of list.items) {
    (groups[item.source] ??= []).push(item);
  }

  const uncheckedCount = list.items.filter(i => !i.checked).length;

  return (
    <div className="list-view">
      <div className="list-summary">
        {uncheckedCount === 0
          ? <span className="list-done">All done!</span>
          : <span>{uncheckedCount} item{uncheckedCount !== 1 ? 's' : ''} remaining</span>}
      </div>

      {(['recipe', 'staple', 'manual'] as const).map(source => {
        const items = groups[source] ?? [];
        if (items.length === 0) return null;
        return (
          <section key={source} className="list-section">
            <h2 className="list-section-title">{SOURCE_LABELS[source]}</h2>
            <ul className="list-items">
              {items.map(item => (
                <ItemRow
                  key={item.id}
                  item={item}
                  onToggle={checked => updateItem.mutate({ itemId: item.id, checked })}
                  onDelete={() => deleteItem.mutate(item.id)}
                />
              ))}
            </ul>
          </section>
        );
      })}

      <section className="list-section list-section--manual">
        <h2 className="list-section-title">Add item</h2>
        <AddItemForm listId={list.id} />
      </section>
    </div>
  );
}

export function ShoppingListPage() {
  const { data: list, isLoading } = useCurrentShoppingList();
  const generate = useGenerateShoppingList();
  const [showStaples, setShowStaples] = useState(false);

  const thisWeekStart = toIsoDate(mondayOf(new Date()));

  return (
    <div className="shopping-list-page">
      <div className="page-header">
        <h1>Shopping list</h1>
        <div className="page-header-actions">
          <button className="btn btn-ghost" onClick={() => setShowStaples(true)}>Staples</button>
          <button
            className="btn btn-primary"
            onClick={() => generate.mutate({ weekStart: thisWeekStart })}
            disabled={generate.isPending}
          >
            {generate.isPending ? 'Generating…' : 'Generate for this week'}
          </button>
        </div>
      </div>

      {isLoading && <p className="page-status">Loading…</p>}

      {!isLoading && !list && (
        <div className="list-empty">
          <p>No shopping list yet.</p>
          <p className="list-empty-hint">Click "Generate for this week" to build one from your meal plan and staples.</p>
        </div>
      )}

      {!isLoading && list && <ListView list={list} />}

      {showStaples && <StaplesModal onClose={() => setShowStaples(false)} />}
    </div>
  );
}
```

- [ ] **Step 2: Create ShoppingListPage.css**

Create `apps/web/src/pages/ShoppingListPage/ShoppingListPage.css`:

```css
.shopping-list-page {
  padding: 1rem;
  max-width: 640px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-bottom: 1.25rem;
  flex-wrap: wrap;
}

.page-header h1 { margin: 0; }

.page-header-actions { display: flex; gap: 0.5rem; }

.page-status { color: var(--color-muted, #94a3b8); }

.list-empty { text-align: center; padding: 3rem 1rem; color: var(--color-muted, #94a3b8); }
.list-empty-hint { font-size: 0.875rem; margin-top: 0.5rem; }

.list-summary { font-size: 0.875rem; color: var(--color-muted, #94a3b8); margin-bottom: 1rem; }
.list-done { color: #22c55e; }

.list-section { margin-bottom: 1.5rem; }
.list-section-title { font-size: 0.75rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--color-muted, #94a3b8); margin-bottom: 0.5rem; }

.list-items { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 0.25rem; }

.list-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.625rem 0.75rem;
  background: var(--color-surface, #1e1e2e);
  border-radius: 0.5rem;
  transition: opacity 0.15s;
}
.list-item.checked { opacity: 0.45; }
.list-item-check { flex-shrink: 0; width: 1.1rem; height: 1.1rem; accent-color: var(--color-primary, #6366f1); }
.list-item-label { flex: 1; display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; cursor: pointer; }
.list-item-name { font-size: 0.9375rem; }
.list-item.checked .list-item-name { text-decoration: line-through; }
.list-item-qty { font-size: 0.8125rem; color: var(--color-muted, #94a3b8); white-space: nowrap; }
.list-item-delete { background: none; border: none; color: var(--color-muted, #94a3b8); cursor: pointer; padding: 0 0.25rem; font-size: 0.875rem; }
.list-item-delete:hover { color: #f87171; }

.add-item-form { display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; }
.add-item-form .form-input { flex: 1; min-width: 120px; }

.form-input {
  background: var(--color-surface, #1e1e2e);
  border: 1px solid var(--color-border, #3f3f5a);
  border-radius: 0.375rem;
  color: inherit;
  padding: 0.5rem 0.75rem;
  font-size: 0.9375rem;
}
.form-input--sm { max-width: 80px; }
.form-select { background: var(--color-surface, #1e1e2e); border: 1px solid var(--color-border, #3f3f5a); border-radius: 0.375rem; color: inherit; padding: 0.5rem 0.5rem; font-size: 0.9375rem; }

.btn { padding: 0.5rem 1rem; border-radius: 0.375rem; font-size: 0.9375rem; border: none; cursor: pointer; font-weight: 500; white-space: nowrap; }
.btn-primary { background: var(--color-primary, #6366f1); color: #fff; }
.btn-primary:hover:not(:disabled) { background: #4f46e5; }
.btn-secondary { background: var(--color-surface, #1e1e2e); border: 1px solid var(--color-border, #3f3f5a); color: inherit; }
.btn-ghost { background: transparent; color: var(--color-muted, #94a3b8); }
.btn-ghost:hover { color: inherit; }
.btn:disabled { opacity: 0.5; cursor: not-allowed; }

/* StaplesModal styles */
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.55); display: flex; align-items: flex-end; justify-content: center; z-index: 50; padding: 0; }
@media (min-width: 480px) { .modal-overlay { align-items: center; padding: 1rem; } }
.modal { background: var(--color-bg, #0f0f1a); border-radius: 0.75rem 0.75rem 0 0; width: 100%; max-width: 480px; max-height: 90vh; overflow-y: auto; padding: 1.25rem; }
@media (min-width: 480px) { .modal { border-radius: 0.75rem; } }
.modal-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem; }
.modal-header h2 { margin: 0; }
.modal-close { background: none; border: none; font-size: 1.1rem; cursor: pointer; color: var(--color-muted, #94a3b8); }

.staples-list { list-style: none; padding: 0; margin: 0 0 1.25rem; display: flex; flex-direction: column; gap: 0.25rem; }
.staples-item { display: flex; align-items: center; gap: 0.75rem; padding: 0.5rem 0.75rem; background: var(--color-surface, #1e1e2e); border-radius: 0.375rem; }
.staples-name { flex: 1; }
.staples-threshold { font-size: 0.8125rem; color: var(--color-muted, #94a3b8); }
.staples-delete { background: none; border: none; color: var(--color-muted, #94a3b8); cursor: pointer; }
.staples-delete:hover { color: #f87171; }
.staples-empty { color: var(--color-muted, #94a3b8); font-size: 0.875rem; margin-bottom: 1.25rem; }

.staples-add-form h3 { margin: 0 0 0.75rem; font-size: 0.9375rem; }
.food-search-wrap { position: relative; margin-bottom: 0.5rem; }
.food-search-wrap .form-input { width: 100%; box-sizing: border-box; }
.food-suggestions { position: absolute; top: 100%; left: 0; right: 0; background: var(--color-surface, #1e1e2e); border: 1px solid var(--color-border, #3f3f5a); border-radius: 0.375rem; margin: 0; padding: 0; list-style: none; z-index: 10; max-height: 180px; overflow-y: auto; }
.food-suggestion-item { padding: 0.5rem 0.75rem; cursor: pointer; }
.food-suggestion-item:hover { background: var(--color-border, #3f3f5a); }
.form-row { display: flex; gap: 0.5rem; align-items: center; }
.form-error { color: #f87171; font-size: 0.875rem; margin-top: 0.375rem; }
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/pages/ShoppingListPage/
git commit -m "feat(web): add ShoppingListPage and StaplesModal"
```

---

## Task 8: Wire into App.tsx + update E2E tests

**Files:**
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/tests/app.spec.ts`

- [ ] **Step 1: Write a failing E2E test for the /list route**

In `apps/web/tests/app.spec.ts`, update `stubAuthedShell` to add stubs for the new API routes, and update the `/list` assertion to match the real page heading:

In the `stubAuthedShell` function, add after the existing `api/meal-plans*` stub:

```typescript
await page.route('**/api/shopping-lists*', (route) =>
  route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'No shopping list found' }) }),
);
await page.route('**/api/staples*', (route) =>
  route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
);
```

Update the `/list` route test (currently checking for `heading level 2 "Shopping List"`):

```typescript
test('list route loads', async ({ page }) => {
  await page.goto('/list');
  await expect(page.getByRole('heading', { level: 1, name: 'Shopping list' })).toBeVisible();
});
```

- [ ] **Step 2: Run E2E to confirm failure**

```bash
pnpm test:e2e -- --grep "list route loads"
```

Expected: test fails because the placeholder page renders a level-2 heading.

- [ ] **Step 3: Replace PlaceholderPage with ShoppingListPage in App.tsx**

In `apps/web/src/App.tsx`, add import:

```typescript
import { ShoppingListPage } from './pages/ShoppingListPage/ShoppingListPage';
```

Replace:

```typescript
<Route path="/list" element={<PlaceholderPage title="Shopping List" />} />
```

With:

```typescript
<Route path="/list" element={<ShoppingListPage />} />
```

- [ ] **Step 4: Run E2E to confirm passing**

```bash
pnpm test:e2e -- --grep "list route loads"
```

Expected: passes.

- [ ] **Step 5: Run full test suites**

```bash
pnpm test && pnpm test:e2e
```

Expected: Both pass.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/App.tsx apps/web/tests/app.spec.ts
git commit -m "feat(web): wire ShoppingListPage into /list route"
```
