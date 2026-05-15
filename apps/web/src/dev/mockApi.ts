import type {
  InventoryRow,
  MealPlanWeek,
  Recipe,
  ShoppingList,
  PricesForListResponse,
} from '@eat/shared';

const HOUSEHOLD_ID = 'dev-household';
const LIST_ID = 'dev-list';

function ts(day: string) {
  return `${day}T09:00:00.000Z`;
}

function inventoryRow(
  id: string,
  foodName: string,
  canonicalFoodId: string,
  qty: number,
  unit: InventoryRow['unit'],
  location: InventoryRow['location'],
  expiresAt: string | null,
): InventoryRow {
  return {
    id,
    householdId: HOUSEHOLD_ID,
    canonicalFoodId,
    foodName,
    qty,
    unit,
    brand: null,
    location,
    purchasedAt: null,
    expiresAt,
    createdAt: ts('2026-05-10'),
    updatedAt: ts('2026-05-12'),
  };
}

const inventory: InventoryRow[] = [
  inventoryRow('inv-spinach', 'baby spinach', 'food-spinach', 180, 'g', 'fridge', '2026-05-13'),
  inventoryRow('inv-mushroom', 'mushrooms', 'food-mushrooms', 250, 'g', 'fridge', '2026-05-14'),
  inventoryRow('inv-yoghurt', 'greek yoghurt', 'food-yoghurt', 500, 'g', 'fridge', '2026-05-15'),
  inventoryRow('inv-broccoli', 'broccoli', 'food-broccoli', 1, 'count', 'fridge', '2026-05-16'),
  inventoryRow('inv-rice', 'arborio rice', 'food-rice', 600, 'g', 'pantry', null),
  inventoryRow('inv-stock', 'vegetable stock', 'food-stock', 1_000, 'ml', 'pantry', null),
  inventoryRow('inv-pasta', 'pasta', 'food-pasta', 500, 'g', 'pantry', null),
  inventoryRow('inv-parmesan', 'parmesan', 'food-parmesan', 80, 'g', 'fridge', '2026-05-18'),
];

function recipe(
  id: string,
  name: string,
  ingredients: Array<{ canonicalFoodId: string; foodName: string; qty: number; unit: Recipe['ingredients'][number]['unit'] }>,
): Recipe {
  return {
    id,
    householdId: HOUSEHOLD_ID,
    name,
    servings: 4,
    sourceUrl: null,
    sourceImage: null,
    instructions: null,
    ingredients: ingredients.map((ingredient, index) => ({
      id: `${id}-ingredient-${index + 1}`,
      recipeId: id,
      canonicalFoodId: ingredient.canonicalFoodId,
      foodName: ingredient.foodName,
      qty: String(ingredient.qty),
      unit: ingredient.unit,
      section: null,
      metricValue: null,
      optional: false,
      sortOrder: index,
    })),
    createdAt: ts('2026-05-10'),
    updatedAt: ts('2026-05-12'),
  };
}

const recipes: Record<string, Recipe> = {
  'recipe-risotto': recipe('recipe-risotto', 'Spinach risotto', [
    { canonicalFoodId: 'food-spinach', foodName: 'baby spinach', qty: 120, unit: 'g' },
    { canonicalFoodId: 'food-rice', foodName: 'arborio rice', qty: 320, unit: 'g' },
    { canonicalFoodId: 'food-stock', foodName: 'vegetable stock', qty: 750, unit: 'ml' },
  ]),
  'recipe-tacos': recipe('recipe-tacos', 'Fish tacos', [
    { canonicalFoodId: 'food-fish', foodName: 'white fish', qty: 500, unit: 'g' },
    { canonicalFoodId: 'food-tortillas', foodName: 'tortillas', qty: 8, unit: 'count' },
    { canonicalFoodId: 'food-yoghurt', foodName: 'greek yoghurt', qty: 120, unit: 'g' },
  ]),
  'recipe-pasta': recipe('recipe-pasta', 'Mushroom pasta', [
    { canonicalFoodId: 'food-mushrooms', foodName: 'mushrooms', qty: 200, unit: 'g' },
    { canonicalFoodId: 'food-pasta', foodName: 'pasta', qty: 400, unit: 'g' },
    { canonicalFoodId: 'food-parmesan', foodName: 'parmesan', qty: 50, unit: 'g' },
  ]),
};

function addDays(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function mealPlan(weekStart: string): MealPlanWeek {
  return {
    weekStart,
    mealPlanId: 'dev-plan',
    entries: [
      { id: 'entry-risotto', mealPlanId: 'dev-plan', date: addDays(weekStart, 0), recipeId: 'recipe-risotto', recipeName: 'Spinach risotto', servings: 4, status: 'planned' },
      { id: 'entry-tacos', mealPlanId: 'dev-plan', date: addDays(weekStart, 1), recipeId: 'recipe-tacos', recipeName: 'Fish tacos', servings: 4, status: 'planned' },
      { id: 'entry-pasta', mealPlanId: 'dev-plan', date: addDays(weekStart, 2), recipeId: 'recipe-pasta', recipeName: 'Mushroom pasta', servings: 4, status: 'planned' },
    ],
  };
}

const shoppingList: ShoppingList = {
  id: LIST_ID,
  householdId: HOUSEHOLD_ID,
  generatedFromMealPlanId: 'dev-plan',
  createdAt: '2026-05-12T09:14:00',
  finalizedAt: null,
  items: [
    { id: 'shop-fish', shoppingListId: LIST_ID, canonicalFoodId: 'food-fish', name: 'white fish', qty: 500, unit: 'g', source: 'recipe', checked: false, category: 'meat' },
    { id: 'shop-tortillas', shoppingListId: LIST_ID, canonicalFoodId: 'food-tortillas', name: 'tortillas', qty: 8, unit: 'count', source: 'recipe', checked: false, category: 'pantry' },
    { id: 'shop-limes', shoppingListId: LIST_ID, canonicalFoodId: 'food-limes', name: 'limes', qty: 3, unit: 'count', source: 'recipe', checked: false, category: 'produce' },
    { id: 'shop-coriander', shoppingListId: LIST_ID, canonicalFoodId: 'food-coriander', name: 'coriander', qty: 1, unit: 'count', source: 'recipe', checked: false, category: 'produce' },
    { id: 'shop-milk', shoppingListId: LIST_ID, canonicalFoodId: 'food-milk', name: 'milk', qty: 2, unit: 'count', source: 'staple', checked: false, category: 'dairy' },
  ],
};

const prices: PricesForListResponse = {
  job: { id: 'dev-price-job', status: 'done', error: null },
  prices: [
    { id: 'price-fish', shoppingListItemId: 'shop-fish', store: 'new_world', sku: 'fish-001', name: 'Fresh white fish fillets', price: 14.5, inStock: true, matched: true, checkedAt: ts('2026-05-12') },
    { id: 'price-tortillas', shoppingListItemId: 'shop-tortillas', store: 'new_world', sku: 'tortilla-001', name: 'Flour tortillas 8 pack', price: 4.2, inStock: true, matched: true, checkedAt: ts('2026-05-12') },
    { id: 'price-limes', shoppingListItemId: 'shop-limes', store: 'new_world', sku: 'lime-001', name: 'Limes', price: 1.1, inStock: true, matched: true, checkedAt: ts('2026-05-12') },
    { id: 'price-coriander', shoppingListItemId: 'shop-coriander', store: 'new_world', sku: 'coriander-001', name: 'Fresh coriander', price: 3.0, inStock: true, matched: true, checkedAt: ts('2026-05-12') },
    { id: 'price-milk', shoppingListItemId: 'shop-milk', store: 'new_world', sku: 'milk-001', name: 'Milk 2L', price: 5.1, inStock: true, matched: true, checkedAt: ts('2026-05-12') },
  ],
};

export function getDevMockResponse(path: string): unknown | null {
  if (path.startsWith('/api/inventory')) return inventory;
  if (path.startsWith('/api/meal-plans')) {
    const weekStart = new URL(`http://local${path}`).searchParams.get('weekStart') ?? '2026-05-11';
    return mealPlan(weekStart);
  }
  if (path.startsWith('/api/shopping-lists') && !path.includes('/prices')) return shoppingList;
  if (path === `/api/shopping-lists/${LIST_ID}/prices`) return prices;

  const recipeMatch = path.match(/^\/api\/recipes\/([^/]+)$/);
  if (recipeMatch) return recipes[recipeMatch[1]] ?? null;

  if (path === '/api/recipes') {
    return Object.values(recipes).map((r) => ({
      id: r.id,
      name: r.name,
      servings: r.servings,
      sourceUrl: r.sourceUrl,
      sourceImage: r.sourceImage,
      ingredientCount: r.ingredients.length,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));
  }

  return null;
}
