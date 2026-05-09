import { Router, type Router as ExpressRouter } from 'express';
import { z } from 'zod';
import { and, eq, asc, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { withHousehold } from '../middleware/with-household.js';
import { db } from '../db/index.js';
import { mealPlans, mealPlanEntries, recipes } from '../db/schema/index.js';

const router: ExpressRouter = Router();

async function markMealPlanDirty(householdId: string, mealPlanId: string) {
  await db.execute(
    sql`INSERT INTO sync_dirty (id, household_id, resource_type, resource_id, dirty_since)
        VALUES (${uuidv4()}, ${householdId}, 'meal_plan', ${mealPlanId}, now())
        ON CONFLICT (household_id, resource_type, resource_id)
        DO UPDATE SET dirty_since = now(), claimed_at = null`,
  );
}

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'must be YYYY-MM-DD');

const createEntrySchema = z.object({
  weekStart: isoDate,
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
  mealPlanId: mealPlanEntries.mealPlanId,
  date: mealPlanEntries.date,
  recipeId: mealPlanEntries.recipeId,
  recipeName: recipes.name,
  servings: mealPlanEntries.servings,
  status: mealPlanEntries.status,
};

const entryJoinOn = sql`${mealPlanEntries.recipeId} = ${recipes.id}`;

async function entriesForPlan(mealPlanId: string) {
  return db
    .select(entryCols)
    .from(mealPlanEntries)
    .innerJoin(recipes, entryJoinOn)
    .where(eq(mealPlanEntries.mealPlanId, mealPlanId))
    .orderBy(asc(mealPlanEntries.date));
}

// GET /api/meal-plans?weekStart=YYYY-MM-DD
// Returns the plan for the week (or empty entries if no plan exists yet).
router.get('/', withHousehold, async (req, res) => {
  const { weekStart } = req.query as { weekStart?: string };
  const parse = isoDate.safeParse(weekStart);
  if (!parse.success) {
    res.status(400).json({ error: 'weekStart query param required (YYYY-MM-DD)' });
    return;
  }

  try {
    const [plan] = await db
      .select({ id: mealPlans.id })
      .from(mealPlans)
      .where(and(eq(mealPlans.householdId, req.householdId), eq(mealPlans.weekStart, parse.data)))
      .limit(1);

    if (!plan) {
      res.json({ weekStart: parse.data, mealPlanId: null, entries: [] });
      return;
    }

    const entries = await entriesForPlan(plan.id);
    res.json({ weekStart: parse.data, mealPlanId: plan.id, entries });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/meal-plans/entries
// Creates the meal plan lazily if it doesn't exist, then inserts the entry.
router.post('/entries', withHousehold, async (req, res) => {
  const parse = createEntrySchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: 'Invalid input', details: parse.error.flatten() });
    return;
  }
  const { weekStart, date, recipeId, servings } = parse.data;

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
    const planId = await db.transaction(async tx => {
      const [existing] = await tx
        .select({ id: mealPlans.id })
        .from(mealPlans)
        .where(and(eq(mealPlans.householdId, req.householdId), eq(mealPlans.weekStart, weekStart)))
        .limit(1);

      let id = existing?.id;
      if (!id) {
        id = uuidv4();
        await tx.insert(mealPlans).values({ id, householdId: req.householdId, weekStart });
      }

      await tx.insert(mealPlanEntries).values({
        id: entryId,
        mealPlanId: id,
        householdId: req.householdId,
        date,
        recipeId,
        servings,
      });

      return id;
    });

    const [full] = await db
      .select(entryCols)
      .from(mealPlanEntries)
      .innerJoin(recipes, entryJoinOn)
      .where(eq(mealPlanEntries.id, entryId));

    res.status(201).json({ mealPlanId: planId, entry: full });
    markMealPlanDirty(req.householdId, planId).catch(err => console.error('sync_dirty write failed', err));
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
    markMealPlanDirty(req.householdId, full.mealPlanId).catch(err => console.error('sync_dirty write failed', err));
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
      .select({ householdId: mealPlanEntries.householdId, mealPlanId: mealPlanEntries.mealPlanId })
      .from(mealPlanEntries)
      .where(eq(mealPlanEntries.id, id))
      .limit(1);

    if (!existing) { res.status(404).json({ error: 'Entry not found' }); return; }
    if (existing.householdId !== req.householdId) { res.status(403).json({ error: 'Forbidden' }); return; }

    await db.delete(mealPlanEntries).where(eq(mealPlanEntries.id, id));
    res.json({ id });
    markMealPlanDirty(req.householdId, existing.mealPlanId).catch(err => console.error('sync_dirty write failed', err));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
