import { Router, type Router as ExpressRouter } from 'express';
import { z } from 'zod';
import { and, eq, asc, desc, sql, inArray } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { withHousehold } from '../middleware/with-household.js';
import { db } from '../db/index.js';
import { findExistingFoodOrRequireReview, type FoodCategory } from '../lib/find-or-create-food.js';
import { normalizeRecipeAmount } from '../lib/recipe-quantities.js';
import { amountInUnit } from '../lib/food-amounts.js';
import { listLowStockStaples } from '../lib/low-stock-staples.js';
import {
  mealPlanEntries, recipes, recipeIngredients,
  inventoryItems, canonicalFoods,
  shoppingLists, shoppingListItems,
  scraperJobs, shoppingListPrices, supermarketProducts,
} from '../db/schema/index.js';
import type { ProductCandidate, ScraperErrorCode, ScraperJobStatus, ScraperJobSummary } from '@eat/shared';

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

const SCRAPER_ERROR_CODES = new Set<ScraperErrorCode>([
  'session_expired',
  'rate_limited',
  'upstream_unavailable',
  'navigation_timeout',
  'network_error',
  'parser_error',
  'invalid_payload',
  'no_session',
  'unknown',
]);

function toJobSummary(job: {
  id: string;
  status: string;
  error: string | null;
  result: unknown;
}): ScraperJobSummary {
  const result = job.result && typeof job.result === 'object'
    ? job.result as Record<string, unknown>
    : null;
  const rawFailure = result?.['failure'];
  const failure = rawFailure && typeof rawFailure === 'object'
    ? rawFailure as Record<string, unknown>
    : null;
  const rawCode = typeof failure?.['code'] === 'string' ? failure['code'] : 'unknown';
  const code = SCRAPER_ERROR_CODES.has(rawCode as ScraperErrorCode)
    ? rawCode as ScraperErrorCode
    : 'unknown';

  return {
    id: job.id,
    status: job.status as ScraperJobStatus,
    error: job.error,
    retrying: job.status === 'in_progress' && failure?.['retryable'] === true,
    failure: failure ? {
      code,
      message: typeof failure['message'] === 'string' ? failure['message'] : job.error ?? 'Unknown scraper error',
      retryable: failure['retryable'] === true,
      attempt: typeof failure['attempt'] === 'number' ? failure['attempt'] : 1,
      maxAttempts: typeof failure['maxAttempts'] === 'number' ? failure['maxAttempts'] : 1,
    } : null,
  };
}

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
  scheduledFor: shoppingLists.scheduledFor,
};

async function findOwnedList(listId: string, householdId: string) {
  const [list] = await db
    .select({ id: shoppingLists.id })
    .from(shoppingLists)
    .where(and(eq(shoppingLists.id, listId), eq(shoppingLists.householdId, householdId)))
    .limit(1);
  return list;
}

async function itemsForList(listId: string, householdId: string) {
  const rows = await db
    .select(listItemCols)
    .from(shoppingListItems)
    .leftJoin(canonicalFoods, eq(canonicalFoods.id, shoppingListItems.canonicalFoodId))
    .where(and(
      eq(shoppingListItems.shoppingListId, listId),
      eq(shoppingListItems.householdId, householdId),
    ))
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
      source: 'recipe' | 'staple'; checked: boolean;
      sourceRecipeNames: string[] | null;
      sourceRecipeId: string | null;
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

    const lowStockStaples = await listLowStockStaples(hid);
    const stapleItemsToInsert: ItemInsert[] = lowStockStaples.map((staple) => ({
      canonicalFoodId: staple.canonicalFoodId,
      name: staple.foodName,
      qty: staple.neededQty,
      unit: staple.thresholdUnit,
      source: 'staple',
      checked: false,
      sourceRecipeNames: null,
      sourceRecipeId: null,
    }));

    // Find or create current list, then replace derived items.
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

      // Replace derived items while leaving manual entries untouched.
      await tx.delete(shoppingListItems).where(and(
        eq(shoppingListItems.shoppingListId, id),
        eq(shoppingListItems.householdId, hid),
        inArray(shoppingListItems.source, ['recipe', 'staple']),
      ));

      const derivedItemsToInsert = [...recipeItemsToInsert, ...stapleItemsToInsert];
      if (derivedItemsToInsert.length > 0) {
        await tx.insert(shoppingListItems).values(
          derivedItemsToInsert.map(item => ({ id: uuidv4(), shoppingListId: id!, householdId: hid, ...item })),
        );
      }

      return id;
    });

    const [list] = await db.select(listCols).from(shoppingLists).where(and(eq(shoppingLists.id, listId), eq(shoppingLists.householdId, hid)));
    const items = await itemsForList(listId, hid);
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
    const items = await itemsForList(list.id, req.householdId);
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
      .where(and(
        eq(shoppingListItems.id, itemId),
        eq(shoppingListItems.shoppingListId, listId),
        eq(shoppingListItems.householdId, req.householdId),
      ))
      .limit(1);
    if (!existing) { res.status(404).json({ error: 'Item not found' }); return; }

    const d = parse.data;
    await db.update(shoppingListItems)
      .set({
        ...(d.checked !== undefined && { checked: d.checked }),
        ...(d.qty !== undefined && { qty: d.qty }),
      })
      .where(and(
        eq(shoppingListItems.id, itemId),
        eq(shoppingListItems.shoppingListId, listId),
        eq(shoppingListItems.householdId, req.householdId),
      ));
    const [full] = await db
      .select(listItemCols)
      .from(shoppingListItems)
      .leftJoin(canonicalFoods, eq(canonicalFoods.id, shoppingListItems.canonicalFoodId))
      .where(and(eq(shoppingListItems.id, itemId), eq(shoppingListItems.householdId, req.householdId)));
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
      .select({ id: shoppingLists.id })
      .from(shoppingLists)
      .where(and(eq(shoppingLists.id, listId), eq(shoppingLists.householdId, req.householdId)))
      .limit(1);
    if (!list) { res.status(404).json({ error: 'Shopping list not found' }); return; }

    let foodId = parse.data.canonicalFoodId ?? null;
    if (!foodId) {
      const result = await findExistingFoodOrRequireReview(
        parse.data.name,
        parse.data.category as FoodCategory,
        parse.data.unit,
      );
      if (result.kind === 'review') {
        res.status(409).json({
          error: 'Taxonomy review required',
          code: 'taxonomy_review_required',
          proposed: result.proposed,
          matches: result.matches,
        });
        return;
      }
      foodId = result.id;
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
      .where(and(eq(shoppingListItems.id, id), eq(shoppingListItems.householdId, req.householdId)));
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
      .where(and(
        eq(shoppingListItems.id, itemId),
        eq(shoppingListItems.shoppingListId, listId),
        eq(shoppingListItems.householdId, req.householdId),
      ))
      .limit(1);
    if (!existing) { res.status(404).json({ error: 'Item not found' }); return; }
    await db.delete(shoppingListItems).where(and(
      eq(shoppingListItems.id, itemId),
      eq(shoppingListItems.shoppingListId, listId),
      eq(shoppingListItems.householdId, req.householdId),
    ));
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
    const list = await findOwnedList(listId, req.householdId);
    if (!list) { res.status(404).json({ error: 'Shopping list not found' }); return; }
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
      .where(and(
        inArray(shoppingListItems.id, itemIds),
        eq(shoppingListItems.shoppingListId, listId),
        eq(shoppingListItems.householdId, req.householdId),
      ));

    if (items.length !== itemIds.length) { res.status(404).json({ error: 'Item not found' }); return; }

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
      await tx.delete(shoppingListItems).where(and(
        inArray(shoppingListItems.id, itemIds),
        eq(shoppingListItems.shoppingListId, listId),
        eq(shoppingListItems.householdId, req.householdId),
      ));
    });

    const [updatedList] = await db.select(listCols).from(shoppingLists).where(and(eq(shoppingLists.id, listId), eq(shoppingLists.householdId, req.householdId)));
    const updatedItems = updatedList ? await itemsForList(listId, req.householdId) : [];
    res.json(updatedList ? { ...updatedList, items: updatedItems } : { items: [] });
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
    const list = await findOwnedList(listId, req.householdId);
    if (!list) { res.status(404).json({ error: 'Shopping list not found' }); return; }
    const { itemIds } = parse.data;
    const items = await db
      .select({ householdId: shoppingListItems.householdId })
      .from(shoppingListItems)
      .where(and(
        inArray(shoppingListItems.id, itemIds),
        eq(shoppingListItems.shoppingListId, listId),
        eq(shoppingListItems.householdId, req.householdId),
      ));

    if (items.length !== itemIds.length) { res.status(404).json({ error: 'Item not found' }); return; }

    await db.delete(shoppingListItems).where(and(
      inArray(shoppingListItems.id, itemIds),
      eq(shoppingListItems.shoppingListId, listId),
      eq(shoppingListItems.householdId, req.householdId),
    ));

    const [updatedList] = await db.select(listCols).from(shoppingLists).where(and(eq(shoppingLists.id, listId), eq(shoppingLists.householdId, req.householdId)));
    const updatedItems = updatedList ? await itemsForList(listId, req.householdId) : [];
    res.json(updatedList ? { ...updatedList, items: updatedItems } : { items: [] });
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
    const list = await findOwnedList(listId, req.householdId);
    if (!list) { res.status(404).json({ error: 'Shopping list not found' }); return; }
    const itemRows = await db
      .select({
        id: shoppingListItems.id,
        name: shoppingListItems.name,
        canonicalFoodId: shoppingListItems.canonicalFoodId,
        qty: shoppingListItems.qty,
        unit: shoppingListItems.unit,
      })
      .from(shoppingListItems)
      .where(and(
        eq(shoppingListItems.shoppingListId, listId),
        eq(shoppingListItems.householdId, req.householdId),
      ));

    const preferredRows = await db
      .select({ canonicalFoodId: supermarketProducts.canonicalFoodId, brand: supermarketProducts.brand })
      .from(supermarketProducts)
      .where(and(eq(supermarketProducts.householdId, req.householdId), eq(supermarketProducts.preferred, true)));

    const preferredBrandsByCanonicalFood: Record<string, string[]> = {};
    for (const r of preferredRows) {
      if (!r.canonicalFoodId || !r.brand) continue;
      (preferredBrandsByCanonicalFood[r.canonicalFoodId] ??= []).push(r.brand);
    }

    const inserted = await db
      .insert(scraperJobs)
      .values({
        householdId: req.householdId,
        store: 'new_world',
        type: 'compare_prices',
        payload: {
          shoppingListId: listId,
          items: itemRows.map(r => ({
            id: r.id,
            name: r.name,
            canonicalFoodId: r.canonicalFoodId,
            requiredQty: r.qty,
            requiredUnit: r.unit === 'ml' || r.unit === 'count' ? r.unit : 'g',
          })),
          preferredBrandsByCanonicalFood,
        },
        status: 'pending',
      })
      .returning({ id: scraperJobs.id });

    res.json({ jobId: inserted[0]?.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/shopping-lists/items/:itemId/chosen-sku
router.patch('/items/:itemId/chosen-sku', withHousehold, async (req, res) => {
  const itemId = req.params['itemId'] as string;
  if (!z.string().uuid().safeParse(itemId).success) { res.status(404).json({ error: 'Not found' }); return; }
  const { sku } = req.body as { sku?: string };
  if (typeof sku !== 'string' || sku.length === 0) { res.status(400).json({ error: 'sku required' }); return; }

  try {
    const rows = await db
      .select({ candidates: shoppingListPrices.candidates })
      .from(shoppingListPrices)
      .innerJoin(shoppingListItems, eq(shoppingListPrices.shoppingListItemId, shoppingListItems.id))
      .where(and(
        eq(shoppingListPrices.shoppingListItemId, itemId),
        eq(shoppingListPrices.store, 'new_world'),
        eq(shoppingListPrices.householdId, req.householdId),
        eq(shoppingListItems.householdId, req.householdId),
      ));
    const row = rows[0];
    if (!row) { res.status(404).json({ error: 'No prices for this item yet' }); return; }
    const candidates = (row.candidates ?? []) as ProductCandidate[];
    const chosen = candidates.find(c => c.sku === sku);
    if (!chosen) { res.status(400).json({ error: 'sku not in candidates' }); return; }

    await db
      .update(shoppingListPrices)
      .set({
        chosenSku: chosen.sku,
        sku: chosen.sku,
        name: chosen.name,
        price: chosen.price !== null && chosen.price !== undefined ? String(chosen.price) : null,
        inStock: chosen.inStock,
        matched: true,
        checkedAt: new Date(),
      })
      .where(and(
        eq(shoppingListPrices.shoppingListItemId, itemId),
        eq(shoppingListPrices.store, 'new_world'),
        eq(shoppingListPrices.householdId, req.householdId),
      ));

    res.json({ ok: true, chosenSku: chosen.sku });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:id/send-to-cart', withHousehold, async (req, res) => {
  const listId = req.params['id'] as string;
  if (!z.string().uuid().safeParse(listId).success) { res.status(404).json({ error: 'Not found' }); return; }
  try {
    const list = await findOwnedList(listId, req.householdId);
    if (!list) { res.status(404).json({ error: 'Shopping list not found' }); return; }
    const rows = await db
      .select({
        shoppingListItemId: shoppingListPrices.shoppingListItemId,
        chosenSku: shoppingListPrices.chosenSku,
        candidates: shoppingListPrices.candidates,
      })
      .from(shoppingListPrices)
      .innerJoin(shoppingListItems, eq(shoppingListPrices.shoppingListItemId, shoppingListItems.id))
      .where(and(
        eq(shoppingListItems.shoppingListId, listId),
        eq(shoppingListItems.householdId, req.householdId),
        eq(shoppingListPrices.householdId, req.householdId),
        eq(shoppingListPrices.store, 'new_world'),
      ));

    const sendable: Array<{ shoppingListItemId: string; sku: string; qty: number }> = [];
    const skipped: string[] = [];
    for (const r of rows) {
      if (!r.chosenSku) { skipped.push(r.shoppingListItemId); continue; }
      const cands = (r.candidates ?? []) as ProductCandidate[];
      const c = cands.find(x => x.sku === r.chosenSku);
      if (!c) { skipped.push(r.shoppingListItemId); continue; }
      sendable.push({ shoppingListItemId: r.shoppingListItemId, sku: c.sku, qty: c.cartQty });
    }
    if (sendable.length === 0) { res.status(400).json({ error: 'No items with a chosen sku' }); return; }

    const inserted = await db
      .insert(scraperJobs)
      .values({
        householdId: req.householdId,
        store: 'new_world',
        type: 'add_to_cart',
        payload: { shoppingListId: listId, items: sendable },
        status: 'pending',
      })
      .returning({ id: scraperJobs.id });

    res.json({ jobId: inserted[0]?.id, skipped });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id/cart-result', withHousehold, async (req, res) => {
  const listId = req.params['id'] as string;
  if (!z.string().uuid().safeParse(listId).success) { res.json({ result: null }); return; }
  try {
    const list = await findOwnedList(listId, req.householdId);
    if (!list) { res.status(404).json({ error: 'Shopping list not found' }); return; }
    const rows = await db
      .select({ id: scraperJobs.id, status: scraperJobs.status, result: scraperJobs.result, error: scraperJobs.error, payload: scraperJobs.payload })
      .from(scraperJobs)
      .where(and(eq(scraperJobs.householdId, req.householdId), eq(scraperJobs.type, 'add_to_cart')))
      .orderBy(desc(scraperJobs.createdAt))
      .limit(5);
    const job = rows.find(r => {
      const p = r.payload as Record<string, unknown> | undefined;
      return p && p['shoppingListId'] === listId;
    }) ?? null;
    res.json({
      job: job ? toJobSummary(job) : null,
      result: job?.status === 'done' ? job.result ?? null : null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id/prices', withHousehold, async (req, res) => {
  const listId = req.params['id'] as string;
  if (!z.string().uuid().safeParse(listId).success) { res.json({ prices: [], job: null }); return; }
  try {
    const list = await findOwnedList(listId, req.householdId);
    if (!list) { res.status(404).json({ error: 'Shopping list not found' }); return; }
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
        candidates: shoppingListPrices.candidates,
        chosenSku: shoppingListPrices.chosenSku,
        checkedAt: shoppingListPrices.checkedAt,
      })
      .from(shoppingListPrices)
      .innerJoin(shoppingListItems, eq(shoppingListPrices.shoppingListItemId, shoppingListItems.id))
      .where(and(
        eq(shoppingListItems.shoppingListId, listId),
        eq(shoppingListItems.householdId, req.householdId),
        eq(shoppingListPrices.householdId, req.householdId),
      ));

    const jobRows = await db
      .select({ id: scraperJobs.id, status: scraperJobs.status, error: scraperJobs.error, result: scraperJobs.result, payload: scraperJobs.payload })
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
        candidates: r.candidates ?? [],
        chosenSku: r.chosenSku ?? null,
        checkedAt: r.checkedAt instanceof Date ? r.checkedAt.toISOString() : r.checkedAt,
      })),
      job: job ? toJobSummary(job) : null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
