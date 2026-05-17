import { isMassUnit, isVolumeUnit, toCanonical, type DisplayUnit } from '@eat/taxonomy';

export function parseRecipeQuantity(value: string): number | null {
  const cleaned = value?.trim();
  if (!cleaned) return null;

  const mixed = cleaned.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixed) {
    const whole = Number(mixed[1]);
    const numerator = Number(mixed[2]);
    const denominator = Number(mixed[3]);
    if (denominator > 0) return whole + numerator / denominator;
  }

  const fraction = cleaned.match(/^(\d+)\/(\d+)$/);
  if (fraction) {
    const numerator = Number(fraction[1]);
    const denominator = Number(fraction[2]);
    if (denominator > 0) return numerator / denominator;
  }

  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function normalizeDisplayUnit(unit: string): DisplayUnit | null {
  const normalized = unit.trim().toLowerCase();
  if (!normalized) return 'count';
  if (normalized === 'gram' || normalized === 'grams' || normalized === 'gr') return 'g';
  if (normalized === 'kilogram' || normalized === 'kilograms') return 'kg';
  if (normalized === 'milliliter' || normalized === 'milliliters') return 'ml';
  if (normalized === 'millilitre' || normalized === 'millilitres') return 'ml';
  if (normalized === 'liter' || normalized === 'liters' || normalized === 'litre' || normalized === 'litres') return 'l';
  if (normalized === 'teaspoon' || normalized === 'teaspoons') return 'tsp';
  if (normalized === 'tablespoon' || normalized === 'tablespoons') return 'tbsp';
  if (normalized === 'cups') return 'cup';
  if (normalized === 'ounce' || normalized === 'ounces') return 'oz';
  if (normalized === 'pound' || normalized === 'pounds') return 'lb';
  if (normalized === 'each' || normalized === 'item' || normalized === 'items') return 'count';
  if (normalized === 'count' || isMassUnit(normalized) || isVolumeUnit(normalized)) return normalized;
  return null;
}

export function normalizeRecipeAmount(
  qty: string,
  unit: string,
): { qty: number; unit: 'g' | 'ml' | 'count' } | null {
  const parsedQty = parseRecipeQuantity(qty);
  const parsedUnit = normalizeDisplayUnit(unit);
  if (parsedQty == null || parsedUnit == null) return null;
  return toCanonical(parsedQty, parsedUnit);
}
