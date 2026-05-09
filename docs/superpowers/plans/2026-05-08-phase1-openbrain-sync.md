# Phase 1: OpenBrain Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the OpenBrain sync adapter end-to-end: mutations set dirty flags in the DB; a Mac-mini worker polls the server for pending sync work, calls the `@eat/openbrain` adapter functions (which call the real MCP client), and clears the dirty flags. Recipes sync live on save. Inventory and meal plans sync debounced (~5 min). Cook events roll up daily.

**Architecture:** Three pieces:
1. **Server-side dirty flags** — every inventory/meal-plan mutation upserts a row in `sync_dirty`. Cook events already set an `inventoryDirty` flag via the cook-events route from the Cook Events plan.
2. **Server sync endpoints** — authenticated (HMAC-signed) endpoints the Mac mini worker polls: `GET /api/sync/pending`, `POST /api/sync/claim/:id`, `POST /api/sync/complete/:id`, plus snapshot read endpoints for each resource type.
3. **Mac mini worker** (`apps/server/src/workers/openbrain-worker.ts`) — Node script that polls the server, fetches snapshots, calls `@eat/openbrain` adapter functions, marks jobs complete. Runs under `launchd` on the Mac mini; polls on a 60-second interval.

**Dependency:** The Cook Events plan (cook-events route) already sets the `sync_dirty` flag for inventory on cook. This plan adds dirty flags to the other write paths and wires the full pipeline.

**Tech Stack:** Node.js + `node-fetch` (worker); HMAC-SHA256 request signing (already in `apps/scraper` worker SDK — reuse); `@modelcontextprotocol/sdk` (OpenBrain MCP client); existing Drizzle + Express.

---

## File Map

**New files:**
- `apps/server/src/routes/sync.ts` — sync endpoints (pending jobs, claim, complete, snapshots)
- `apps/server/src/routes/sync.test.ts` — HMAC auth + validation tests
- `apps/server/src/workers/openbrain-worker.ts` — Mac mini polling worker
- `packages/openbrain/src/client.ts` — real MCP client wrapper (replaces stub)

**Modified files:**
- `packages/shared/src/index.ts` — no changes needed (sync types are internal)
- `apps/server/src/app.ts` — wire sync router
- `apps/server/src/routes/inventory.ts` — set `sync_dirty` on POST/PUT/DELETE
- `apps/server/src/routes/meal-plans.ts` — set `sync_dirty` on POST/PUT/DELETE entries
- `apps/server/src/routes/recipes.ts` — call `syncRecipe()` immediately after save
- `packages/openbrain/src/sync.ts` — replace stubs with real MCP calls via `client.ts`
- `apps/server/.env` / `apps/server/.env.example` — add `WORKER_HMAC_KEY` and `OPENBRAIN_BASE_URL`

---

## Task 1: Dirty flag writes on inventory mutations

The Cook Events plan already writes a `sync_dirty` row when a cook event deducts inventory. This task adds the same to the direct inventory CRUD routes.

**Files:**
- Modify: `apps/server/src/routes/inventory.ts`

- [ ] **Step 1: Add dirty flag helper**

At the top of `apps/server/src/routes/inventory.ts`, `sql` and `uuidv4` are already imported. Add a helper function after the imports:

```typescript
async function markInventoryDirty(householdId: string) {
  await db.execute(
    sql`INSERT INTO sync_dirty (id, household_id, resource_type, resource_id, dirty_since)
        VALUES (${uuidv4()}, ${householdId}, 'inventory', ${householdId}, now())
        ON CONFLICT (household_id, resource_type, resource_id)
        DO UPDATE SET dirty_since = now(), claimed_at = null`,
  );
}
```

- [ ] **Step 2: Call markInventoryDirty after each write**

In the `POST /` handler, after the `res.status(201).json(full)` line (but before the catch), call:

```typescript
await markInventoryDirty(req.householdId);
```

Wrap this in its own try/catch so a sync failure doesn't roll back the inventory write:

```typescript
markInventoryDirty(req.householdId).catch(err => console.error('sync_dirty write failed', err));
```

Do the same after the `res.json(full)` in `PUT /:id` and after `res.json({ id })` in `DELETE /:id`.

- [ ] **Step 3: Run inventory tests**

```bash
pnpm --filter @eat/server test -- --reporter=verbose inventory.test.ts
```

Expected: All pass. (The mock DB doesn't exercise the dirty flag insert, but no test should break.)

- [ ] **Step 4: Commit**

```bash
git add apps/server/src/routes/inventory.ts
git commit -m "feat(server): set sync_dirty flag on inventory mutations"
```

---

## Task 2: Dirty flag writes on meal plan mutations

**Files:**
- Modify: `apps/server/src/routes/meal-plans.ts`

- [ ] **Step 1: Import syncDirty and add helper**

At the top of `apps/server/src/routes/meal-plans.ts`, import:

```typescript
import { syncDirty } from '../db/schema/index.js';
```

Add after the imports:

```typescript
async function markMealPlanDirty(householdId: string, mealPlanId: string) {
  await db.execute(
    sql`INSERT INTO sync_dirty (id, household_id, resource_type, resource_id, dirty_since)
        VALUES (${uuidv4()}, ${householdId}, 'meal_plan', ${mealPlanId}, now())
        ON CONFLICT (household_id, resource_type, resource_id)
        DO UPDATE SET dirty_since = now(), claimed_at = null`,
  );
}
```

- [ ] **Step 2: Call markMealPlanDirty after each write**

In `POST /entries`, after `res.status(201).json(...)`:

```typescript
markMealPlanDirty(req.householdId, planId).catch(err => console.error('sync_dirty write failed', err));
```

In `PUT /entries/:id`, after `res.json(full)`, get the mealPlanId from the updated entry and call:

```typescript
markMealPlanDirty(req.householdId, full.mealPlanId).catch(err => console.error('sync_dirty write failed', err));
```

In `DELETE /entries/:id`, first fetch `mealPlanId` from the existing row before deleting, then call dirty after delete:

```typescript
// (existing.mealPlanId is already fetched in the ownership check — add it to the select)
markMealPlanDirty(req.householdId, existing.mealPlanId).catch(err => console.error('sync_dirty write failed', err));
```

Update the `select` in DELETE to also fetch `mealPlanId`:
```typescript
const [existing] = await db
  .select({ householdId: mealPlanEntries.householdId, mealPlanId: mealPlanEntries.mealPlanId })
  .from(mealPlanEntries)
  .where(eq(mealPlanEntries.id, id))
  .limit(1);
```

- [ ] **Step 3: Run meal-plans tests**

```bash
pnpm --filter @eat/server test -- --reporter=verbose meal-plans.test.ts
```

Expected: All pass.

- [ ] **Step 4: Commit**

```bash
git add apps/server/src/routes/meal-plans.ts
git commit -m "feat(server): set sync_dirty flag on meal plan mutations"
```

---

## Task 3: Live recipe sync on save

Recipes sync to OpenBrain immediately on save (no debounce — see D11/D13).

**Files:**
- Modify: `apps/server/src/routes/recipes.ts`

- [ ] **Step 1: Import syncRecipe and call it after POST and PUT**

In `apps/server/src/routes/recipes.ts`, add import:

```typescript
import { syncRecipe } from '@eat/openbrain';
```

After the successful `res.status(201).json(full)` in `POST /`, call (fire-and-forget, don't block response):

```typescript
syncRecipe({ id: full.id, name: full.name, servings: full.servings, ingredients: full.ingredients, sourceUrl: full.sourceUrl, instructions: full.instructions })
  .catch(err => console.error('OpenBrain recipe sync failed', err));
```

Do the same after `res.json(full)` in `PUT /:id`.

Note: `syncRecipe` is currently a stub returning `{ ok: true }`. It will be wired to the real MCP in Task 5.

- [ ] **Step 2: Run recipes tests**

```bash
pnpm --filter @eat/server test -- --reporter=verbose recipes.test.ts
```

Expected: All pass (syncRecipe is mocked or stubbed in the test environment).

- [ ] **Step 3: Commit**

```bash
git add apps/server/src/routes/recipes.ts
git commit -m "feat(server): call syncRecipe on recipe save/update"
```

---

## Task 4: Sync job endpoints

The Mac mini worker authenticates via HMAC-SHA256. The server verifies the signature on all `/api/sync` routes. The HMAC key is shared between the server (`WORKER_HMAC_KEY` env var) and the Mac mini.

**Files:**
- Create: `apps/server/src/routes/sync.ts`
- Create: `apps/server/src/routes/sync.test.ts`

- [ ] **Step 1: Write failing tests**

Create `apps/server/src/routes/sync.test.ts`:

```typescript
import { vi, describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import crypto from 'node:crypto';

vi.mock('drizzle-orm', () => ({
  and: (...args: unknown[]) => args,
  eq: () => null,
  lt: () => null,
  isNull: () => null,
  sql: Object.assign(() => null, { template: () => null }),
}));

vi.mock('../db/index.js', () => ({
  db: { select: () => ({ from: () => ({ where: () => ({ orderBy: () => ({ limit: vi.fn().mockResolvedValue([]) }) }) }) }) },
}));

vi.mock('../db/schema/index.js', () => ({
  syncDirty: {}, mealPlans: {}, inventoryItems: {}, canonicalFoods: {},
  recipes: {}, recipeIngredients: {}, mealPlanEntries: {},
}));

process.env.WORKER_HMAC_KEY = 'test-secret-key';
const { default: syncRouter } = await import('./sync');

function signedRequest(app: express.Express, method: string, path: string) {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const body = '';
  const sig = crypto.createHmac('sha256', 'test-secret-key').update(`${method}\n${path}\n${timestamp}\n${body}`).digest('hex');
  const req = request(app)[method.toLowerCase() as 'get'](path);
  return req.set('X-Worker-Timestamp', timestamp).set('X-Worker-Signature', sig);
}

describe('sync router', () => {
  let app: express.Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/sync', syncRouter);
  });

  it('GET /pending returns 401 without HMAC', async () => {
    const res = await request(app).get('/api/sync/pending');
    expect(res.status).toBe(401);
  });

  it('GET /pending returns 200 with valid HMAC', async () => {
    const res = await signedRequest(app, 'GET', '/api/sync/pending');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('jobs');
  });

  it('rejects requests with stale timestamp (> 5 min old)', async () => {
    const oldTimestamp = String(Math.floor(Date.now() / 1000) - 400);
    const sig = crypto.createHmac('sha256', 'test-secret-key').update(`GET\n/api/sync/pending\n${oldTimestamp}\n`).digest('hex');
    const res = await request(app)
      .get('/api/sync/pending')
      .set('X-Worker-Timestamp', oldTimestamp)
      .set('X-Worker-Signature', sig);
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
pnpm --filter @eat/server test -- --reporter=verbose sync.test.ts
```

Expected: `Cannot find module './sync'`

- [ ] **Step 3: Implement sync router**

Create `apps/server/src/routes/sync.ts`:

```typescript
import { Router, type Router as ExpressRouter, type Request, type Response, type NextFunction } from 'express';
import { and, eq, lt, isNull, sql } from 'drizzle-orm';
import crypto from 'node:crypto';
import { db } from '../db/index.js';
import {
  syncDirty, mealPlans, inventoryItems, canonicalFoods,
  recipes, recipeIngredients, mealPlanEntries,
} from '../db/schema/index.js';

const router: ExpressRouter = Router();

// HMAC middleware — shared secret between server and Mac mini worker
function withWorkerAuth(req: Request, res: Response, next: NextFunction) {
  const key = process.env.WORKER_HMAC_KEY;
  if (!key) { res.status(500).json({ error: 'WORKER_HMAC_KEY not configured' }); return; }

  const timestamp = req.headers['x-worker-timestamp'] as string;
  const signature = req.headers['x-worker-signature'] as string;
  if (!timestamp || !signature) { res.status(401).json({ error: 'Missing HMAC headers' }); return; }

  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parseInt(timestamp, 10)) > 300) {
    res.status(401).json({ error: 'Timestamp too old' });
    return;
  }

  const body = req.body ? JSON.stringify(req.body) : '';
  const expected = crypto.createHmac('sha256', key).update(`${req.method}\n${req.path}\n${timestamp}\n${body}`).digest('hex');
  const valid = crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'));
  if (!valid) { res.status(401).json({ error: 'Invalid signature' }); return; }

  next();
}

// GET /api/sync/pending
// Returns unclaimed dirty resources whose dirty_since is ≥ 5 minutes ago.
router.get('/pending', withWorkerAuth, async (_req, res) => {
  const debounceMs = parseInt(process.env.SYNC_DEBOUNCE_MS ?? '300000', 10);
  const cutoff = new Date(Date.now() - debounceMs);

  try {
    const jobs = await db
      .select({
        id: syncDirty.id,
        householdId: syncDirty.householdId,
        resourceType: syncDirty.resourceType,
        resourceId: syncDirty.resourceId,
        dirtySince: syncDirty.dirtySince,
      })
      .from(syncDirty)
      .where(and(isNull(syncDirty.claimedAt), lt(syncDirty.dirtySince, cutoff)));

    res.json({ jobs });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/sync/claim/:id — worker claims a job to prevent double-processing
router.post('/claim/:id', withWorkerAuth, async (req, res) => {
  const id = req.params['id'] as string;
  try {
    await db
      .update(syncDirty)
      .set({ claimedAt: new Date() })
      .where(and(eq(syncDirty.id, id), isNull(syncDirty.claimedAt)));
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/sync/complete/:id — worker marks a job done and deletes the row
router.post('/complete/:id', withWorkerAuth, async (req, res) => {
  const id = req.params['id'] as string;
  try {
    await db.delete(syncDirty).where(eq(syncDirty.id, id));
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/sync/snapshot/inventory?householdId=X — full inventory snapshot for OpenBrain
router.get('/snapshot/inventory', withWorkerAuth, async (req, res) => {
  const { householdId } = req.query as { householdId?: string };
  if (!householdId) { res.status(400).json({ error: 'householdId required' }); return; }

  try {
    const items = await db
      .select({
        id: inventoryItems.id,
        foodName: canonicalFoods.name,
        qty: inventoryItems.qty,
        unit: inventoryItems.unit,
        brand: inventoryItems.brand,
        location: inventoryItems.location,
        expiresAt: inventoryItems.expiresAt,
      })
      .from(inventoryItems)
      .innerJoin(canonicalFoods, sql`${inventoryItems.canonicalFoodId} = ${canonicalFoods.id}`)
      .where(eq(inventoryItems.householdId, householdId));

    res.json({ householdId, items, snapshotAt: new Date().toISOString() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/sync/snapshot/meal-plan?householdId=X&mealPlanId=Y — full meal plan snapshot
router.get('/snapshot/meal-plan', withWorkerAuth, async (req, res) => {
  const { householdId, mealPlanId } = req.query as { householdId?: string; mealPlanId?: string };
  if (!householdId || !mealPlanId) { res.status(400).json({ error: 'householdId and mealPlanId required' }); return; }

  try {
    const [plan] = await db
      .select({ id: mealPlans.id, weekStart: mealPlans.weekStart, householdId: mealPlans.householdId })
      .from(mealPlans)
      .where(and(eq(mealPlans.id, mealPlanId), eq(mealPlans.householdId, householdId)))
      .limit(1);

    if (!plan) { res.status(404).json({ error: 'Meal plan not found' }); return; }

    const entries = await db
      .select({
        id: mealPlanEntries.id,
        date: mealPlanEntries.date,
        recipeName: recipes.name,
        servings: mealPlanEntries.servings,
        status: mealPlanEntries.status,
      })
      .from(mealPlanEntries)
      .innerJoin(recipes, sql`${mealPlanEntries.recipeId} = ${recipes.id}`)
      .where(eq(mealPlanEntries.mealPlanId, mealPlanId));

    res.json({ ...plan, entries, snapshotAt: new Date().toISOString() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
pnpm --filter @eat/server test -- --reporter=verbose sync.test.ts
```

Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/routes/sync.ts apps/server/src/routes/sync.test.ts
git commit -m "feat(server): add HMAC-authenticated sync job endpoints"
```

---

## Task 5: Wire sync router + add env vars

**Files:**
- Modify: `apps/server/src/app.ts`
- Modify: `apps/server/.env.example` (document new vars)

- [ ] **Step 1: Wire router**

In `apps/server/src/app.ts`, add:

```typescript
import syncRouter from './routes/sync.js';
```

And:

```typescript
app.use('/api/sync', syncRouter);
```

- [ ] **Step 2: Document env vars in .env.example**

Add to `apps/server/.env.example`:

```
# HMAC key shared between server and Mac mini workers (any random 32+ char string)
WORKER_HMAC_KEY=

# Debounce window for inventory/meal-plan sync (ms). Default: 300000 (5 min)
SYNC_DEBOUNCE_MS=300000
```

- [ ] **Step 3: Run full server test suite**

```bash
pnpm --filter @eat/server test
```

Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add apps/server/src/app.ts apps/server/.env.example
git commit -m "feat(server): wire sync router and document WORKER_HMAC_KEY env var"
```

---

## Task 6: OpenBrain MCP client

The `packages/openbrain/src/sync.ts` functions are stubs. This task replaces them with real calls via a new `client.ts` file that wraps the MCP client.

**Prerequisite:** The MCP server URL and any required auth tokens must be available. Add `OPENBRAIN_BASE_URL` and `OPENBRAIN_API_KEY` to the Mac mini's environment (not the Vercel server — the worker runs locally).

**Files:**
- Create: `packages/openbrain/src/client.ts`
- Modify: `packages/openbrain/src/sync.ts`

- [ ] **Step 1: Install MCP client SDK**

```bash
pnpm --filter @eat/openbrain add @modelcontextprotocol/sdk
```

- [ ] **Step 2: Implement client.ts**

Create `packages/openbrain/src/client.ts`:

```typescript
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

let _client: Client | null = null;

export async function getOpenBrainClient(): Promise<Client> {
  if (_client) return _client;

  const baseUrl = process.env.OPENBRAIN_BASE_URL;
  if (!baseUrl) throw new Error('OPENBRAIN_BASE_URL is not set');

  // OpenBrain exposes an MCP server. Transport depends on how it's run:
  // If running as a local stdio process, use StdioClientTransport.
  // If running as an SSE/HTTP server, use SSEClientTransport.
  // Adjust the transport below to match your OpenBrain setup.
  const transport = new StdioClientTransport({
    command: process.env.OPENBRAIN_COMMAND ?? 'npx',
    args: (process.env.OPENBRAIN_ARGS ?? '@open-brain/server').split(' '),
    env: {
      ...process.env,
      OPEN_BRAIN_API_KEY: process.env.OPENBRAIN_API_KEY ?? '',
    },
  });

  _client = new Client({ name: 'eat-thing', version: '1.0.0' }, { capabilities: { tools: {} } });
  await _client.connect(transport);
  return _client;
}

export async function upsertThought(externalId: string, content: string): Promise<void> {
  const client = await getOpenBrainClient();
  // OpenBrain's MCP tool for upserting a thought keyed by external ID.
  // Tool name and params depend on the OpenBrain MCP server schema — update if different.
  await client.callTool({
    name: 'upsert_thought',
    arguments: { external_id: externalId, content },
  });
}
```

**Note:** The exact tool name (`upsert_thought`) and parameters depend on the OpenBrain MCP server's tool schema. Run `client.listTools()` once to verify available tools and adjust accordingly before wiring in the sync functions below.

- [ ] **Step 3: Replace stubs in sync.ts**

Replace the contents of `packages/openbrain/src/sync.ts`:

```typescript
import { upsertThought } from './client.js';
import type { CookLogEntry, InventorySnapshot, MealPlanPayload, RecipePayload, SyncResult } from './types.js';

function recipeExternalId(recipeId: string): string {
  return `eat-thing:recipe:${recipeId}`;
}

function inventoryExternalId(householdId: string): string {
  return `eat-thing:inventory:${householdId}`;
}

function mealPlanExternalId(mealPlanId: string): string {
  return `eat-thing:meal-plan:${mealPlanId}`;
}

function cookLogExternalId(householdId: string, date: string): string {
  return `eat-thing:cook-log:${householdId}:${date}`;
}

export async function syncRecipe(recipe: RecipePayload): Promise<SyncResult> {
  try {
    const ingredients = recipe.ingredients
      .map(i => `- ${i.qty} ${i.unit} ${i.foodName}${i.optional ? ' (optional)' : ''}`)
      .join('\n');

    const content = [
      `# Recipe: ${recipe.name}`,
      `Servings: ${recipe.servings}`,
      recipe.sourceUrl ? `Source: ${recipe.sourceUrl}` : '',
      '',
      '## Ingredients',
      ingredients,
      recipe.instructions ? '\n## Instructions\n' + recipe.instructions : '',
    ].filter(Boolean).join('\n');

    await upsertThought(recipeExternalId(recipe.id), content);
    return { ok: true };
  } catch (err) {
    console.error('syncRecipe failed', err);
    return { ok: false, error: String(err) };
  }
}

export async function syncInventorySnapshot(snapshot: InventorySnapshot): Promise<SyncResult> {
  try {
    const items = snapshot.items
      .map(i => `- ${i.foodName}: ${i.qty} ${i.unit}${i.brand ? ` (${i.brand})` : ''}${i.location ? ` [${i.location}]` : ''}${i.expiresAt ? ` expires ${i.expiresAt}` : ''}`)
      .join('\n');

    const content = `# Inventory snapshot (${snapshot.snapshotAt})\n\n${items || '(empty)'}`;
    await upsertThought(inventoryExternalId(snapshot.householdId), content);
    return { ok: true };
  } catch (err) {
    console.error('syncInventorySnapshot failed', err);
    return { ok: false, error: String(err) };
  }
}

export async function syncMealPlan(plan: MealPlanPayload): Promise<SyncResult> {
  try {
    const entries = plan.entries
      .map(e => `- ${e.date}: ${e.recipeName} (${e.servings} servings) [${e.status}]`)
      .join('\n');

    const content = `# Meal plan: week of ${plan.weekStart}\n\n${entries || '(no meals planned)'}`;
    await upsertThought(mealPlanExternalId(plan.mealPlanId), content);
    return { ok: true };
  } catch (err) {
    console.error('syncMealPlan failed', err);
    return { ok: false, error: String(err) };
  }
}

export async function syncCookLog(log: CookLogEntry): Promise<SyncResult> {
  try {
    const events = log.events
      .map(e => `- Cooked ${e.recipeName} (${e.servings} servings) at ${e.cookedAt}`)
      .join('\n');

    const content = `# Cook log: ${log.date}\n\n${events || '(no cook events)'}`;
    await upsertThought(cookLogExternalId(log.householdId, log.date), content);
    return { ok: true };
  } catch (err) {
    console.error('syncCookLog failed', err);
    return { ok: false, error: String(err) };
  }
}
```

- [ ] **Step 4: Update openbrain types.ts to match what sync.ts uses**

Read `packages/openbrain/src/types.ts` and ensure the following types exist (add any that are missing):

```typescript
export interface RecipeIngredientPayload {
  foodName: string;
  qty: number;
  unit: string;
  optional: boolean;
}

export interface RecipePayload {
  id: string;
  name: string;
  servings: number;
  sourceUrl: string | null;
  instructions: string | null;
  ingredients: RecipeIngredientPayload[];
}

export interface InventoryItemPayload {
  foodName: string;
  qty: number;
  unit: string;
  brand: string | null;
  location: string;
  expiresAt: string | null;
}

export interface InventorySnapshot {
  householdId: string;
  items: InventoryItemPayload[];
  snapshotAt: string;
}

export interface MealPlanEntryPayload {
  date: string;
  recipeName: string;
  servings: number;
  status: string;
}

export interface MealPlanPayload {
  mealPlanId: string;
  weekStart: string;
  entries: MealPlanEntryPayload[];
}

export interface CookEventPayload {
  recipeName: string;
  servings: number;
  cookedAt: string;
}

export interface CookLogEntry {
  householdId: string;
  date: string;
  events: CookEventPayload[];
}

export interface SyncResult {
  ok: boolean;
  error?: string;
}
```

- [ ] **Step 5: Build openbrain package**

```bash
pnpm --filter @eat/openbrain build
```

Expected: Builds without type errors.

- [ ] **Step 6: Commit**

```bash
git add packages/openbrain/
git commit -m "feat(openbrain): wire real MCP client and replace sync stubs"
```

---

## Task 7: Mac mini worker script

The worker polls `GET /api/sync/pending`, claims each job, fetches the snapshot, calls the appropriate sync function, then marks complete.

**Files:**
- Create: `apps/server/src/workers/openbrain-worker.ts`

- [ ] **Step 1: Implement the worker**

Create `apps/server/src/workers/openbrain-worker.ts`:

```typescript
import 'dotenv/config';
import crypto from 'node:crypto';
import {
  syncRecipe, syncInventorySnapshot, syncMealPlan, syncCookLog,
} from '@eat/openbrain';

const API_BASE = process.env.API_BASE_URL ?? 'https://your-app.vercel.app';
const HMAC_KEY = process.env.WORKER_HMAC_KEY ?? '';
const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS ?? '60000', 10);

function signedHeaders(method: string, path: string, body = ''): Record<string, string> {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const sig = crypto.createHmac('sha256', HMAC_KEY).update(`${method}\n${path}\n${timestamp}\n${body}`).digest('hex');
  return { 'X-Worker-Timestamp': timestamp, 'X-Worker-Signature': sig, 'Content-Type': 'application/json' };
}

async function workerFetch(method: string, path: string, body?: unknown) {
  const bodyStr = body ? JSON.stringify(body) : '';
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: signedHeaders(method, path, bodyStr),
    body: bodyStr || undefined,
  });
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}`);
  return res.json();
}

async function processJob(job: { id: string; householdId: string; resourceType: string; resourceId: string }) {
  await workerFetch('POST', `/api/sync/claim/${job.id}`);

  try {
    if (job.resourceType === 'inventory') {
      const snapshot = await workerFetch('GET', `/api/sync/snapshot/inventory?householdId=${job.householdId}`);
      await syncInventorySnapshot(snapshot);
    } else if (job.resourceType === 'meal_plan') {
      const snapshot = await workerFetch('GET', `/api/sync/snapshot/meal-plan?householdId=${job.householdId}&mealPlanId=${job.resourceId}`);
      await syncMealPlan(snapshot);
    }
    // recipe sync is live (triggered from the server routes directly)
    // cook log roll-up is handled by a separate daily cron (not this debounce worker)

    await workerFetch('POST', `/api/sync/complete/${job.id}`);
    console.log(`[sync] completed ${job.resourceType}:${job.resourceId}`);
  } catch (err) {
    console.error(`[sync] failed ${job.resourceType}:${job.resourceId}`, err);
    // Unclaim by setting claimedAt = null so it retries next poll
    // (a future improvement — for now the job stays claimed and will be retried after a manual reset)
  }
}

async function pollOnce() {
  try {
    const { jobs } = await workerFetch('GET', '/api/sync/pending');
    for (const job of jobs) {
      await processJob(job);
    }
  } catch (err) {
    console.error('[sync] poll failed', err);
  }
}

console.log(`[sync] OpenBrain sync worker starting. Poll interval: ${POLL_INTERVAL_MS}ms`);
pollOnce();
setInterval(pollOnce, POLL_INTERVAL_MS);
```

- [ ] **Step 2: Add start script to apps/server/package.json**

In `apps/server/package.json`, add to the `scripts` section:

```json
"worker:openbrain": "tsx src/workers/openbrain-worker.ts"
```

- [ ] **Step 3: Test the worker manually (requires live env)**

On the Mac mini, with `.env` containing `API_BASE_URL`, `WORKER_HMAC_KEY`, `OPENBRAIN_BASE_URL`, and `OPENBRAIN_API_KEY`:

```bash
pnpm --filter @eat/server worker:openbrain
```

Expected: Worker logs `[sync] OpenBrain sync worker starting`. If there are pending jobs they should be processed and logged. If no pending jobs, logs nothing after startup message.

- [ ] **Step 4: Commit**

```bash
git add apps/server/src/workers/openbrain-worker.ts apps/server/package.json
git commit -m "feat(server): add OpenBrain sync worker for Mac mini"
```

---

## Task 8: launchd plist for Mac mini

The worker should auto-start on login and restart on crash.

**Files:**
- Create: `apps/server/launchd/com.eat-thing.openbrain-sync.plist` (for reference — user installs it manually)

- [ ] **Step 1: Create launchd plist**

Create `apps/server/launchd/com.eat-thing.openbrain-sync.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.eat-thing.openbrain-sync</string>
  <key>ProgramArguments</key>
  <array>
    <string>/usr/local/bin/node</string>
    <string>/path/to/eat-thing/apps/server/dist/workers/openbrain-worker.js</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>NODE_ENV</key>
    <string>production</string>
    <key>API_BASE_URL</key>
    <string>https://your-app.vercel.app</string>
    <key>WORKER_HMAC_KEY</key>
    <string>REPLACE_ME</string>
    <key>OPENBRAIN_BASE_URL</key>
    <string>REPLACE_ME</string>
    <key>OPENBRAIN_API_KEY</key>
    <string>REPLACE_ME</string>
    <key>POLL_INTERVAL_MS</key>
    <string>60000</string>
  </dict>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>/tmp/eat-thing-openbrain-sync.log</string>
  <key>StandardErrorPath</key>
  <string>/tmp/eat-thing-openbrain-sync.err</string>
</dict>
</plist>
```

**Installation instructions (run on Mac mini):**

```bash
# Fill in REPLACE_ME values in the plist, then:
cp apps/server/launchd/com.eat-thing.openbrain-sync.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.eat-thing.openbrain-sync.plist
launchctl start com.eat-thing.openbrain-sync
# Check logs:
tail -f /tmp/eat-thing-openbrain-sync.log
```

- [ ] **Step 2: Commit**

```bash
git add apps/server/launchd/
git commit -m "docs(server): add launchd plist for OpenBrain sync worker"
```
