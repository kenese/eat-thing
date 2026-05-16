import { Router, type Router as ExpressRouter } from 'express';
import { z } from 'zod';
import { and, eq, asc, desc, sql, inArray } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { withHousehold } from '../middleware/with-household.js';
import { db } from '../db/index.js';
import { findOrCreateFood, type FoodCategory } from '../lib/find-or-create-food.js';
import { normalizeRecipeAmount } from '../lib/recipe-quantities.js';
import { amountInUnit } from '../lib/food-amounts.js';
import {
  mealPlanEntries, recipes, recipeIngredients,
  inventoryItems, canonicalFoods,
  shoppingLists, shoppingListItems,
  scraperJobs, shoppingListPrices,
} from '../db/schema/index.js';

const router: ExpressRouter = Router();

const addItemSchema = z.object({
  name: z.string().trim().min(1).max(200),
  qty: z.number().positive(),
  unit: z.string().trim().min(1).max(40),
  canonicalFoodId: z.string().uuid().nullable().optional(),
  category: z.enum(['produce', 'meat', 'dairy', 'pantry', 'frozen', 'drinks', 'other']).optional(),
}).refine(d => d.canonicalFoodId || d.category, {
  message: 'category is required when canonicalFoodId is not provided',
});

const batchItemSchema = z.object({
  itemIds: z.array(z.string().uuid()).min(1),
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
  sourceRecipeNames: shoppingListItems.sourceRecipeNames,
  sourceRecipeId: shoppingListItems.sourceRecipeId,
};

function withCategory<T extends { category: string | null }>(row: T): Omit<T, 'category'> & { category: Category } {
  const { category, ...rest } = row;
  return { ...rest, category: ((category ?? 'other') as Category) };
}

const listCols = {
  id: shoppingLists.id,
  householdId: shoppingLists.householdId,
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
  const listId = req.params['listId'] as string;
  const parse = updateItemSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: 'Invalid input', details: parse.error.flatten() });
    return;
  }
  if (!z.string().uuid().safeParse(itemId).success || !z.string().uuid().safeParse(listId).success) { res.status(404).json({ error: 'Not found' }); return; }
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

// DELETE /api/shopping-lists/:listId/items/:itemId
router.delete('/:listId/items/:itemId', withHousehold, async (req, res) => {
  const itemId = req.params['itemId'] as string;
  const listId = req.params['listId'] as string;
  if (!z.string().uuid().safeParse(itemId).success || !z.string().uuid().safeParse(listId).success) { res.status(404).json({ error: 'Not found' }); return; }
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

// ─── Price comparison (Phase 3) ───────────────────────────────────────────────

router.post('/:id/refresh-prices', withHousehold, async (req, res) => {
  const listId = req.params['id'] as string;
  if (!z.string().uuid().safeParse(listId).success) { res.status(404).json({ error: 'Not found' }); return; }
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
  if (!z.string().uuid().safeParse(listId).success) { res.json({ prices: [], job: null }); return; }
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
