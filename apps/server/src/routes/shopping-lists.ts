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
  scraperJobs, shoppingListPrices,
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

type Category = 'produce' | 'meat' | 'dairy' | 'pantry' | 'frozen' | 'drinks' | 'other';

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
};

function withCategory<T extends { category: string | null }>(row: T): Omit<T, 'category'> & { category: Category } {
  const { category, ...rest } = row;
  return { ...rest, category: ((category ?? 'other') as Category) };
}

const listCols = {
  id: shoppingLists.id,
  householdId: shoppingLists.householdId,
  generatedFromMealPlanId: shoppingLists.generatedFromMealPlanId,
  createdAt: shoppingLists.createdAt,
  finalizedAt: shoppingLists.finalizedAt,
};

async function itemsForList(listId: string) {
  const rows = await db
    .select(listItemCols)
    .from(shoppingListItems)
    .leftJoin(canonicalFoods, eq(canonicalFoods.id, shoppingListItems.canonicalFoodId))
    .where(eq(shoppingListItems.shoppingListId, listId))
    .orderBy(asc(shoppingListItems.source), asc(shoppingListItems.name));
  return rows.map(withCategory);
}

// POST /api/shopping-lists/generate
router.post('/generate', withHousehold, async (req, res) => {
  const parse = generateSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: 'Invalid input', details: parse.error.flatten() });
    return;
  }
  const { weekStart } = parse.data;
  const hid = req.householdId;

  try {
    const [plan] = await db
      .select({ id: mealPlans.id })
      .from(mealPlans)
      .where(and(eq(mealPlans.householdId, hid), eq(mealPlans.weekStart, weekStart)))
      .limit(1);

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

    type FoodInfo = { foodName: string; unit: 'g' | 'ml' | 'count'; qty: number; densityGPerMl: number | null };
    const needed = new Map<string, FoodInfo>();
    for (const row of rawIngredients) {
      const ratio = row.recipeServings > 0 ? row.entryServings / row.recipeServings : 1;
      const key = `${row.canonicalFoodId}::${row.unit}`;
      const cur = needed.get(key);
      if (cur) { cur.qty += row.qty * ratio; }
      else { needed.set(key, { foodName: row.foodName, unit: row.unit, qty: row.qty * ratio, densityGPerMl: row.densityGPerMl }); }
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

    const invMap = new Map<string, number>();
    for (const r of invRows) invMap.set(`${r.canonicalFoodId}::${r.unit}`, Number(r.total));

    type ItemInsert = { canonicalFoodId: string; name: string; qty: number; unit: 'g' | 'ml' | 'count'; source: 'recipe' | 'staple' | 'manual'; checked: boolean };
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

    const listId = uuidv4();
    await db.transaction(async tx => {
      await tx.insert(shoppingLists).values({ id: listId, householdId: hid, generatedFromMealPlanId: plan?.id ?? null });
      if (toInsert.length > 0) {
        await tx.insert(shoppingListItems).values(
          toInsert.map(item => ({ id: uuidv4(), shoppingListId: listId, householdId: hid, ...item })),
        );
      }
    });

    const [list] = await db.select(listCols).from(shoppingLists).where(eq(shoppingLists.id, listId));
    const items = await itemsForList(listId);
    res.status(201).json({ ...list, items });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/shopping-lists/current
router.get('/current', withHousehold, async (req, res) => {
  try {
    const [list] = await db
      .select(listCols)
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
      .set({
        ...(d.checked !== undefined && { checked: d.checked }),
        ...(d.qty !== undefined && { qty: d.qty }),
      })
      .where(eq(shoppingListItems.id, itemId));
    const [full] = await db
      .select(listItemCols)
      .from(shoppingListItems)
      .leftJoin(canonicalFoods, eq(canonicalFoods.id, shoppingListItems.canonicalFoodId))
      .where(eq(shoppingListItems.id, itemId));
    res.json(full ? withCategory(full) : null);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/shopping-lists/:listId/items
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

// ─── Price comparison (Phase 3) ───────────────────────────────────────────────

router.post('/:id/refresh-prices', withHousehold, async (req, res) => {
  const listId = req.params['id'] as string;
  try {
    const inserted = await db
      .insert(scraperJobs)
      .values({
        householdId: req.householdId,
        store: 'new_world',
        type: 'compare_prices',
        payload: { shoppingListId: listId },
        status: 'pending',
      })
      .returning({ id: scraperJobs.id });

    res.json({ jobId: inserted[0]?.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id/prices', withHousehold, async (req, res) => {
  const listId = req.params['id'] as string;
  try {
    const priceRows = await db
      .select({
        id: shoppingListPrices.id,
        shoppingListItemId: shoppingListPrices.shoppingListItemId,
        store: shoppingListPrices.store,
        sku: shoppingListPrices.sku,
        name: shoppingListPrices.name,
        price: shoppingListPrices.price,
        inStock: shoppingListPrices.inStock,
        matched: shoppingListPrices.matched,
        checkedAt: shoppingListPrices.checkedAt,
      })
      .from(shoppingListPrices)
      .innerJoin(shoppingListItems, eq(shoppingListPrices.shoppingListItemId, shoppingListItems.id))
      .where(eq(shoppingListItems.shoppingListId, listId));

    const jobRows = await db
      .select({ id: scraperJobs.id, status: scraperJobs.status, error: scraperJobs.error, payload: scraperJobs.payload })
      .from(scraperJobs)
      .where(and(eq(scraperJobs.householdId, req.householdId), eq(scraperJobs.type, 'compare_prices')))
      .orderBy(desc(scraperJobs.createdAt))
      .limit(5);

    const job = jobRows.find(j => {
      const p = j.payload as Record<string, unknown> | null;
      return p && p['shoppingListId'] === listId;
    }) ?? null;

    res.json({
      prices: priceRows.map(r => ({
        ...r,
        price: r.price !== null ? Number(r.price) : null,
        checkedAt: r.checkedAt instanceof Date ? r.checkedAt.toISOString() : r.checkedAt,
      })),
      job: job ? { id: job.id, status: job.status, error: job.error } : null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
