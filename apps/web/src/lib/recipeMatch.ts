import type { Recipe, InventoryRow } from '@eat/shared';

export type RecipeBucket = 'cookable' | 'shoppable' | 'library';

/**
 * Returns the list of ingredient names that aren't satisfied by inventory.
 * Match preference: canonicalFoodId equality, then case-insensitive name equality.
 * "Satisfied" means at least one inventory row with qty >= ingredient.qty, ignoring unit
 * differences (a fuller unit-aware check belongs on the server; the view-time match is
 * deliberately loose so we never tell the user they can't cook something they could).
 */
export function computeMissing(recipe: Recipe, inventory: InventoryRow[]): string[] {
  const missing: string[] = [];
  for (const ing of recipe.ingredients) {
    if (ing.optional) continue;

    // Prefer canonical ID match (same unit space, qty-comparable).
    const canonicalMatches = ing.canonicalFoodId
      ? inventory.filter((inv) => inv.canonicalFoodId === ing.canonicalFoodId)
      : [];

    if (canonicalMatches.length > 0) {
      const totalQty = canonicalMatches.reduce((s, m) => s + m.qty, 0);
      const neededQty = Number.parseFloat(ing.qty);
      if (Number.isFinite(neededQty) && totalQty < neededQty) {
        missing.push(ing.foodName);
      }
      continue;
    }

    // Fall back to case-insensitive name equality. When canonicalFoodId is absent
    // on the inventory row we can't reliably compare qtys across unit systems, so
    // any name match is treated as satisfied (deliberately loose).
    const nameMatch = inventory.some(
      (inv) => inv.foodName.toLowerCase() === ing.foodName.toLowerCase(),
    );
    if (!nameMatch) {
      missing.push(ing.foodName);
    }
  }
  return missing;
}

export function bucketRecipe(missing: string[]): RecipeBucket {
  if (missing.length === 0) return 'cookable';
  if (missing.length <= 3) return 'shoppable';
  return 'library';
}

/**
 * Summary-level match: returns missing canonical food IDs (not names).
 * Simpler than computeMissing — no quantity check, ID-only. Used for bucketing
 * recipe summaries where the full ingredient list isn't available.
 */
export function computeMissingFromIds(
  canonicalFoodIds: string[],
  inventory: InventoryRow[],
): string[] {
  const inStock = new Set(
    inventory.flatMap(r => r.canonicalFoodId ? [r.canonicalFoodId] : []),
  );
  return canonicalFoodIds.filter(id => !inStock.has(id));
}
