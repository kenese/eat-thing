# Shopping List Purchase & Remove Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the unused shopping-list checkbox with multi-select + action bar (Mark purchased → inventory, Remove → delete), drop `location` from inventory in favour of category-based grouping, and add find-or-create canonical food to both the shopping-list and inventory add forms.

**Architecture:** DB migration drops `location` from `inventory_items`. A new server helper `findOrCreateFood` creates minimal canonical food entries on demand. Two new batch endpoints handle purchase and removal. The frontend gains a local selection state (`Set<string>`) driving a sticky action bar.

**Tech Stack:** Drizzle ORM, Express, Zod, TanStack Query, React, CSS Modules (co-located plain CSS), Vitest + React Testing Library.

---

## File map

| Status | Path | Change |
|--------|------|--------|
| Create | `apps/server/drizzle/0006_drop_inventory_location.sql` | Drop location column + enum |
| Modify | `apps/server/drizzle/meta/_journal.json` | Add migration entry |
| Modify | `apps/server/src/db/schema/enums.ts` | Remove `inventoryLocationEnum` |
| Modify | `apps/server/src/db/schema/inventory.ts` | Remove `location` column |
| Modify | `packages/shared/src/index.ts` | Remove `InventoryLocation`, update types |
| Create | `apps/server/src/lib/find-or-create-food.ts` | Find-or-create canonical food helper |
| Create | `apps/server/src/lib/find-or-create-food.test.ts` | Unit tests for helper |
| Modify | `apps/server/src/routes/inventory.ts` | Remove location, add category filter, find-or-create |
| Modify | `apps/server/src/routes/shopping-lists.ts` | Update add-item, add purchase + batch-delete endpoints |
| Modify | `apps/server/src/routes/shopping-lists.test.ts` | Tests for new endpoints |
| Modify | `apps/web/src/hooks/useInventory.ts` | location → category |
| Modify | `apps/web/src/hooks/useShoppingList.ts` | Add purchase + batch-delete hooks |
| Modify | `apps/web/src/pages/InventoryPage/InventoryPage.tsx` | Category tabs, remove location refs |
| Modify | `apps/web/src/pages/InventoryPage/ItemForm.tsx` | Remove location, add find-or-create flow |
| Modify | `apps/web/src/pages/ShoppingListPage/ShoppingListPage.tsx` | Selection state, action bar, new add form |
| Modify | `apps/web/src/pages/ShoppingListPage/ShoppingListPage.css` | Action bar styles |
| Modify | `apps/web/src/pages/ShoppingListPage/ShoppingListPage.test.tsx` | Update for new hooks + behaviour |
| Modify | `IDEAS.md` | Add "while shopping" mode + recipe chip navigation entries |

---

## Task 1: DB migration — drop location

**Files:**
- Create: `apps/server/drizzle/0006_drop_inventory_location.sql`
- Modify: `apps/server/drizzle/meta/_journal.json`
- Modify: `apps/server/src/db/schema/enums.ts`
- Modify: `apps/server/src/db/schema/inventory.ts`

- [ ] **Step 1: Write the migration SQL**

Create `apps/server/drizzle/0006_drop_inventory_location.sql`:

```sql
ALTER TABLE "inventory_items" DROP COLUMN "location";
DROP TYPE IF EXISTS "inventory_location";
```

- [ ] **Step 2: Add the migration to the journal**

In `apps/server/drizzle/meta/_journal.json`, append to the `entries` array:

```json
{
  "idx": 6,
  "version": "7",
  "when": 1747353600000,
  "tag": "0006_drop_inventory_location",
  "breakpoints": true
}
```

- [ ] **Step 3: Remove `inventoryLocationEnum` from schema**

In `apps/server/src/db/schema/enums.ts`, remove this line:
```ts
export const inventoryLocationEnum = pgEnum('inventory_location', ['fridge', 'pantry', 'freezer', 'other']);
```

- [ ] **Step 4: Remove `location` from inventory schema**

In `apps/server/src/db/schema/inventory.ts`, remove the import of `inventoryLocationEnum` and the `location` column. Full file after change:

```ts
import { pgTable, uuid, text, timestamp, doublePrecision, jsonb, boolean } from 'drizzle-orm/pg-core';
import { households } from './households.js';
import { canonicalFoods } from './foods.js';

export const inventoryItems = pgTable('inventory_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  householdId: uuid('household_id').notNull().references(() => households.id, { onDelete: 'cascade' }),
  canonicalFoodId: uuid('canonical_food_id').notNull().references(() => canonicalFoods.id),
  qty: doublePrecision('qty').notNull(),
  unit: text('unit').notNull(),
  brand: text('brand'),
  purchasedAt: timestamp('purchased_at'),
  expiresAt: timestamp('expires_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const cookEvents = pgTable('cook_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  householdId: uuid('household_id').notNull().references(() => households.id, { onDelete: 'cascade' }),
  mealPlanEntryId: uuid('meal_plan_entry_id'),
  cookedAt: timestamp('cooked_at').notNull().defaultNow(),
  deductions: jsonb('deductions').notNull().default([]),
  promptsResolved: jsonb('prompts_resolved').notNull().default([]),
  synced: boolean('synced').notNull().default(false),
});
```

- [ ] **Step 5: Apply the migration**

```bash
pnpm --filter @eat/server db:migrate
```

Expected: migration applies cleanly, no errors.

- [ ] **Step 6: Commit**

```bash
git add apps/server/drizzle/0006_drop_inventory_location.sql \
        apps/server/drizzle/meta/_journal.json \
        apps/server/src/db/schema/enums.ts \
        apps/server/src/db/schema/inventory.ts
git commit -m "feat: drop inventory location column, remove inventoryLocationEnum"
```

---

## Task 2: Shared types

**Files:**
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: Update the types**

Replace the relevant sections of `packages/shared/src/index.ts`:

Remove `InventoryLocation`:
```ts
// DELETE this line:
export type InventoryLocation = 'fridge' | 'pantry' | 'freezer' | 'other';
```

Replace `InventoryRow` (remove `location`, add `category`):
```ts
export interface InventoryRow {
  id: string;
  householdId: string;
  canonicalFoodId: string;
  foodName: string;
  qty: number;
  unit: string;
  brand: string | null;
  category: Category;
  purchasedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}
```

Replace `CreateInventoryItemInput` (remove `location`, support find-or-create):
```ts
export interface CreateInventoryItemInput {
  canonicalFoodId?: string;
  foodName?: string;
  category?: Category;
  qty: number;
  unit: string;
  brand?: string | null;
  purchasedAt?: string | null;
  expiresAt?: string | null;
}
```

Replace `UpdateInventoryItemInput` (remove `location`):
```ts
export interface UpdateInventoryItemInput {
  qty?: number;
  unit?: string;
  brand?: string | null;
  purchasedAt?: string | null;
  expiresAt?: string | null;
}
```

Replace `AddShoppingListItemInput` (add `category`):
```ts
export interface AddShoppingListItemInput {
  name: string;
  qty: number;
  unit: string;
  canonicalFoodId?: string | null;
  category?: Category;
}
```

Add new batch action types after `UpdateShoppingListItemInput`:
```ts
export interface PurchaseShoppingListItemsInput {
  itemIds: string[];
}

export interface BatchDeleteShoppingListItemsInput {
  itemIds: string[];
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
pnpm --filter @eat/shared build
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/index.ts
git commit -m "feat: update shared types — remove InventoryLocation, add category to InventoryRow, add batch action types"
```

---

## Task 3: Find-or-create food helper + tests

**Files:**
- Create: `apps/server/src/lib/find-or-create-food.ts`
- Create: `apps/server/src/lib/find-or-create-food.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/server/src/lib/find-or-create-food.test.ts`:

```ts
import { vi, describe, it, expect, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  selectResult: [] as { id: string }[],
  insertResult: [{ id: 'new-uuid' }] as { id: string }[],
}));

vi.mock('uuid', () => ({ v4: () => 'new-uuid' }));
vi.mock('../db/index.js', () => {
  const selectChain = {
    from: () => ({ where: () => ({ limit: () => Promise.resolve(mocks.selectResult) }) }),
  };
  const insertChain = {
    values: () => ({ onConflictDoNothing: () => ({ returning: () => Promise.resolve(mocks.insertResult) }) }),
  };
  return { db: { select: () => selectChain, insert: () => insertChain } };
});
vi.mock('../db/schema/index.js', () => ({ canonicalFoods: { id: 'id', name: 'name' } }));
vi.mock('drizzle-orm', () => ({ ilike: () => null, eq: () => null }));

const { findOrCreateFood } = await import('./find-or-create-food.js');

describe('findOrCreateFood', () => {
  beforeEach(() => {
    mocks.selectResult = [];
    mocks.insertResult = [{ id: 'new-uuid' }];
  });

  it('returns existing food id when name matches', async () => {
    mocks.selectResult = [{ id: 'existing-uuid' }];
    const id = await findOrCreateFood('Milk', 'dairy', 'ml');
    expect(id).toBe('existing-uuid');
  });

  it('creates and returns new food id when no match', async () => {
    mocks.selectResult = [];
    const id = await findOrCreateFood('Dish Soap', 'other', 'count');
    expect(id).toBe('new-uuid');
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
pnpm --filter @eat/server test -- find-or-create-food
```

Expected: fails with "Cannot find module".

- [ ] **Step 3: Implement the helper**

Create `apps/server/src/lib/find-or-create-food.ts`:

```ts
import { ilike } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/index.js';
import { canonicalFoods } from '../db/schema/index.js';

export type FoodCategory = 'produce' | 'meat' | 'dairy' | 'pantry' | 'frozen' | 'drinks' | 'other';

export async function findOrCreateFood(name: string, category: FoodCategory, defaultUnit: string): Promise<string> {
  const trimmed = name.trim();

  const [existing] = await db
    .select({ id: canonicalFoods.id })
    .from(canonicalFoods)
    .where(ilike(canonicalFoods.name, trimmed))
    .limit(1);

  if (existing) return existing.id;

  const result = await db
    .insert(canonicalFoods)
    .values({ id: uuidv4(), name: trimmed, category, defaultUnit, aliases: [] })
    .onConflictDoNothing()
    .returning({ id: canonicalFoods.id });

  if (result.length > 0) return result[0].id;

  // Race condition: another request inserted first — fetch it.
  const [conflict] = await db
    .select({ id: canonicalFoods.id })
    .from(canonicalFoods)
    .where(ilike(canonicalFoods.name, trimmed))
    .limit(1);
  return conflict.id;
}
```

- [ ] **Step 4: Run test to confirm it passes**

```bash
pnpm --filter @eat/server test -- find-or-create-food
```

Expected: 2 tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/lib/find-or-create-food.ts \
        apps/server/src/lib/find-or-create-food.test.ts
git commit -m "feat: add findOrCreateFood helper with tests"
```

---

## Task 4: Server — update inventory routes

**Files:**
- Modify: `apps/server/src/routes/inventory.ts`

- [ ] **Step 1: Rewrite inventory.ts**

Replace the full file content of `apps/server/src/routes/inventory.ts`:

```ts
import { Router, type Router as ExpressRouter } from 'express';
import { z } from 'zod';
import { and, eq, ilike, asc, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { withHousehold } from '../middleware/with-household.js';
import { db } from '../db/index.js';
import { inventoryItems, canonicalFoods } from '../db/schema/index.js';
import { findOrCreateFood, type FoodCategory } from '../lib/find-or-create-food.js';

const router: ExpressRouter = Router();

const CATEGORIES = ['produce', 'meat', 'dairy', 'pantry', 'frozen', 'drinks', 'other'] as const;

async function markInventoryDirty(householdId: string) {
  await db.execute(
    sql`INSERT INTO sync_dirty (id, household_id, resource_type, resource_id, dirty_since)
        VALUES (${uuidv4()}, ${householdId}, 'inventory', ${householdId}, now())
        ON CONFLICT (household_id, resource_type, resource_id)
        DO UPDATE SET dirty_since = now(), claimed_at = null`,
  );
}

const createSchema = z.object({
  canonicalFoodId: z.string().uuid().optional(),
  foodName: z.string().trim().min(1).max(200).optional(),
  category: z.enum(CATEGORIES).optional(),
  qty: z.number().positive(),
  unit: z.string().trim().min(1).max(40),
  brand: z.string().trim().max(100).nullable().optional(),
  purchasedAt: z.string().nullable().optional(),
  expiresAt: z.string().nullable().optional(),
}).refine(d => d.canonicalFoodId || (d.foodName && d.category), {
  message: 'Either canonicalFoodId or (foodName + category) must be provided',
});

const updateSchema = z.object({
  qty: z.number().positive().optional(),
  unit: z.string().trim().min(1).max(40).optional(),
  brand: z.string().trim().max(100).nullable().optional(),
  purchasedAt: z.string().nullable().optional(),
  expiresAt: z.string().nullable().optional(),
});

const cols = {
  id: inventoryItems.id,
  householdId: inventoryItems.householdId,
  canonicalFoodId: inventoryItems.canonicalFoodId,
  foodName: canonicalFoods.name,
  category: canonicalFoods.category,
  qty: inventoryItems.qty,
  unit: inventoryItems.unit,
  brand: inventoryItems.brand,
  purchasedAt: inventoryItems.purchasedAt,
  expiresAt: inventoryItems.expiresAt,
  createdAt: inventoryItems.createdAt,
  updatedAt: inventoryItems.updatedAt,
};

const joinOn = sql`${inventoryItems.canonicalFoodId} = ${canonicalFoods.id}`;

// GET /api/inventory?category=dairy&q=milk
router.get('/', withHousehold, async (req, res) => {
  try {
    const { category, q } = req.query as { category?: string; q?: string };

    const conditions = [eq(inventoryItems.householdId, req.householdId)];
    if (category && (CATEGORIES as readonly string[]).includes(category)) {
      conditions.push(eq(canonicalFoods.category, category));
    }
    if (q?.trim()) {
      conditions.push(ilike(canonicalFoods.name, `%${q.trim()}%`));
    }

    const items = await db
      .select(cols)
      .from(inventoryItems)
      .innerJoin(canonicalFoods, joinOn)
      .where(and(...conditions))
      .orderBy(asc(canonicalFoods.category), asc(canonicalFoods.name));

    res.json(items);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/inventory
router.post('/', withHousehold, async (req, res) => {
  const parse = createSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: 'Invalid input', details: parse.error.flatten() });
    return;
  }

  const newId = uuidv4();

  try {
    let foodId = parse.data.canonicalFoodId;
    if (!foodId) {
      foodId = await findOrCreateFood(parse.data.foodName!, parse.data.category as FoodCategory, parse.data.unit);
    }

    const { qty, unit, brand, purchasedAt, expiresAt } = parse.data;

    await db.insert(inventoryItems).values({
      id: newId,
      householdId: req.householdId,
      canonicalFoodId: foodId,
      qty,
      unit,
      brand: brand ?? null,
      purchasedAt: purchasedAt ? new Date(purchasedAt) : null,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    });

    const [full] = await db
      .select(cols)
      .from(inventoryItems)
      .innerJoin(canonicalFoods, joinOn)
      .where(eq(inventoryItems.id, newId));

    res.status(201).json(full);
    markInventoryDirty(req.householdId).catch(err => console.error('sync_dirty write failed', err));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/inventory/:id
router.put('/:id', withHousehold, async (req, res) => {
  const id = req.params['id'] as string;

  const parse = updateSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: 'Invalid input', details: parse.error.flatten() });
    return;
  }

  try {
    const [existing] = await db
      .select({ householdId: inventoryItems.householdId })
      .from(inventoryItems)
      .where(eq(inventoryItems.id, id))
      .limit(1);

    if (!existing) { res.status(404).json({ error: 'Item not found' }); return; }
    if (existing.householdId !== req.householdId) { res.status(403).json({ error: 'Forbidden' }); return; }

    const d = parse.data;
    await db
      .update(inventoryItems)
      .set({
        ...(d.qty !== undefined && { qty: d.qty }),
        ...(d.unit !== undefined && { unit: d.unit }),
        ...('brand' in d && { brand: d.brand ?? null }),
        ...('purchasedAt' in d && { purchasedAt: d.purchasedAt ? new Date(d.purchasedAt) : null }),
        ...('expiresAt' in d && { expiresAt: d.expiresAt ? new Date(d.expiresAt) : null }),
        updatedAt: new Date(),
      })
      .where(eq(inventoryItems.id, id));

    const [full] = await db
      .select(cols)
      .from(inventoryItems)
      .innerJoin(canonicalFoods, joinOn)
      .where(eq(inventoryItems.id, id));

    res.json(full);
    markInventoryDirty(req.householdId).catch(err => console.error('sync_dirty write failed', err));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/inventory/:id
router.delete('/:id', withHousehold, async (req, res) => {
  const id = req.params['id'] as string;

  try {
    const [existing] = await db
      .select({ householdId: inventoryItems.householdId })
      .from(inventoryItems)
      .where(eq(inventoryItems.id, id))
      .limit(1);

    if (!existing) { res.status(404).json({ error: 'Item not found' }); return; }
    if (existing.householdId !== req.householdId) { res.status(403).json({ error: 'Forbidden' }); return; }

    await db.delete(inventoryItems).where(eq(inventoryItems.id, id));
    res.json({ id });
    markInventoryDirty(req.householdId).catch(err => console.error('sync_dirty write failed', err));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
```

- [ ] **Step 2: Verify server compiles**

```bash
pnpm --filter @eat/server build
```

Expected: no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add apps/server/src/routes/inventory.ts
git commit -m "feat: inventory routes — drop location, add category filter, find-or-create food"
```

---

## Task 5: Server — shopping list add-item, purchase, batch-delete + tests

**Files:**
- Modify: `apps/server/src/routes/shopping-lists.ts`
- Modify: `apps/server/src/routes/shopping-lists.test.ts`

- [ ] **Step 1: Write failing tests for new endpoints**

Add to the bottom of `apps/server/src/routes/shopping-lists.test.ts` (inside the `describe` block, before the closing `}`):

```ts
  it('POST /:listId/items/purchase returns 401 unauthenticated', async () => {
    mocks.getSession.mockResolvedValue(null);
    const res = await request(app)
      .post('/api/shopping-lists/list-1/items/purchase')
      .send({ itemIds: ['item-1'] });
    expect(res.status).toBe(401);
  });

  it('POST /:listId/items/purchase rejects empty itemIds', async () => {
    mocks.getSession.mockResolvedValue({ user: { id: 'u1' } });
    mocks.membershipLimit.mockResolvedValue([{ householdId: 'hh-1' }]);
    const res = await request(app)
      .post('/api/shopping-lists/list-1/items/purchase')
      .send({ itemIds: [] });
    expect(res.status).toBe(400);
  });

  it('POST /:listId/items/batch-delete returns 401 unauthenticated', async () => {
    mocks.getSession.mockResolvedValue(null);
    const res = await request(app)
      .post('/api/shopping-lists/list-1/items/batch-delete')
      .send({ itemIds: ['item-1'] });
    expect(res.status).toBe(401);
  });

  it('POST /:listId/items/batch-delete rejects empty itemIds', async () => {
    mocks.getSession.mockResolvedValue({ user: { id: 'u1' } });
    mocks.membershipLimit.mockResolvedValue([{ householdId: 'hh-1' }]);
    const res = await request(app)
      .post('/api/shopping-lists/list-1/items/batch-delete')
      .send({ itemIds: [] });
    expect(res.status).toBe(400);
  });

  it('POST manual item requires category when no canonicalFoodId', async () => {
    mocks.getSession.mockResolvedValue({ user: { id: 'u1' } });
    mocks.membershipLimit.mockResolvedValue([{ householdId: 'hh-1' }]);
    const res = await request(app)
      .post('/api/shopping-lists/list-id/items')
      .send({ name: 'Dish soap', qty: 1, unit: 'count' });
    expect(res.status).toBe(400);
  });
```

- [ ] **Step 2: Run tests to confirm new ones fail**

```bash
pnpm --filter @eat/server test -- shopping-lists
```

Expected: new tests fail (endpoints don't exist yet), existing tests pass.

- [ ] **Step 3: Update shopping-lists.ts**

In `apps/server/src/routes/shopping-lists.ts`:

**3a** — Add import at the top:
```ts
import { findOrCreateFood, type FoodCategory } from '../lib/find-or-create-food.js';
import { inArray } from 'drizzle-orm';
```

**3b** — Replace `addItemSchema` with:
```ts
const addItemSchema = z.object({
  name: z.string().trim().min(1).max(200),
  qty: z.number().positive(),
  unit: z.string().trim().min(1).max(40),
  canonicalFoodId: z.string().uuid().nullable().optional(),
  category: z.enum(['produce', 'meat', 'dairy', 'pantry', 'frozen', 'drinks', 'other']).optional(),
}).refine(d => d.canonicalFoodId || d.category, {
  message: 'category is required when canonicalFoodId is not provided',
});
```

**3c** — Add new schemas after `updateItemSchema`:
```ts
const batchItemSchema = z.object({
  itemIds: z.array(z.string().uuid()).min(1),
});
```

**3d** — Replace the `POST /:listId/items` handler body (find the handler and replace its content):
```ts
router.post('/:listId/items', withHousehold, async (req, res) => {
  const listId = req.params['listId'] as string;
  const parse = addItemSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: 'Invalid input', details: parse.error.flatten() });
    return;
  }
  if (!z.string().uuid().safeParse(listId).success) { res.status(404).json({ error: 'Not found' }); return; }
  try {
    const [list] = await db
      .select({ householdId: shoppingLists.householdId })
      .from(shoppingLists)
      .where(eq(shoppingLists.id, listId))
      .limit(1);
    if (!list) { res.status(404).json({ error: 'Shopping list not found' }); return; }
    if (list.householdId !== req.householdId) { res.status(403).json({ error: 'Forbidden' }); return; }

    let foodId = parse.data.canonicalFoodId ?? null;
    if (!foodId) {
      foodId = await findOrCreateFood(parse.data.name, parse.data.category as FoodCategory, parse.data.unit);
    }

    const id = uuidv4();
    await db.insert(shoppingListItems).values({
      id, shoppingListId: listId, householdId: req.householdId,
      canonicalFoodId: foodId,
      name: parse.data.name, qty: parse.data.qty, unit: parse.data.unit,
      source: 'manual', checked: false,
    });
    const [full] = await db
      .select(listItemCols)
      .from(shoppingListItems)
      .leftJoin(canonicalFoods, eq(canonicalFoods.id, shoppingListItems.canonicalFoodId))
      .where(eq(shoppingListItems.id, id));
    res.status(201).json(full ? withCategory(full) : null);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

**3e** — Add the two new endpoints before the price comparison section (before the `// ─── Price comparison` comment):

```ts
// POST /api/shopping-lists/:listId/items/purchase
router.post('/:listId/items/purchase', withHousehold, async (req, res) => {
  const listId = req.params['listId'] as string;
  const parse = batchItemSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: 'Invalid input', details: parse.error.flatten() });
    return;
  }
  if (!z.string().uuid().safeParse(listId).success) { res.status(404).json({ error: 'Not found' }); return; }

  try {
    const { itemIds } = parse.data;
    const items = await db
      .select({
        id: shoppingListItems.id,
        householdId: shoppingListItems.householdId,
        canonicalFoodId: shoppingListItems.canonicalFoodId,
        qty: shoppingListItems.qty,
        unit: shoppingListItems.unit,
      })
      .from(shoppingListItems)
      .where(inArray(shoppingListItems.id, itemIds));

    if (items.some(i => i.householdId !== req.householdId)) {
      res.status(403).json({ error: 'Forbidden' }); return;
    }

    await db.transaction(async tx => {
      const toInsert = items.filter(i => i.canonicalFoodId !== null);
      if (toInsert.length > 0) {
        await tx.insert(inventoryItems).values(
          toInsert.map(i => ({
            id: uuidv4(),
            householdId: req.householdId,
            canonicalFoodId: i.canonicalFoodId!,
            qty: i.qty,
            unit: i.unit,
            purchasedAt: new Date(),
          })),
        );
      }
      await tx.delete(shoppingListItems).where(inArray(shoppingListItems.id, itemIds));
    });

    const [list] = await db.select(listCols).from(shoppingLists).where(eq(shoppingLists.id, listId));
    const updatedItems = list ? await itemsForList(listId) : [];
    res.json(list ? { ...list, items: updatedItems } : { items: [] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/shopping-lists/:listId/items/batch-delete
router.post('/:listId/items/batch-delete', withHousehold, async (req, res) => {
  const listId = req.params['listId'] as string;
  const parse = batchItemSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: 'Invalid input', details: parse.error.flatten() });
    return;
  }
  if (!z.string().uuid().safeParse(listId).success) { res.status(404).json({ error: 'Not found' }); return; }

  try {
    const { itemIds } = parse.data;
    const items = await db
      .select({ householdId: shoppingListItems.householdId })
      .from(shoppingListItems)
      .where(inArray(shoppingListItems.id, itemIds));

    if (items.some(i => i.householdId !== req.householdId)) {
      res.status(403).json({ error: 'Forbidden' }); return;
    }

    await db.delete(shoppingListItems).where(inArray(shoppingListItems.id, itemIds));

    const [list] = await db.select(listCols).from(shoppingLists).where(eq(shoppingLists.id, listId));
    const updatedItems = list ? await itemsForList(listId) : [];
    res.json(list ? { ...list, items: updatedItems } : { items: [] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

**3f** — Add `inventoryItems` to the imports from `'../db/schema/index.js'` (it's used in the purchase endpoint):

The existing import already has `inventoryItems` — no change needed.

- [ ] **Step 4: Run tests**

```bash
pnpm --filter @eat/server test -- shopping-lists
```

Expected: all tests pass including the 5 new ones.

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/routes/shopping-lists.ts \
        apps/server/src/routes/shopping-lists.test.ts
git commit -m "feat: shopping-list add-item uses find-or-create; add purchase + batch-delete endpoints"
```

---

## Task 6: Client hooks

**Files:**
- Modify: `apps/web/src/hooks/useInventory.ts`
- Modify: `apps/web/src/hooks/useShoppingList.ts`

- [ ] **Step 1: Update useInventory.ts**

Replace the full file:

```ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import type { InventoryRow, CreateInventoryItemInput, UpdateInventoryItemInput } from '@eat/shared';

interface InventoryParams {
  category?: string;
  q?: string;
}

export function useInventory(params?: InventoryParams) {
  const qs = new URLSearchParams();
  if (params?.category) qs.set('category', params.category);
  if (params?.q) qs.set('q', params.q);
  const query = qs.toString();

  return useQuery<InventoryRow[]>({
    queryKey: ['inventory', params],
    queryFn: () => api.get<InventoryRow[]>(`/api/inventory${query ? `?${query}` : ''}`),
  });
}

export function useAddInventoryItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateInventoryItemInput) =>
      api.post<InventoryRow>('/api/inventory', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inventory'] }),
  });
}

export function useUpdateInventoryItem(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateInventoryItemInput) =>
      api.put<InventoryRow>(`/api/inventory/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inventory'] }),
  });
}

export function useDeleteInventoryItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del<{ id: string }>(`/api/inventory/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inventory'] }),
  });
}
```

- [ ] **Step 2: Update useShoppingList.ts**

Replace the full file:

```ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import type {
  ShoppingList, ShoppingListItem,
  GenerateShoppingListInput, AddShoppingListItemInput, UpdateShoppingListItemInput,
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

- [ ] **Step 3: Verify TypeScript**

```bash
pnpm --filter @eat/web build 2>&1 | head -30
```

Expected: no type errors related to hooks.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/hooks/useInventory.ts \
        apps/web/src/hooks/useShoppingList.ts
git commit -m "feat: update useInventory (category filter), add usePurchaseShoppingListItems + useBatchDeleteShoppingListItems"
```

---

## Task 7: InventoryPage — category tabs

**Files:**
- Modify: `apps/web/src/pages/InventoryPage/InventoryPage.tsx`

- [ ] **Step 1: Rewrite InventoryPage.tsx**

Replace the full file:

```tsx
import { useState, useEffect, useMemo } from 'react';
import { useInventory, useDeleteInventoryItem } from '../../hooks/useInventory';
import { ItemForm } from './ItemForm';
import { PageTitle } from '../../components/PageTitle';
import { FilterStrip } from '../../components/FilterStrip';
import type { InventoryRow, Category } from '@eat/shared';
import { CATEGORY_LABEL, CATEGORY_ORDER } from '@eat/taxonomy';
import './InventoryPage.css';

type CategoryFilter = 'all' | Category;

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
}

type Urgency = 'expired' | 'soon' | 'thisweek' | 'fresh' | 'none';
function urgencyOf(days: number | null): Urgency {
  if (days === null) return 'none';
  if (days < 0) return 'expired';
  if (days <= 3) return 'soon';
  if (days <= 7) return 'thisweek';
  return 'fresh';
}

function fmtQty(qty: number, unit: string): string {
  const n = qty % 1 === 0 ? qty.toString() : qty.toFixed(qty < 1 ? 2 : 1);
  return `${n} ${unit}`;
}

function ExpiryCell({ days }: { days: number | null }) {
  const u = urgencyOf(days);
  const label =
    days === null ? 'no exp'
    : days < 0    ? `${-days}d ago`
    : `${days}d`;
  return (
    <div className={`inv-row-expires inv-row-expires--${u}`}>
      <span className="inv-row-expires-dot" aria-hidden />
      <span className="inv-row-expires-label">{label}</span>
    </div>
  );
}

function UseThisWeek({ items }: { items: InventoryRow[] }) {
  const soon = items
    .map((i) => ({ ...i, d: daysUntil(i.expiresAt) }))
    .filter((i) => i.d !== null && i.d <= 3)
    .sort((a, b) => (a.d ?? 0) - (b.d ?? 0))
    .slice(0, 5);
  if (soon.length === 0) return null;
  return (
    <div className="inv-use-week">
      <div>
        <div className="inv-use-week-title">use this week</div>
        <div className="inv-use-week-meta">soonest to expire · {soon.length}</div>
      </div>
      {soon.map((it) => (
        <div key={it.id} className="inv-use-cell">
          <div className={`inv-use-cell-days${(it.d ?? 0) <= 1 ? ' inv-use-cell-days--urgent' : ''}`}>
            {it.d}<span style={{ fontSize: 13, marginLeft: 2 }}>d</span>
          </div>
          <div className="inv-use-cell-name">{it.foodName}</div>
          <div className="inv-use-cell-sub">{fmtQty(it.qty, it.unit)}</div>
        </div>
      ))}
    </div>
  );
}

function ItemRow({ item, onEdit, onDelete }: { item: InventoryRow; onEdit: () => void; onDelete: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const days = daysUntil(item.expiresAt);
  return (
    <div className="inv-row">
      <div className="inv-row-qty">{fmtQty(item.qty, item.unit)}</div>
      <div className="inv-row-item">
        <div className="inv-row-item-name">{item.foodName}</div>
        {item.brand && <div className="inv-row-item-brand">{item.brand}</div>}
      </div>
      <div className="inv-row-added">{(() => {
        const da = daysUntil(item.purchasedAt);
        if (da === null) return '—';
        if (da >= 0) return 'today';
        return `${-da}d ago`;
      })()}</div>
      <ExpiryCell days={days} />
      <div className="inv-row-actions">
        {confirming ? (
          <>
            <button className="inv-row-action inv-row-action--danger" onClick={() => { onDelete(); setConfirming(false); }}>confirm</button>
            <button className="inv-row-action" onClick={() => setConfirming(false)}>cancel</button>
          </>
        ) : (
          <>
            <button className="inv-row-action" onClick={onEdit}>edit</button>
            <button className="inv-row-action inv-row-action--danger" onClick={() => setConfirming(true)}>delete</button>
          </>
        )}
      </div>
    </div>
  );
}

function CategoryGroup({ label, items, onEdit, onDelete }: {
  label: string;
  items: InventoryRow[];
  onEdit: (it: InventoryRow) => void;
  onDelete: (it: InventoryRow) => void;
}) {
  if (items.length === 0) return null;
  return (
    <div className="inv-group">
      <div className="inv-group-header">
        <span className="inv-group-label">{label}</span>
        <span className="inv-group-count">{items.length} items</span>
      </div>
      {items.map((it) => (
        <ItemRow
          key={it.id}
          item={it}
          onEdit={() => onEdit(it)}
          onDelete={() => onDelete(it)}
        />
      ))}
    </div>
  );
}

export function InventoryPage() {
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [modal, setModal] = useState<{ mode: 'add' } | { mode: 'edit'; item: InventoryRow } | null>(null);

  const deleteMutation = useDeleteInventoryItem();

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data: items = [], isLoading, isError } = useInventory({
    category: categoryFilter === 'all' ? undefined : categoryFilter,
    q: debouncedSearch || undefined,
  });

  const sortedByCategory = useMemo(() => {
    const buckets = Object.fromEntries(CATEGORY_ORDER.map(c => [c, [] as InventoryRow[]])) as Record<Category, InventoryRow[]>;
    for (const it of items) buckets[it.category]?.push(it);
    for (const c of CATEGORY_ORDER) {
      buckets[c].sort((a, b) => {
        const da = daysUntil(a.expiresAt);
        const db = daysUntil(b.expiresAt);
        if (da === null && db === null) return 0;
        if (da === null) return 1;
        if (db === null) return -1;
        return da - db;
      });
    }
    return buckets;
  }, [items]);

  const expSoon = items.filter((i) => {
    const d = daysUntil(i.expiresAt);
    return d !== null && d <= 7;
  }).length;

  const now = new Date();
  const eyebrow = `THE KITCHEN · ${now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).toLowerCase()}`;

  const tabs = [
    { key: 'all', label: 'All', count: items.length },
    ...CATEGORY_ORDER.map((c) => ({
      key: c,
      label: CATEGORY_LABEL[c],
      count: sortedByCategory[c].length,
    })),
  ];

  const categoriesToRender: Category[] =
    categoryFilter === 'all' ? CATEGORY_ORDER : [categoryFilter];

  return (
    <div className="inventory-page">
      <PageTitle
        eyebrow={eyebrow}
        title="Inventory"
        summary={
          <>
            <strong>{items.length} items</strong> on hand
            {expSoon > 0 && (
              <>
                {' · '}
                <span style={{ color: 'var(--persim-deep)', fontWeight: 600 }}>
                  {expSoon} expiring this week
                </span>
              </>
            )}
          </>
        }
        actions={
          <button className="btn-primary" onClick={() => setModal({ mode: 'add' })}>
            <span style={{ fontSize: 16, lineHeight: 1 }}>+</span> add item
          </button>
        }
      />

      <UseThisWeek items={items} />

      <FilterStrip
        tabs={tabs}
        activeTab={categoryFilter}
        onTabChange={(k) => setCategoryFilter(k as CategoryFilter)}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search items, brands…"
        trailing={<><span>sort by</span><span style={{ fontWeight: 600 }}>expiry ↑</span></>}
      />

      {isLoading && <p className="inv-status">Loading…</p>}
      {isError && <p className="inv-status error">Failed to load. Check your connection.</p>}

      {!isLoading && !isError && items.length === 0 && (
        <p className="inv-status">
          {search ? 'No items match your search.' : 'No items yet — tap + add item to get started.'}
        </p>
      )}

      {!isLoading && items.length > 0 && (
        <>
          <div className="inv-col-header">
            <div>qty</div>
            <div>item</div>
            <div>added</div>
            <div>expires</div>
            <div></div>
          </div>
          {categoriesToRender.map((cat) => (
            <CategoryGroup
              key={cat}
              label={CATEGORY_LABEL[cat]}
              items={sortedByCategory[cat]}
              onEdit={(item) => setModal({ mode: 'edit', item })}
              onDelete={(item) => deleteMutation.mutate(item.id)}
            />
          ))}
        </>
      )}

      {modal && (
        <ItemForm
          mode={modal.mode}
          item={modal.mode === 'edit' ? modal.item : undefined}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
pnpm --filter @eat/web build 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/pages/InventoryPage/InventoryPage.tsx
git commit -m "feat: inventory page — category tabs replace location tabs"
```

---

## Task 8: ItemForm — remove location, add find-or-create

**Files:**
- Modify: `apps/web/src/pages/InventoryPage/ItemForm.tsx`

- [ ] **Step 1: Rewrite ItemForm.tsx**

Replace the full file:

```tsx
import React, { useState, useEffect, useRef } from 'react';
import { useFoodSearch } from '../../hooks/useFoodSearch';
import { useAddInventoryItem, useUpdateInventoryItem } from '../../hooks/useInventory';
import type { InventoryRow, CanonicalFood, Category } from '@eat/shared';
import { CATEGORY_LABEL, CATEGORY_ORDER } from '@eat/taxonomy';
import './ItemForm.css';

const CATEGORY_OPTIONS = CATEGORY_ORDER.map(c => ({ value: c, label: CATEGORY_LABEL[c] }));

interface FormState {
  canonicalFoodId: string;
  foodName: string;
  isNewFood: boolean;
  newFoodCategory: Category | '';
  qty: string;
  unit: string;
  brand: string;
  purchasedAt: string;
  expiresAt: string;
}

function toDateInput(iso: string | null | undefined): string {
  if (!iso) return '';
  return iso.slice(0, 10);
}

interface FoodComboboxProps {
  value: string;
  displayName: string;
  onChange: (food: CanonicalFood) => void;
  onNewFood: (name: string) => void;
}

function FoodCombobox({ value, displayName, onChange, onNewFood }: FoodComboboxProps) {
  const [input, setInput] = useState(displayName);
  const [open, setOpen] = useState(false);
  const { data: results = [] } = useFoodSearch(input);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => { setInput(displayName); }, [displayName]);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const trimmed = input.trim();

  return (
    <div className="food-combobox" ref={ref}>
      <label className="form-label">Food *</label>
      <input
        className="form-input"
        type="text"
        placeholder="Search foods (e.g. milk, flour…)"
        value={input}
        autoComplete="off"
        onChange={e => { setInput(e.target.value); setOpen(true); }}
        onFocus={() => { if (input.trim()) setOpen(true); }}
      />
      {open && (results.length > 0 || trimmed.length > 0) && (
        <ul className="food-dropdown" role="listbox">
          {results.map(food => (
            <li
              key={food.id}
              role="option"
              aria-selected={food.id === value}
              className={`food-option${food.id === value ? ' selected' : ''}`}
              onMouseDown={() => { onChange(food); setInput(food.name); setOpen(false); }}
            >
              <span>{food.name}</span>
              <span className="food-option-unit">{food.defaultUnit}</span>
            </li>
          ))}
          {trimmed.length > 0 && (
            <li
              role="option"
              className="food-option food-option--new"
              onMouseDown={() => { onNewFood(trimmed); setOpen(false); }}
            >
              <span>Add "{trimmed}" as new food</span>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

interface ItemFormProps {
  mode: 'add' | 'edit';
  item?: InventoryRow;
  onClose: () => void;
}

export function ItemForm({ mode, item, onClose }: ItemFormProps) {
  const [form, setForm] = useState<FormState>({
    canonicalFoodId: item?.canonicalFoodId ?? '',
    foodName: item?.foodName ?? '',
    isNewFood: false,
    newFoodCategory: '',
    qty: item != null ? String(item.qty) : '',
    unit: item?.unit ?? 'g',
    brand: item?.brand ?? '',
    purchasedAt: toDateInput(item?.purchasedAt),
    expiresAt: toDateInput(item?.expiresAt),
  });

  const [error, setError] = useState('');
  const addMutation = useAddInventoryItem();
  const updateMutation = useUpdateInventoryItem(item?.id ?? '');
  const isPending = addMutation.isPending || updateMutation.isPending;

  function set<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm(f => ({ ...f, [k]: v }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (mode === 'add' && !form.canonicalFoodId && !form.isNewFood) {
      setError('Please select a food or add a new one.');
      return;
    }
    if (form.isNewFood && !form.newFoodCategory) {
      setError('Please select a category for the new food.');
      return;
    }

    const qty = parseFloat(form.qty);
    if (isNaN(qty) || qty <= 0) { setError('Quantity must be a positive number.'); return; }

    try {
      if (mode === 'add') {
        const base = { qty, unit: form.unit, brand: form.brand.trim() || null, purchasedAt: form.purchasedAt || null, expiresAt: form.expiresAt || null };
        if (form.isNewFood) {
          await addMutation.mutateAsync({ foodName: form.foodName, category: form.newFoodCategory as Category, ...base });
        } else {
          await addMutation.mutateAsync({ canonicalFoodId: form.canonicalFoodId, ...base });
        }
      } else {
        await updateMutation.mutateAsync({
          qty, unit: form.unit,
          brand: form.brand.trim() || null,
          purchasedAt: form.purchasedAt || null,
          expiresAt: form.expiresAt || null,
        });
      }
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    }
  }

  return (
    <div
      className="modal-overlay"
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="modal-panel" role="dialog" aria-modal="true">
        <div className="modal-header">
          <h2>{mode === 'add' ? 'Add item' : 'Edit item'}</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <form className="item-form" onSubmit={handleSubmit} noValidate>
          {mode === 'add' ? (
            <>
              <FoodCombobox
                value={form.canonicalFoodId}
                displayName={form.foodName}
                onChange={food => setForm(f => ({
                  ...f,
                  canonicalFoodId: food.id,
                  foodName: food.name,
                  unit: food.defaultUnit,
                  isNewFood: false,
                  newFoodCategory: '',
                }))}
                onNewFood={name => setForm(f => ({
                  ...f,
                  canonicalFoodId: '',
                  foodName: name,
                  isNewFood: true,
                }))}
              />
              {form.isNewFood && (
                <div className="form-field">
                  <label className="form-label" htmlFor="newFoodCategory">Category *</label>
                  <select
                    id="newFoodCategory"
                    className="form-select"
                    value={form.newFoodCategory}
                    onChange={e => set('newFoodCategory', e.target.value as Category)}
                    required
                  >
                    <option value="">Select category…</option>
                    {CATEGORY_OPTIONS.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
              )}
            </>
          ) : (
            <div className="form-food-display">
              <span className="form-label">Food</span>
              <span className="form-food-name">{form.foodName}</span>
            </div>
          )}

          <div className="form-row">
            <div className="form-field">
              <label className="form-label" htmlFor="qty">Quantity *</label>
              <input
                id="qty"
                className="form-input"
                type="number"
                step="any"
                min="0"
                placeholder="e.g. 500"
                value={form.qty}
                onChange={e => set('qty', e.target.value)}
                required
              />
            </div>
            <div className="form-field">
              <label className="form-label" htmlFor="unit">Unit</label>
              <select
                id="unit"
                className="form-select"
                value={form.unit}
                onChange={e => set('unit', e.target.value)}
              >
                <option value="g">g</option>
                <option value="ml">ml</option>
                <option value="count">count</option>
              </select>
            </div>
          </div>

          <div className="form-field">
            <label className="form-label" htmlFor="brand">Brand</label>
            <input
              id="brand"
              className="form-input"
              type="text"
              placeholder="Optional"
              value={form.brand}
              onChange={e => set('brand', e.target.value)}
            />
          </div>

          <div className="form-row">
            <div className="form-field">
              <label className="form-label" htmlFor="purchasedAt">Purchased</label>
              <input
                id="purchasedAt"
                className="form-input"
                type="date"
                value={form.purchasedAt}
                onChange={e => set('purchasedAt', e.target.value)}
              />
            </div>
            <div className="form-field">
              <label className="form-label" htmlFor="expiresAt">Expires</label>
              <input
                id="expiresAt"
                className="form-input"
                type="date"
                value={form.expiresAt}
                onChange={e => set('expiresAt', e.target.value)}
              />
            </div>
          </div>

          {error && <p className="form-error" role="alert">{error}</p>}

          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={isPending}>
              {isPending ? 'Saving…' : mode === 'add' ? 'Add item' : 'Save changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

Add to `ItemForm.css` (append at end):
```css
.food-option--new {
  color: var(--persimmon, #e05a2b);
  font-style: italic;
}
```

- [ ] **Step 2: Verify build**

```bash
pnpm --filter @eat/web build 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/pages/InventoryPage/ItemForm.tsx \
        apps/web/src/pages/InventoryPage/ItemForm.css
git commit -m "feat: ItemForm — remove location, add find-or-create new food flow with category picker"
```

---

## Task 9: ShoppingListPage — new add form + selection + action bar

**Files:**
- Modify: `apps/web/src/pages/ShoppingListPage/ShoppingListPage.tsx`
- Modify: `apps/web/src/pages/ShoppingListPage/ShoppingListPage.css`
- Modify: `apps/web/src/pages/ShoppingListPage/ShoppingListPage.test.tsx`

- [ ] **Step 1: Update the test file first**

Replace `ShoppingListPage.test.tsx` with updated mocks for new hooks and new behaviour:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ShoppingListPage } from './ShoppingListPage';

const hooks = vi.hoisted(() => ({
  useCurrentShoppingList: vi.fn(),
  useGenerateShoppingList: vi.fn(),
  useUpdateShoppingListItem: vi.fn(),
  useAddShoppingListItem: vi.fn(),
  useDeleteShoppingListItem: vi.fn(),
  usePurchaseShoppingListItems: vi.fn(),
  useBatchDeleteShoppingListItems: vi.fn(),
  usePricesForList: vi.fn(),
  useRefreshPrices: vi.fn(),
}));

vi.mock('../../hooks/useShoppingList', () => ({
  useCurrentShoppingList: hooks.useCurrentShoppingList,
  useGenerateShoppingList: hooks.useGenerateShoppingList,
  useUpdateShoppingListItem: hooks.useUpdateShoppingListItem,
  useAddShoppingListItem: hooks.useAddShoppingListItem,
  useDeleteShoppingListItem: hooks.useDeleteShoppingListItem,
  usePurchaseShoppingListItems: hooks.usePurchaseShoppingListItems,
  useBatchDeleteShoppingListItems: hooks.useBatchDeleteShoppingListItems,
}));
vi.mock('../../hooks/usePricesForList', () => ({
  usePricesForList: hooks.usePricesForList,
  useRefreshPrices: hooks.useRefreshPrices,
}));
vi.mock('../../hooks/useFoodSearch', () => ({
  useFoodSearch: () => ({ data: [] }),
}));

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}><ShoppingListPage /></QueryClientProvider>);
}

const baseList = {
  id: 'list-1', householdId: 'h', generatedFromMealPlanId: null,
  createdAt: '2026-05-10T00:00:00Z', finalizedAt: null,
  items: [
    { id: 'i1', shoppingListId: 'list-1', canonicalFoodId: 'cf1', name: 'Eggs',  qty: 1, unit: 'count', source: 'recipe', checked: false, category: 'dairy',  sourceRecipeNames: ['Shakshuka'] },
    { id: 'i2', shoppingListId: 'list-1', canonicalFoodId: 'cf2', name: 'Bread', qty: 1, unit: 'count', source: 'staple', checked: false, category: 'pantry', sourceRecipeNames: null },
  ],
};

describe('ShoppingListPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hooks.useCurrentShoppingList.mockReturnValue({ data: baseList, isLoading: false });
    hooks.useGenerateShoppingList.mockReturnValue({ mutate: vi.fn(), isPending: false });
    hooks.useUpdateShoppingListItem.mockReturnValue({ mutate: vi.fn() });
    hooks.useAddShoppingListItem.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    hooks.useDeleteShoppingListItem.mockReturnValue({ mutate: vi.fn() });
    hooks.usePurchaseShoppingListItems.mockReturnValue({ mutate: vi.fn(), isPending: false });
    hooks.useBatchDeleteShoppingListItems.mockReturnValue({ mutate: vi.fn(), isPending: false });
    hooks.usePricesForList.mockReturnValue({ data: { prices: [], job: null } });
    hooks.useRefreshPrices.mockReturnValue({ mutate: vi.fn(), isPending: false });
  });

  it('shows recipe name on recipe-sourced items', () => {
    renderPage();
    expect(screen.getByText('Shakshuka')).toBeInTheDocument();
  });

  it('shows "from recipes" fallback when sourceRecipeNames is null', () => {
    const listWithNullRecipes = {
      ...baseList,
      items: [{ ...baseList.items[0], sourceRecipeNames: null }],
    };
    hooks.useCurrentShoppingList.mockReturnValue({ data: listWithNullRecipes, isLoading: false });
    renderPage();
    expect(screen.getByText('from recipes')).toBeInTheDocument();
  });

  it('renders the page title', () => {
    renderPage();
    expect(screen.getByText('The list')).toBeInTheDocument();
  });

  it('renders category section headings', () => {
    renderPage();
    expect(screen.getByText('Dairy & eggs')).toBeInTheDocument();
    expect(screen.getByText('Pantry & dry goods')).toBeInTheDocument();
  });

  it('action bar hidden when nothing selected', () => {
    renderPage();
    expect(screen.queryByText(/mark purchased/i)).not.toBeInTheDocument();
  });

  it('action bar appears when item checkbox is clicked', async () => {
    renderPage();
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]);
    await waitFor(() => expect(screen.getByText(/mark purchased/i)).toBeInTheDocument());
  });

  it('remove button in action bar calls batch-delete', async () => {
    const batchDelete = vi.fn();
    hooks.useBatchDeleteShoppingListItems.mockReturnValue({ mutate: batchDelete, isPending: false });
    renderPage();
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[1]); // Bread (staple — no recipe warning)
    await waitFor(() => screen.getByText(/remove/i));
    fireEvent.click(screen.getByText(/remove/i));
    await waitFor(() => expect(batchDelete).toHaveBeenCalledWith({ itemIds: ['i2'] }));
  });

  it('purchase button calls purchase mutation', async () => {
    const purchase = vi.fn();
    hooks.usePurchaseShoppingListItems.mockReturnValue({ mutate: purchase, isPending: false });
    renderPage();
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]);
    await waitFor(() => screen.getByText(/mark purchased/i));
    fireEvent.click(screen.getByText(/mark purchased/i));
    await waitFor(() => expect(purchase).toHaveBeenCalledWith({ itemIds: ['i1'] }));
  });

  it('renders matched price', () => {
    hooks.usePricesForList.mockReturnValue({
      data: {
        prices: [{ id: 'p1', shoppingListItemId: 'i1', store: 'new_world', sku: 'NW-001', name: 'Free Range Eggs', price: 7.49, inStock: true, matched: true, checkedAt: '2026-05-10T01:00:00Z' }],
        job: { id: 'j1', status: 'done', error: null },
      },
    });
    renderPage();
    const priceEls = screen.getAllByText('$7.49');
    expect(priceEls.length).toBeGreaterThanOrEqual(1);
    expect(priceEls.some((el) => el.classList.contains('sl-row-price'))).toBe(true);
  });

  it('refresh button enqueues a job', async () => {
    const refreshMutate = vi.fn();
    hooks.useRefreshPrices.mockReturnValue({ mutate: refreshMutate, isPending: false });
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /refresh prices/i }));
    await waitFor(() => expect(refreshMutate).toHaveBeenCalled());
  });

  it('send to store button is disabled', () => {
    renderPage();
    const sendBtn = screen.getByRole('button', { name: /send to/i });
    expect(sendBtn).toBeDisabled();
  });
});
```

- [ ] **Step 2: Run tests — confirm new tests fail**

```bash
pnpm --filter @eat/web test -- ShoppingListPage
```

Expected: the new selection/action bar tests fail (features not implemented yet).

- [ ] **Step 3: Rewrite ShoppingListPage.tsx**

Replace the full file:

```tsx
import { useState, useMemo, useRef, useEffect } from 'react';
import {
  useCurrentShoppingList, useGenerateShoppingList,
  useAddShoppingListItem,
  usePurchaseShoppingListItems, useBatchDeleteShoppingListItems,
} from '../../hooks/useShoppingList';
import { usePricesForList, useRefreshPrices } from '../../hooks/usePricesForList';
import { useFoodSearch } from '../../hooks/useFoodSearch';
import { StaplesModal } from './StaplesModal';
import { PageTitle } from '../../components/PageTitle';
import { FilterStrip } from '../../components/FilterStrip';
import { AgentStatusCard, type AgentState } from '../../components/AgentStatusCard';
import type {
  ShoppingList, ShoppingListItem, ShoppingListPrice, Category, ShoppingSource, CanonicalFood,
} from '@eat/shared';
import { CATEGORY_LABEL, CATEGORY_ORDER } from '@eat/taxonomy';
import { mondayOf, toIsoDate } from '../../lib/dateUtils';
import './ShoppingListPage.css';

type SourceTab = 'all' | ShoppingSource;

const SOURCE_TABS: { key: SourceTab; label: string }[] = [
  { key: 'all',    label: 'All' },
  { key: 'recipe', label: 'From recipes' },
  { key: 'staple', label: 'Staples' },
  { key: 'manual', label: 'You added' },
];

const STORE_LABEL: Record<string, { name: string; initials: string }> = {
  new_world:  { name: "New World",  initials: 'NW' },
  paknsave:   { name: "Pak'nSave",  initials: 'PS' },
  woolworths: { name: 'Woolworths', initials: 'WW' },
};

const CATEGORY_OPTIONS: { value: Category; label: string }[] = CATEGORY_ORDER.map(c => ({ value: c, label: CATEGORY_LABEL[c] }));

function ReasonChip({ source, sourceRecipeNames }: { source: ShoppingSource; sourceRecipeNames: string[] | null }) {
  const label =
    source === 'recipe'
      ? (sourceRecipeNames && sourceRecipeNames.length > 0 ? sourceRecipeNames.join(', ') : 'from recipes')
    : source === 'staple' ? 'low staple'
    : 'you added';
  return <span className={`sl-row-reason sl-row-reason--${source}`}>{label}</span>;
}

function PriceCell({ price, refreshing }: { price: ShoppingListPrice | undefined; refreshing: boolean }) {
  if (!price && refreshing) return <span className="sl-row-price sl-row-price--loading">…</span>;
  if (!price) return <span className="sl-row-price sl-row-price--missing">—</span>;
  if (!price.matched) return <span className="sl-row-price sl-row-price--missing">no match</span>;
  if (!price.inStock) return <span className="sl-row-price sl-row-price--missing">out of stock</span>;
  return <span className="sl-row-price">${price.price?.toFixed(2)}</span>;
}

function CategorySection({
  category, items, prices, refreshing, selectedIds, onToggle,
}: {
  category: Category;
  items: ShoppingListItem[];
  prices: Map<string, ShoppingListPrice>;
  refreshing: boolean;
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
}) {
  const subtotal = items.reduce((s, it) => {
    const p = prices.get(it.id);
    return p && p.matched && p.inStock && p.price ? s + p.price : s;
  }, 0);
  const selected = items.filter((i) => selectedIds.has(i.id)).length;

  return (
    <section className="sl-section">
      <div className="sl-section-header">
        <span className="sl-section-title">{CATEGORY_LABEL[category]}<span className="dot">.</span></span>
        <span className="sl-section-count">{items.length} {items.length === 1 ? 'item' : 'items'}{selected > 0 ? ` · ${selected} selected` : ''}</span>
        <span className="sl-section-subtotal">${subtotal.toFixed(2)}</span>
      </div>
      {items.map((it) => (
        <div key={it.id} className={`sl-row${selectedIds.has(it.id) ? ' sl-row--selected' : ''}`}>
          <input
            type="checkbox"
            className="sl-check"
            checked={selectedIds.has(it.id)}
            onChange={() => onToggle(it.id)}
            aria-label={`Select ${it.name}`}
          />
          <div className="sl-row-name">
            <span className="sl-row-label">{it.name}</span>
            <span className="sl-row-qty">{Math.ceil(it.qty * 10) / 10} {it.unit}</span>
          </div>
          <ReasonChip source={it.source} sourceRecipeNames={it.sourceRecipeNames ?? null} />
          <PriceCell price={prices.get(it.id)} refreshing={refreshing} />
        </div>
      ))}
    </section>
  );
}

interface AddItemFormState {
  canonicalFoodId: string | null;
  name: string;
  category: Category | '';
  qty: string;
  unit: string;
}

function AddItemForm({ listId }: { listId: string }) {
  const addItem = useAddShoppingListItem(listId);
  const [form, setForm] = useState<AddItemFormState>({
    canonicalFoodId: null, name: '', category: '', qty: '', unit: 'count',
  });
  const [open, setOpen] = useState(false);
  const { data: results = [] } = useFoodSearch(form.name);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const needsCategory = !form.canonicalFoodId && form.name.trim().length > 0;
  const canSubmit = form.name.trim() && parseFloat(form.qty) > 0 && (!needsCategory || form.category);

  async function submit() {
    if (!canSubmit) return;
    const qty = parseFloat(form.qty);
    await addItem.mutateAsync({
      name: form.name.trim(),
      qty,
      unit: form.unit,
      ...(form.canonicalFoodId ? { canonicalFoodId: form.canonicalFoodId } : { category: form.category as Category }),
    });
    setForm({ canonicalFoodId: null, name: '', category: '', qty: '', unit: 'count' });
  }

  function selectFood(food: CanonicalFood) {
    setForm(f => ({ ...f, canonicalFoodId: food.id, name: food.name, unit: food.defaultUnit, category: '' }));
    setOpen(false);
  }

  return (
    <div className="sl-add-form" ref={ref}>
      <div className="sl-add-search">
        <input
          placeholder="Item name…"
          value={form.name}
          autoComplete="off"
          onChange={e => { setForm(f => ({ ...f, name: e.target.value, canonicalFoodId: null })); setOpen(true); }}
          onFocus={() => { if (form.name.trim()) setOpen(true); }}
          onKeyDown={e => e.key === 'Enter' && submit()}
        />
        {open && results.length > 0 && (
          <ul className="food-dropdown" role="listbox">
            {results.map(food => (
              <li key={food.id} role="option" className="food-option" onMouseDown={() => selectFood(food)}>
                <span>{food.name}</span>
                <span className="food-option-unit">{food.defaultUnit}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <input
        type="number" min="0" step="any" placeholder="Qty"
        value={form.qty}
        onChange={e => setForm(f => ({ ...f, qty: e.target.value }))}
        onKeyDown={e => e.key === 'Enter' && submit()}
      />
      <select value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}>
        <option value="g">g</option>
        <option value="ml">ml</option>
        <option value="count">count</option>
      </select>
      {needsCategory && (
        <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value as Category }))}>
          <option value="">Category…</option>
          {CATEGORY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      )}
      <button type="button" onClick={submit} disabled={addItem.isPending || !canSubmit}>+ Add</button>
    </div>
  );
}

function SelectionActionBar({
  count, onPurchase, onRemove, onClear, isPending,
}: {
  count: number;
  onPurchase: () => void;
  onRemove: () => void;
  onClear: () => void;
  isPending: boolean;
}) {
  if (count === 0) return null;
  return (
    <div className="sl-action-bar">
      <button className="sl-action-bar-clear" onClick={onClear} aria-label="Deselect all">✕</button>
      <span className="sl-action-bar-count">{count} selected</span>
      <div className="sl-action-bar-actions">
        <button className="btn-outline" onClick={onRemove} disabled={isPending}>Remove ({count})</button>
        <button className="btn-primary" onClick={onPurchase} disabled={isPending}>
          {isPending ? 'Saving…' : `Mark purchased (${count})`}
        </button>
      </div>
    </div>
  );
}

function ListView({ list }: { list: ShoppingList }) {
  const purchase = usePurchaseShoppingListItems(list.id);
  const batchDelete = useBatchDeleteShoppingListItems(list.id);
  const { data: pricesData } = usePricesForList(list.id);
  const refresh = useRefreshPrices(list.id);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);

  const prices = useMemo(() => {
    const m = new Map<string, ShoppingListPrice>();
    for (const p of pricesData?.prices ?? []) m.set(p.shoppingListItemId, p);
    return m;
  }, [pricesData]);

  const job = pricesData?.job;
  const refreshing = job?.status === 'pending' || job?.status === 'in_progress' || refresh.isPending;
  const isPending = purchase.isPending || batchDelete.isPending;

  const [tab, setTab] = useState<SourceTab>('all');

  const tabs = [
    ...SOURCE_TABS.map((t) => ({
      key: t.key,
      label: t.label,
      count: t.key === 'all' ? list.items.length : list.items.filter((i) => i.source === t.key).length,
    })),
  ];

  const visible = tab === 'all' ? list.items : list.items.filter((i) => i.source === tab);

  const byCategory = useMemo(() => {
    const m = new Map<Category, ShoppingListItem[]>();
    for (const it of visible) {
      const arr = m.get(it.category) ?? [];
      arr.push(it);
      m.set(it.category, arr);
    }
    return m;
  }, [visible]);

  const allItems = CATEGORY_ORDER.map((c) => byCategory.get(c) ?? []).flat();
  const subtotal = allItems.reduce((s, it) => {
    const p = prices.get(it.id);
    return p && p.matched && p.inStock && p.price ? s + p.price : s;
  }, 0);
  const pricedCount = allItems.filter((it) => {
    const p = prices.get(it.id);
    return p && p.matched && p.inStock && p.price !== null;
  }).length;
  const unmatched = allItems.length - pricedCount;

  const storeKey = pricesData?.prices?.[0]?.store ?? null;
  const storeLabel = storeKey ? STORE_LABEL[storeKey] : null;

  const agentState: AgentState =
    job?.status === 'pending' || job?.status === 'in_progress' ? 'running'
    : job?.status === 'failed' ? 'failed'
    : 'idle';
  const agentMessage =
    agentState === 'running' ? `Checking prices${storeLabel ? ' at ' + storeLabel.name : ''}.`
    : agentState === 'failed' ? 'Last price check failed. Run refresh to try again.'
    : `I'll log in, drop everything into your cart, choose the window, and stop before checkout for your okay.`;

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function handlePurchase() {
    purchase.mutate({ itemIds: [...selectedIds] });
    setSelectedIds(new Set());
  }

  function handleRemoveRequest() {
    const selectedItems = list.items.filter(i => selectedIds.has(i.id));
    const hasRecipeItem = selectedItems.some(i => i.source === 'recipe');
    if (hasRecipeItem) {
      setShowRemoveConfirm(true);
    } else {
      doRemove();
    }
  }

  function doRemove() {
    batchDelete.mutate({ itemIds: [...selectedIds] });
    setSelectedIds(new Set());
    setShowRemoveConfirm(false);
  }

  return (
    <div className="sl-body">
      <div className="sl-list-pane">
        <FilterStrip
          tabs={tabs}
          activeTab={tab}
          onTabChange={(k) => setTab(k as SourceTab)}
          searchValue=""
          onSearchChange={() => {}}
          searchPlaceholder="Search items…"
          trailing={<><span>group by</span><span style={{ fontWeight: 600 }}>category</span></>}
        />

        {CATEGORY_ORDER.map((c) => {
          const items = byCategory.get(c);
          if (!items || items.length === 0) return null;
          return (
            <CategorySection
              key={c}
              category={c}
              items={items}
              prices={prices}
              refreshing={refreshing}
              selectedIds={selectedIds}
              onToggle={toggleSelect}
            />
          );
        })}

        <section className="sl-section">
          <div className="sl-section-header">
            <span className="sl-section-title">Add item<span className="dot">.</span></span>
          </div>
          <AddItemForm listId={list.id} />
        </section>
      </div>

      <aside className="sl-sidebar">
        <div>
          <div className="sl-eyebrow">Send to</div>
          <div className="sl-store">
            <div className="sl-store-tile">{storeLabel?.initials ?? '—'}</div>
            <div style={{ flex: 1 }}>
              <div className="sl-store-name">{storeLabel?.name ?? 'No store connected'}</div>
              <div className="sl-store-sub">{storeLabel ? 'connected · price checks active' : 'set one up in settings'}</div>
            </div>
            <span className="sl-store-change" title="Coming soon — Slice 3">change</span>
          </div>
        </div>

        <div>
          <div className="sl-eyebrow">Totals</div>
          <div className="sl-totals">
            <div className="sl-totals-line">
              <span>items</span>
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>{list.items.length}</span>
            </div>
            <div className="sl-totals-grand">
              <span className="sl-totals-label">est. total</span>
              <span className="sl-totals-value">${subtotal.toFixed(2)}</span>
            </div>
            <div className="sl-totals-sub">{pricedCount} priced · {unmatched} without a match</div>
          </div>
        </div>

        <button className="sl-send" disabled title="Coming soon · phase 4">
          <span>send to {storeLabel?.name ?? 'store'}</span>
          <span style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 18 }}>→</span>
        </button>

        <AgentStatusCard state={agentState} message={agentMessage} />
        <button
          className="btn-outline"
          onClick={() => refresh.mutate()}
          disabled={refreshing}
          aria-label="Refresh prices"
          style={{ marginTop: -8 }}
        >
          {refreshing ? 'Checking prices…' : 'Refresh prices'}
        </button>
      </aside>

      <SelectionActionBar
        count={selectedIds.size}
        onPurchase={handlePurchase}
        onRemove={handleRemoveRequest}
        onClear={() => setSelectedIds(new Set())}
        isPending={isPending}
      />

      {showRemoveConfirm && (
        <div className="sl-confirm-overlay">
          <div className="sl-confirm-dialog">
            <p>Some selected items are needed for recipes. Remove anyway?</p>
            <div className="sl-confirm-actions">
              <button className="btn-outline" onClick={() => setShowRemoveConfirm(false)}>Cancel</button>
              <button className="btn-primary" onClick={doRemove}>Remove</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function ShoppingListPage() {
  const { data: list, isLoading } = useCurrentShoppingList();
  const generate = useGenerateShoppingList();
  const [showStaples, setShowStaples] = useState(false);

  const thisWeekStart = toIsoDate(mondayOf(new Date()));

  const now = new Date();
  const builtAt = `AUTO-BUILT · LAST UPDATED ${now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).toLowerCase()}`;

  return (
    <div className="shopping-list-page">
      <PageTitle
        eyebrow={builtAt}
        title="The list"
        summary={
          list ? (
            <>
              <strong>{list.items.length} items</strong> · for{' '}
              <span style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 16 }}>this week's plan</span>
            </>
          ) : (
            <span style={{ color: 'var(--mute)' }}>No list yet — generate one for this week to begin.</span>
          )
        }
        actions={
          <>
            <button className="btn-outline" onClick={() => setShowStaples(true)}>staples</button>
            <button
              className="btn-primary"
              onClick={() => generate.mutate({ weekStart: thisWeekStart })}
              disabled={generate.isPending}
            >
              {generate.isPending ? 'Generating…' : 'Generate for this week'}
            </button>
          </>
        }
      />

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

- [ ] **Step 4: Add CSS for action bar, selection state, and updated add form**

Append to `ShoppingListPage.css`:

```css
/* ── Selection ────────────────────────────────────────────────────────────── */
.sl-row--selected { background: color-mix(in srgb, var(--persimmon) 8%, transparent); }
.sl-check { width: 18px; height: 18px; accent-color: var(--persimmon); cursor: pointer; }

/* ── Action bar ───────────────────────────────────────────────────────────── */
.sl-action-bar {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--ink);
  color: var(--paper);
  border-radius: 12px;
  padding: 12px 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.4);
  z-index: 100;
  min-width: 340px;
}
.sl-action-bar-clear {
  background: transparent;
  border: none;
  color: var(--paper);
  cursor: pointer;
  font-size: 16px;
  opacity: 0.6;
  padding: 0 4px;
}
.sl-action-bar-clear:hover { opacity: 1; }
.sl-action-bar-count { font-size: 13px; opacity: 0.7; flex: 1; }
.sl-action-bar-actions { display: flex; gap: 8px; }
.sl-action-bar .btn-outline {
  border-color: rgba(255,255,255,0.3);
  color: var(--paper);
}
.sl-action-bar .btn-outline:hover { border-color: var(--paper); }

/* ── Remove confirm dialog ────────────────────────────────────────────────── */
.sl-confirm-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
}
.sl-confirm-dialog {
  background: var(--paper);
  border-radius: 12px;
  padding: 24px;
  max-width: 360px;
  width: 90%;
}
.sl-confirm-dialog p { margin: 0 0 20px; line-height: 1.5; }
.sl-confirm-actions { display: flex; gap: 10px; justify-content: flex-end; }

/* ── Add form updated (search combobox) ──────────────────────────────────── */
.sl-add-search { position: relative; flex: 1; }
.sl-add-search input { width: 100%; box-sizing: border-box; }
.sl-add-search .food-dropdown { min-width: 200px; }

/* ── Row grid (remove ✕ column) ──────────────────────────────────────────── */
.sl-row { grid-template-columns: 24px 1fr 90px 80px; }
```

Also replace the row grid definition near the top of `ShoppingListPage.css` — find:
```css
.sl-row {
  display: grid;
  grid-template-columns: 18px 1fr 90px 80px 24px;
```
and change to:
```css
.sl-row {
  display: grid;
  grid-template-columns: 24px 1fr 90px 80px;
```

And replace `.sl-row--checked { opacity: 0.55; }` with `.sl-row--selected { background: color-mix(in srgb, var(--persimmon) 8%, transparent); }` (the appended CSS above already does this, so just delete the old rule).

Also update the `.sl-add-form` grid to accommodate the dynamic category select. Replace:
```css
.sl-add-form {
  background: var(--paper);
  border: 1px solid var(--rule);
  border-radius: 10px;
  padding: 12px 14px;
  display: grid;
  grid-template-columns: 1fr 80px 80px 100px;
  gap: 8px;
  align-items: center;
}
```
with:
```css
.sl-add-form {
  background: var(--paper);
  border: 1px solid var(--rule);
  border-radius: 10px;
  padding: 12px 14px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}
.sl-add-form input[type="number"] { width: 80px; }
.sl-add-form select { width: 80px; }
.sl-add-form button { white-space: nowrap; }
```

- [ ] **Step 5: Run tests**

```bash
pnpm --filter @eat/web test -- ShoppingListPage
```

Expected: all tests pass.

- [ ] **Step 6: Run the full test suite**

```bash
pnpm test
```

Expected: all tests pass across the monorepo.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/pages/ShoppingListPage/ShoppingListPage.tsx \
        apps/web/src/pages/ShoppingListPage/ShoppingListPage.css \
        apps/web/src/pages/ShoppingListPage/ShoppingListPage.test.tsx
git commit -m "feat: shopping list multi-select action bar — purchase saves to inventory, remove with recipe warning"
```

---

## Task 10: IDEAS.md + PLAN.md

**Files:**
- Modify: `IDEAS.md`
- Modify: `PLAN.md`

- [ ] **Step 1: Add ideas to IDEAS.md**

Add a new section to `IDEAS.md` after the first `---`:

```markdown
## Shopping list — deferred ideas

### "While shopping" tick-off mode
A mode for tracking progress through a physical shop. Checking an item records it as "in cart" without saving to inventory. At the end of the shop, a "Done shopping" action saves all ticked items to inventory at once. Differs from the current "Mark purchased" (which is post-shop). Useful for confirming what was actually purchased vs what was on the list.

### Recipe chip navigation
`shopping_list_items.source_recipe_names` stores recipe names but not IDs. Tapping a recipe name chip currently shows the name as a display label only. To navigate to the recipe detail, add a `source_recipe_ids text[]` column to `shopping_list_items` and populate it during shopping list generation. Then chips can link to `/recipes/:id`.

---
```

- [ ] **Step 2: Update PLAN.md**

Add to the Done section (top of the Done log):

```markdown
- 2026-05-15 — Shopping list purchase & remove: multi-select action bar, Mark purchased saves to inventory, Remove with recipe warning, find-or-create canonical food in both shopping list and inventory add forms, dropped inventory location in favour of category grouping.
```

- [ ] **Step 3: Commit**

```bash
git add IDEAS.md PLAN.md
git commit -m "docs: add while-shopping and recipe-chip ideas; update PLAN.md"
```

---

## Self-review

**Spec coverage check:**

| Spec requirement | Task |
|---|---|
| Drop `location` from `inventory_items` | Task 1 |
| Remove `inventoryLocationEnum` | Task 1 |
| Find-or-create canonical food | Task 3 |
| Inventory routes — category filter, no location | Task 4 |
| Shopping list add — find-or-create, require category for free text | Task 5 |
| Purchase endpoint (batch insert inventory + delete list items) | Task 5 |
| Batch-delete endpoint | Task 5 |
| Update shared types | Task 2 |
| `useInventory` — category param | Task 6 |
| `usePurchaseShoppingListItems` + `useBatchDeleteShoppingListItems` | Task 6 |
| Inventory page — category tabs | Task 7 |
| ItemForm — remove location, add new food with category | Task 8 |
| Shopping list add form — food search combobox + conditional category | Task 9 |
| Shopping list item rows — checkbox area selects, no ✕ button | Task 9 |
| Sticky action bar — purchase + remove + deselect | Task 9 |
| Recipe-sourced remove confirmation | Task 9 |
| IDEAS.md — while shopping mode + recipe chip navigation | Task 10 |

All spec requirements covered. ✓
