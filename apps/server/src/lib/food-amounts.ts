import { convertNormalizedAmount, type NormalizedUnit } from '@eat/taxonomy';

export type FoodConversionInfo = {
  densityGPerMl: number | null;
  countToGrams: number | null;
};

export type FoodAmount = {
  qty: number;
  unit: string;
};

function normalizedUnit(unit: string): NormalizedUnit | null {
  return unit === 'g' || unit === 'ml' || unit === 'count' ? unit : null;
}

export function amountInUnit(
  amount: FoodAmount,
  targetUnit: string,
  food: FoodConversionInfo,
): number | null {
  const from = normalizedUnit(amount.unit);
  const to = normalizedUnit(targetUnit);
  if (from == null || to == null) return null;
  return convertNormalizedAmount(amount.qty, from, to, {
    densityGPerMl: food.densityGPerMl,
    countToGrams: food.countToGrams,
  });
}

export function subtractAmount(
  inventory: FoodAmount,
  needed: FoodAmount,
  food: FoodConversionInfo,
): { deductedQty: number; remainingQty: number } | null {
  const neededInInventoryUnit = amountInUnit(needed, inventory.unit, food);
  if (neededInInventoryUnit == null) return null;

  const deductedQty = Math.min(neededInInventoryUnit, inventory.qty);
  return {
    deductedQty,
    remainingQty: Math.max(0, inventory.qty - deductedQty),
  };
}
