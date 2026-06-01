import { Router, type Router as ExpressRouter } from 'express';
import { z } from 'zod';
import { and, eq, gte, lte, asc, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { withHousehold } from '../middleware/with-household.js';
import { db } from '../db/index.js';
import { mealPlanEntries, recipes } from '../db/schema/index.js';

const router: ExpressRouter = Router();
const MAX_ENTRIES_PER_DAY = 4;

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

async function loadEntriesForDay(date: string, householdId: string) {
  return db
    .select({ id: mealPlanEntries.id })
    .from(mealPlanEntries)
    .where(and(
      eq(mealPlanEntries.householdId, householdId),
      eq(mealPlanEntries.date, date),
    ))
    .limit(MAX_ENTRIES_PER_DAY);
}

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

    const entriesForDay = await loadEntriesForDay(date, req.householdId);
    if (entriesForDay.length >= MAX_ENTRIES_PER_DAY) {
      res.status(409).json({ error: `That day already has ${MAX_ENTRIES_PER_DAY} recipes` });
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
    if (d.date && d.date !== existing.date) {
      const entriesForTargetDay = await loadEntriesForDay(d.date, req.householdId);
      if (entriesForTargetDay.length >= MAX_ENTRIES_PER_DAY) {
        res.status(409).json({ error: `That day already has ${MAX_ENTRIES_PER_DAY} recipes` });
        return;
      }
    }

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
