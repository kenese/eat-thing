import { eq, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { canonicalFoods, inventoryItems, staples } from '../db/schema/index.js';
import { amountInUnit } from './food-amounts.js';

export type StapleForLowStock = {
  id: string;
  householdId: string;
  canonicalFoodId: string;
  foodName: string;
  thresholdQty: number;
  thresholdUnit: string;
  densityGPerMl: number | null;
  countToGrams: number | null;
};

export type InventoryAmountRow = {
  canonicalFoodId: string;
  qty: number;
  unit: string;
};

export type LowStockStaple = {
  id: string;
  householdId: string;
  canonicalFoodId: string;
  foodName: string;
  thresholdQty: number;
  thresholdUnit: string;
  currentQty: number;
  neededQty: number;
};

export function deriveLowStockStaples(
  stapleRows: StapleForLowStock[],
  inventoryRows: InventoryAmountRow[],
): LowStockStaple[] {
  const inventoryByFood = new Map<string, InventoryAmountRow[]>();

  for (const row of inventoryRows) {
    const rows = inventoryByFood.get(row.canonicalFoodId) ?? [];
    rows.push(row);
    inventoryByFood.set(row.canonicalFoodId, rows);
  }

  return stapleRows
    .map((staple) => {
      let currentQty = 0;

      for (const inventoryRow of inventoryByFood.get(staple.canonicalFoodId) ?? []) {
        currentQty += amountInUnit(inventoryRow, staple.thresholdUnit, staple) ?? 0;
      }

      const neededQty = staple.thresholdQty - currentQty;
      return {
        id: staple.id,
        householdId: staple.householdId,
        canonicalFoodId: staple.canonicalFoodId,
        foodName: staple.foodName,
        thresholdQty: staple.thresholdQty,
        thresholdUnit: staple.thresholdUnit,
        currentQty,
        neededQty,
      };
    })
    .filter((row) => row.neededQty > 0.001)
    .sort((a, b) => a.foodName.localeCompare(b.foodName));
}

export async function listLowStockStaples(householdId: string): Promise<LowStockStaple[]> {
  const stapleRows = await db
    .select({
      id: staples.id,
      householdId: staples.householdId,
      canonicalFoodId: staples.canonicalFoodId,
      foodName: canonicalFoods.name,
      thresholdQty: staples.thresholdQty,
      thresholdUnit: staples.thresholdUnit,
      densityGPerMl: canonicalFoods.densityGPerMl,
      countToGrams: canonicalFoods.countToGrams,
    })
    .from(staples)
    .innerJoin(canonicalFoods, eq(staples.canonicalFoodId, canonicalFoods.id))
    .where(eq(staples.householdId, householdId));

  const inventoryRows = await db
    .select({
      canonicalFoodId: inventoryItems.canonicalFoodId,
      qty: sql<number>`sum(${inventoryItems.qty})`,
      unit: inventoryItems.unit,
    })
    .from(inventoryItems)
    .where(eq(inventoryItems.householdId, householdId))
    .groupBy(inventoryItems.canonicalFoodId, inventoryItems.unit);

  return deriveLowStockStaples(
    stapleRows,
    inventoryRows.map((row) => ({
      canonicalFoodId: row.canonicalFoodId,
      qty: Number(row.qty),
      unit: row.unit,
    })),
  );
}
