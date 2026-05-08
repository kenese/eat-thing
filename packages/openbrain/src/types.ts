export interface SyncResult {
  ok: boolean;
  thoughtId?: string;
  error?: string;
}

// Minimal shapes the sync functions need — not full DB row types.
// Keep this package free of @eat/shared or DB dependencies.

export interface RecipePayload {
  id: string;
  householdId: string;
  name: string;
  servings: number;
  sourceUrl?: string;
  ingredients: { food: string; qty: number; unit: string }[];
  instructions?: string;
}

export interface InventorySnapshot {
  householdId: string;
  snapshotAt: Date;
  items: { food: string; qty: number; unit: string; location: string; expiresAt?: Date }[];
}

export interface MealPlanPayload {
  id: string;
  householdId: string;
  weekStart: string; // ISO date
  entries: { date: string; recipeName: string; servings: number; status: string }[];
}

export interface CookLogEntry {
  householdId: string;
  date: string; // ISO date of the roll-up day
  events: { cookedAt: Date; recipeName: string; deductions: { food: string; qty: number; unit: string }[] }[];
}
