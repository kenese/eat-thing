import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import type { ShoppingListFromPlanPreview, ShoppingListPreviewItem } from '@eat/shared';
import { db } from '../db/index.js';
import {
  canonicalFoods,
  inventoryItems,
  mealPlanEntries,
  recipeIngredients,
  recipes,
  shoppingLists,
} from '../db/schema/index.js';
import { amountInUnit } from './food-amounts.js';
import { listLowStockStaples } from './low-stock-staples.js';
import { normalizeRecipeAmount } from './recipe-quantities.js';

type RawIngredient = {
  canonicalFoodId: string;
  foodName: string;
  unit: string;
  qty: string;
  recipeServings: number;
  entryServings: number;
  densityGPerMl: number | null;
  countToGrams: number | null;
  recipeName: string;
  recipeId: string;
  entryId: string;
  entryDate: string;
};

type NeededFood = {
  foodName: string;
  unit: string;
  qty: number;
  densityGPerMl: number | null;
  countToGrams: number | null;
  recipeNames: Set<string>;
  recipeIds: Set<string>;
};

export async function deriveShoppingListFromPlanPreview(
  householdId: string,
  entryIds: string[],
): Promise<ShoppingListFromPlanPreview> {
  const rawIngredients: RawIngredient[] = entryIds.length > 0
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
          entryId: mealPlanEntries.id,
          entryDate: mealPlanEntries.date,
        })
        .from(mealPlanEntries)
        .innerJoin(recipes, eq(mealPlanEntries.recipeId, recipes.id))
        .innerJoin(recipeIngredients, eq(recipeIngredients.recipeId, recipes.id))
        .innerJoin(canonicalFoods, eq(recipeIngredients.canonicalFoodId, canonicalFoods.id))
        .where(and(
          eq(mealPlanEntries.householdId, householdId),
          inArray(mealPlanEntries.id, entryIds),
          eq(recipeIngredients.optional, false),
        ))
    : [];

  const needed = new Map<string, NeededFood>();
  const previewRecipeIds = new Set<string>();
  const previewDays = new Set<string>();

  for (const row of rawIngredients) {
    previewRecipeIds.add(row.recipeId);
    previewDays.add(row.entryDate);

    const amount = normalizeRecipeAmount(String(row.qty), String(row.unit));
    if (!amount) continue;

    const ratio = row.recipeServings > 0 ? row.entryServings / row.recipeServings : 1;
    const key = `${row.canonicalFoodId}::${amount.unit}`;
    const existing = needed.get(key);

    if (existing) {
      existing.qty += amount.qty * ratio;
      existing.recipeNames.add(row.recipeName);
      existing.recipeIds.add(row.recipeId);
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
    .where(eq(inventoryItems.householdId, householdId))
    .groupBy(inventoryItems.canonicalFoodId, inventoryItems.unit);

  const invByFood = new Map<string, { unit: string; qty: number }[]>();
  for (const row of invRows) {
    const foodRows = invByFood.get(row.canonicalFoodId) ?? [];
    foodRows.push({ unit: row.unit, qty: Number(row.total) });
    invByFood.set(row.canonicalFoodId, foodRows);
  }

  const recipeItems: ShoppingListPreviewItem[] = [];
  for (const [key, info] of needed) {
    const [foodId] = key.split('::');
    let available = 0;
    for (const inv of invByFood.get(foodId) ?? []) {
      available += amountInUnit(inv, info.unit, info) ?? 0;
    }

    const gap = info.qty - available;
    if (gap > 0.001) {
      const firstRecipeId = info.recipeIds.values().next().value as string;
      recipeItems.push({
        canonicalFoodId: foodId,
        name: info.foodName,
        qty: gap,
        unit: info.unit,
        source: 'recipe',
        sourceRecipeNames: [...info.recipeNames],
        sourceRecipeId: firstRecipeId,
      });
    }
  }

  const lowStockStaples = await listLowStockStaples(householdId);
  const stapleItems: ShoppingListPreviewItem[] = lowStockStaples.map((staple) => ({
    canonicalFoodId: staple.canonicalFoodId,
    name: staple.foodName,
    qty: staple.neededQty,
    unit: staple.thresholdUnit,
    source: 'staple',
    sourceRecipeNames: null,
    sourceRecipeId: null,
  }));

  const [currentList] = await db
    .select({
      id: shoppingLists.id,
      householdId: shoppingLists.householdId,
      createdAt: shoppingLists.createdAt,
      finalizedAt: shoppingLists.finalizedAt,
      scheduledFor: shoppingLists.scheduledFor,
    })
    .from(shoppingLists)
    .where(eq(shoppingLists.householdId, householdId))
    .orderBy(desc(shoppingLists.createdAt))
    .limit(1);

  const items = [...recipeItems, ...stapleItems];

  return {
    scheduledFor: currentList?.scheduledFor ?? null,
    entryIds,
    dayCount: previewDays.size,
    recipeCount: previewRecipeIds.size,
    itemCount: items.length,
    recipeItemCount: recipeItems.length,
    stapleItemCount: stapleItems.length,
    items,
  };
}
