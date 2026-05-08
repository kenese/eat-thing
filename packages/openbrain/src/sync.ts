import type { CookLogEntry, InventorySnapshot, MealPlanPayload, RecipePayload, SyncResult } from './types.js';

// These functions are stubs. Real implementations will use the OpenBrain
// MCP client to upsert thoughts keyed by a stable external ID so repeated
// syncs update in place rather than spawning duplicates.

export async function syncRecipe(_recipe: RecipePayload): Promise<SyncResult> {
  return { ok: true };
}

export async function syncInventorySnapshot(_snapshot: InventorySnapshot): Promise<SyncResult> {
  return { ok: true };
}

export async function syncMealPlan(_plan: MealPlanPayload): Promise<SyncResult> {
  return { ok: true };
}

export async function syncCookLog(_log: CookLogEntry): Promise<SyncResult> {
  return { ok: true };
}
