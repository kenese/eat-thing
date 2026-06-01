// ─── Food categories ─────────────────────────────────────────────────────────

export type Category = 'produce' | 'meat' | 'dairy' | 'pantry' | 'frozen' | 'drinks' | 'other';

// ─── Canonical foods ─────────────────────────────────────────────────────────

export interface CanonicalFood {
  id: string;
  name: string;
  defaultUnit: string;
  aliases: string[];
  densityGPerMl: number | null;
  countToGrams: number | null;
}

export interface CreateFoodInput {
  name: string;
  defaultUnit?: 'g' | 'ml' | 'count';
  category?: Category;
}

// ─── Inventory ────────────────────────────────────────────────────────────────

export interface InventoryRow {
  id: string;
  householdId: string;
  canonicalFoodId: string;
  foodName: string;
  qty: number;
  unit: string;
  brand: string | null;
  category: Category;
  purchasedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateInventoryItemInput {
  canonicalFoodId?: string;
  foodName?: string;
  category?: Category;
  qty: number;
  unit: string;
  brand?: string | null;
  purchasedAt?: string | null;
  expiresAt?: string | null;
}

export interface UpdateInventoryItemInput {
  qty?: number;
  unit?: string;
  brand?: string | null;
  purchasedAt?: string | null;
  expiresAt?: string | null;
}

// ─── Recipes ──────────────────────────────────────────────────────────────────

export interface RecipeIngredient {
  id: string;
  recipeId: string;
  canonicalFoodId: string;
  foodName: string;
  qty: string;
  unit: string;
  section: string | null;
  metricValue: string | null;
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
  totalTimeMinutes: number | null;
  tags: string[];
  canonicalFoodIds: string[];
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
  qty: string;
  unit: string;
  section?: string | null;
  metricValue?: string | null;
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
  canonicalDefaultUnit: string | null;
  qty: string;
  unit: string;
  section: string | null;
  metric: string | null;
  optional: boolean;
  confidence: 'high' | 'low';
}

export interface ImportedRecipe {
  name: string;
  servings: number;
  sourceUrl: string | null;
  sourceImage: string | null;
  heroImageUrl: string | null;
  instructions: string | null;
  ingredients: ImportedIngredient[];
}

// ─── Meal plans ───────────────────────────────────────────────────────────────

export type MealStatus = 'planned' | 'cooked' | 'skipped';

export interface MealPlanEntry {
  id: string;
  date: string; // YYYY-MM-DD
  recipeId: string;
  recipeName: string;
  servings: number;
  status: MealStatus;
}

export interface MealPlanEntriesResponse {
  entries: MealPlanEntry[];
}

export interface CreateMealPlanEntryInput {
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
  thresholdUnit: string;
  createdAt: string;
}

export interface CreateStapleInput {
  canonicalFoodId: string;
  thresholdQty: number;
  thresholdUnit: string;
}

export interface UpdateStapleInput {
  thresholdQty?: number;
  thresholdUnit?: string;
}

// ─── Shopping lists ───────────────────────────────────────────────────────────

export type ShoppingSource = 'recipe' | 'staple' | 'manual';

export interface ShoppingListItem {
  id: string;
  shoppingListId: string;
  canonicalFoodId: string | null;
  name: string;
  qty: number;
  unit: string;
  source: ShoppingSource;
  checked: boolean;
  category: Category;
  sourceRecipeNames: string[] | null;
  sourceRecipeId: string | null;
}

export interface ShoppingList {
  id: string;
  householdId: string;
  createdAt: string;
  finalizedAt: string | null;
  items: ShoppingListItem[];
}

export interface ApplyPlanToShoppingListInput {
  entryIds: string[];
}

export interface AddShoppingListItemInput {
  name: string;
  qty: number;
  unit: string;
  canonicalFoodId?: string | null;
  category?: Category;
}

export interface UpdateShoppingListItemInput {
  checked?: boolean;
  qty?: number;
}

export interface PurchaseShoppingListItemsInput {
  itemIds: string[];
}

export interface BatchDeleteShoppingListItemsInput {
  itemIds: string[];
}

// ─── Cook events ──────────────────────────────────────────────────────────────

export interface CookDeduction {
  inventoryItemId: string;
  canonicalFoodId: string;
  foodName: string;
  qty: number;
  unit: string;
}

export interface CookPrompt {
  question: string;
  canonicalFoodId: string;
  foodName: string;
  inventoryItemId?: string;
  inventoryQty?: number;
  inventoryUnit?: string;
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

// ─── Product candidates (scraper → shopping list prices) ─────────────────────

export type ProductCandidateUnit = 'g' | 'ml' | 'count';

export type ProductCandidateResolution = 'sole' | 'preferred' | 'manual';

export interface ProductCandidate {
  sku: string;
  name: string;
  brand: string | null;
  packSize: { qty: number; unit: ProductCandidateUnit } | null;
  price: number;
  unitPrice: { value: number; per: ProductCandidateUnit } | null;
  inStock: boolean;
  onSpecial: boolean;
  cartQty: number;
  resolution: ProductCandidateResolution;
}

// ─── Supermarket / scraper ───────────────────────────────────────────────────

export type Store = 'new_world' | 'paknsave' | 'woolworths';

export type ScraperJobType = 'import_past_orders' | 'compare_prices' | 'add_to_cart';
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
  candidates: ProductCandidate[];
  chosenSku: string | null;
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

// ─── Add-to-cart job result ───────────────────────────────────────────────────

export type CartActionOutcome =
  | 'added'
  | 'qty_increased'
  | 'already_in_cart'
  | 'failed';

export interface CartActionResult {
  shoppingListItemId: string;
  sku: string;
  requestedQty: number;
  action: CartActionOutcome;
  failureReason?: string;
}

export interface CartJobResult {
  perItem: CartActionResult[];
  cartTotalNzd: number;
  trolleyUrl: string;
}

export interface SendToCartResponse {
  jobId: string;
  skipped: string[];
}

export interface CartResultResponse {
  job: { id: string; status: ScraperJobStatus; error: string | null } | null;
  result: CartJobResult | null;
}
