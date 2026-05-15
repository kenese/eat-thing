import { Router, type Router as ExpressRouter, type Request, type Response, type NextFunction } from 'express';
import { and, eq, lt, isNull, sql } from 'drizzle-orm';
import crypto from 'node:crypto';
import { db } from '../db/index.js';
import {
  syncDirty, mealPlans, inventoryItems, canonicalFoods,
  recipes, recipeIngredients, mealPlanEntries,
} from '../db/schema/index.js';

const router: ExpressRouter = Router();

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

  const fullPath = req.originalUrl.split('?')[0];
  const body = req.body && Object.keys(req.body).length > 0 ? JSON.stringify(req.body) : '';
  const expected = crypto.createHmac('sha256', key).update(`${req.method}\n${fullPath}\n${timestamp}\n${body}`).digest('hex');
  try {
    const valid = crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'));
    if (!valid) { res.status(401).json({ error: 'Invalid signature' }); return; }
  } catch {
    res.status(401).json({ error: 'Invalid signature' });
    return;
  }

  next();
}

// GET /api/sync/pending — unclaimed dirty resources past the debounce window
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

// GET /api/sync/snapshot/inventory?householdId=X
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
        category: canonicalFoods.category,
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

// GET /api/sync/snapshot/meal-plan?householdId=X&mealPlanId=Y
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

    res.json({ mealPlanId: plan.id, weekStart: plan.weekStart, entries, snapshotAt: new Date().toISOString() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
