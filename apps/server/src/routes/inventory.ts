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

// sql template for the JOIN — avoids type-widening issue from canonicalFoods.aliases (text[])
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
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
