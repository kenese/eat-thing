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
