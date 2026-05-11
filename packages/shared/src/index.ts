// ─── Units & locations ──────────────────────────────────────────────────────

export type CanonicalUnit = 'g' | 'ml' | 'count';
export type InventoryLocation = 'fridge' | 'pantry' | 'freezer' | 'other';

// ─── Canonical foods ─────────────────────────────────────────────────────────

export interface CanonicalFood {
  id: string;
  name: string;
  defaultUnit: CanonicalUnit;
  aliases: string[];
  densityGPerMl: number | null;
}

// ─── Inventory ────────────────────────────────────────────────────────────────

export interface InventoryRow {
  id: string;
  householdId: string;
  canonicalFoodId: string;
  foodName: string;
  qty: number;
  unit: CanonicalUnit;
  brand: string | null;
  location: InventoryLocation;
  purchasedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateInventoryItemInput {
  canonicalFoodId: string;
  qty: number;
  unit: CanonicalUnit;
  brand?: string | null;
  location?: InventoryLocation;
  purchasedAt?: string | null;
  expiresAt?: string | null;
}

export interface UpdateInventoryItemInput {
  qty?: number;
  unit?: CanonicalUnit;
  brand?: string | null;
  location?: InventoryLocation;
  purchasedAt?: string | null;
  expiresAt?: string | null;
}

// ─── Recipes ──────────────────────────────────────────────────────────────────

export interface RecipeIngredient {
  id: string;
  recipeId: string;
  canonicalFoodId: string;
  foodName: string;
  qty: number;
  unit: CanonicalUnit;
  optional: boolean;
  sortOrder: number;
}

export interface RecipeSummary {
  id: string;
  name: string;
  servings: number;
  sourceUrl: string | null;
  sourceImage: string | null;
  ingredientCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Recipe {
  id: string;
  householdId: string;
  name: string;
  servings: number;
  sourceUrl: string | null;
  sourceImage: string | null;
  instructions: string | null;
  ingredients: RecipeIngredient[];
  createdAt: string;
  updatedAt: string;
}

export interface RecipeIngredientInput {
  canonicalFoodId: string;
  qty: number;
  unit: CanonicalUnit;
  optional?: boolean;
}

export interface CreateRecipeInput {
  name: string;
  servings: number;
  sourceUrl?: string | null;
  sourceImage?: string | null;
  instructions?: string | null;
  ingredients: RecipeIngredientInput[];
  photoBase64?: string;
  photoMimeType?: string;
}

export interface UpdateRecipeInput {
  name?: string;
  servings?: number;
  sourceUrl?: string | null;
  sourceImage?: string | null;
  instructions?: string | null;
  ingredients?: RecipeIngredientInput[];
  photoBase64?: string;
  photoMimeType?: string;
}

// ─── Recipe import ───────────────────────────────────────────────────────────

export interface ImportedIngredient {
  rawText: string;
  canonicalFoodId: string | null;
  foodName: string | null;
  qty: number;
  unit: CanonicalUnit;
  optional: boolean;
  confidence: 'high' | 'low';
}

export interface ImportedRecipe {
  name: string;
  servings: number;
  sourceUrl: string | null;
  sourceImage: string | null;
  instructions: string | null;
  ingredients: ImportedIngredient[];
}

// ─── Meal plans ───────────────────────────────────────────────────────────────

export type MealStatus = 'planned' | 'cooked' | 'skipped';

export interface MealPlanEntry {
  id: string;
  mealPlanId: string;
  date: string; // YYYY-MM-DD
  recipeId: string;
  recipeName: string;
  servings: number;
  status: MealStatus;
}

export interface MealPlanWeek {
  weekStart: string; // YYYY-MM-DD (Monday)
  mealPlanId: string | null;
  entries: MealPlanEntry[];
}

export interface CreateMealPlanEntryInput {
  weekStart: string;
  date: string;
  recipeId: string;
  servings: number;
}

export interface UpdateMealPlanEntryInput {
  date?: string;
  servings?: number;
  status?: MealStatus;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  image?: string | null;
}

export interface Session {
  user: SessionUser;
  session: { id: string; userId: string; expiresAt: string };
}

// ─── Staples ──────────────────────────────────────────────────────────────────

export interface Staple {
  id: string;
  householdId: string;
  canonicalFoodId: string;
  foodName: string;
  thresholdQty: number;
  thresholdUnit: CanonicalUnit;
  createdAt: string;
}

export interface CreateStapleInput {
  canonicalFoodId: string;
  thresholdQty: number;
  thresholdUnit: CanonicalUnit;
}

export interface UpdateStapleInput {
  thresholdQty?: number;
  thresholdUnit?: CanonicalUnit;
}

// ─── Shopping lists ───────────────────────────────────────────────────────────

export type ShoppingSource = 'recipe' | 'staple' | 'manual';

export interface ShoppingListItem {
  id: string;
  shoppingListId: string;
  canonicalFoodId: string | null;
  name: string;
  qty: number;
  unit: CanonicalUnit;
  source: ShoppingSource;
  checked: boolean;
}

export interface ShoppingList {
  id: string;
  householdId: string;
  generatedFromMealPlanId: string | null;
  createdAt: string;
  finalizedAt: string | null;
  items: ShoppingListItem[];
}

export interface GenerateShoppingListInput {
  weekStart: string;
}

export interface AddShoppingListItemInput {
  name: string;
  qty: number;
  unit: CanonicalUnit;
  canonicalFoodId?: string | null;
}

export interface UpdateShoppingListItemInput {
  checked?: boolean;
  qty?: number;
}

// ─── Cook events ──────────────────────────────────────────────────────────────

export interface CookDeduction {
  inventoryItemId: string;
  canonicalFoodId: string;
  foodName: string;
  qty: number;
  unit: CanonicalUnit;
}

export interface CookPrompt {
  question: string;
  canonicalFoodId: string;
  foodName: string;
  inventoryItemId?: string;
  inventoryQty?: number;
  inventoryUnit?: CanonicalUnit;
}

export interface CookEventPreview {
  mealPlanEntryId: string | null;
  recipeId: string;
  servings: number;
  deductions: CookDeduction[];
  prompts: CookPrompt[];
}

export interface CookPromptResponse {
  question: string;
  answer: string;
  inventoryItemId?: string;
}

export interface CreateCookEventInput {
  mealPlanEntryId?: string;
  recipeId: string;
  servings: number;
  deductions: CookDeduction[];
  promptResponses: CookPromptResponse[];
}

export interface CookEvent {
  id: string;
  householdId: string;
  mealPlanEntryId: string | null;
  cookedAt: string;
  deductions: CookDeduction[];
  promptsResolved: CookPromptResponse[];
}

// ─── Supermarket / scraper ───────────────────────────────────────────────────

export type Store = 'new_world' | 'paknsave' | 'woolworths';

export type ScraperJobType = 'import_past_orders' | 'compare_prices';
export type ScraperJobStatus = 'pending' | 'in_progress' | 'done' | 'failed';

export interface ScraperJob {
  id: string;
  householdId: string;
  store: Store;
  type: ScraperJobType;
  payload: Record<string, unknown> | null;
  status: ScraperJobStatus;
  attempts: number;
  createdAt: string;
  claimedAt: string | null;
  completedAt: string | null;
  error: string | null;
}

export interface ShoppingListPrice {
  id: string;
  shoppingListItemId: string;
  store: Store;
  sku: string | null;
  name: string | null;
  price: number | null;
  inStock: boolean;
  matched: boolean;
  checkedAt: string;
}

export interface PricesForListResponse {
  prices: ShoppingListPrice[];
  job: { id: string; status: ScraperJobStatus; error: string | null } | null;
}

export interface RefreshPricesResponse {
  jobId: string;
}

export interface ImportPastOrdersInput {
  store: Store;
}

export interface ComparePricesResult {
  items: Array<{
    shoppingListItemId: string;
    sku: string | null;
    name: string | null;
    brand: string | null;
    price: number | null;
    inStock: boolean;
    matched: boolean;
  }>;
}

export interface ImportPastOrdersResult {
  products: Array<{
    sku: string;
    name: string;
    brand: string | null;
    canonicalFoodHint: string | null;
  }>;
}
