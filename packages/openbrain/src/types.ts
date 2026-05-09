export interface SyncResult {
  ok: boolean;
  error?: string;
}

export interface RecipeIngredientPayload {
  foodName: string;
  qty: number;
  unit: string;
  optional: boolean;
}

export interface RecipePayload {
  id: string;
  name: string;
  servings: number;
  sourceUrl: string | null | undefined;
  instructions: string | null | undefined;
  ingredients: RecipeIngredientPayload[];
}

export interface InventoryItemPayload {
  foodName: string;
  qty: number;
  unit: string;
  brand: string | null;
  location: string;
  expiresAt: Date | string | null;
}

export interface InventorySnapshot {
  householdId: string;
  items: InventoryItemPayload[];
  snapshotAt: string;
}

export interface MealPlanEntryPayload {
  date: string;
  recipeName: string;
  servings: number;
  status: string;
}

export interface MealPlanPayload {
  mealPlanId: string;
  weekStart: string;
  entries: MealPlanEntryPayload[];
}

export interface CookEventPayload {
  recipeName: string;
  servings: number;
  cookedAt: string;
}

export interface CookLogEntry {
  householdId: string;
  date: string;
  events: CookEventPayload[];
}
