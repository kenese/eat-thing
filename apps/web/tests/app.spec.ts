import { test, expect, type Page } from '@playwright/test';

function isoDate(d: Date) { return d.toISOString().slice(0, 10); }
const tomorrow = isoDate(new Date(Date.now() + 86400000));

const FAKE_SESSION = {
  user: {
    id: 'test-user',
    email: 'test@example.com',
    name: 'Test User',
    emailVerified: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  session: {
    id: 'test-session',
    userId: 'test-user',
    expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
  },
};

async function stubAuthedShell(page: Page) {
  await page.route('**/api/auth/get-session', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(FAKE_SESSION) }),
  );
  await page.route('**/api/inventory*', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
  );
  await page.route('**/api/recipes*', (route) => {
    if (route.request().url().includes('/api/recipes/recipe-1')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'recipe-1',
          householdId: 'h-1',
          name: 'Pasta',
          servings: 4,
          sourceUrl: null,
          sourceImage: null,
          instructions: null,
          ingredients: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }),
      });
    }

    return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });
  await page.route('**/api/meal-plans/entries*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        entries: [
          { id: 'entry-1', date: tomorrow, recipeId: 'recipe-1', recipeName: 'Pasta', servings: 4, status: 'planned' },
        ],
      }),
    }),
  );
  await page.route('**/api/cook-events/preview*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        mealPlanEntryId: 'entry-1',
        recipeId: 'recipe-1',
        servings: 4,
        deductions: [{ inventoryItemId: 'inv-1', canonicalFoodId: 'food-1', foodName: 'Pasta', qty: 400, unit: 'g' }],
        prompts: [],
      }),
    }),
  );
  await page.route('**/api/shopping-lists*', (route) =>
    route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'No shopping list found' }) }),
  );
  await page.route('**/api/staples*', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
  );
}

test('page title is eat-thing', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('eat-thing');
});

test('health endpoint returns ok', async ({ request }) => {
  const res = await request.get('/api/health');
  expect(res.ok()).toBe(true);
  expect(await res.json()).toEqual({ status: 'ok' });
});

test.describe('unauthenticated', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/auth/get-session', (route) =>
      route.fulfill({ status: 401, contentType: 'application/json', body: 'null' }),
    );
  });

  test('shows login page when no session', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: /sign in with google/i })).toBeVisible();
  });

  test('local dev session can enter the app without OAuth', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /continue locally/i }).click();
    await expect(page.getByRole('heading', { level: 1, name: /cook from what's already/i })).toBeVisible();
    await expect(page.getByText('baby spinach')).toBeVisible();
    await expect(page.getByText('shopping list · ready')).toBeVisible();
    await expect(page.locator('.shop-preview-total')).toBeVisible();
  });

  test('clicking sign in posts to better-auth social endpoint', async ({ page }) => {
    await page.goto('/');
    const signInPost = page.waitForRequest(
      (req) => req.url().includes('/api/auth/sign-in/social') && req.method() === 'POST',
    );
    await page.getByRole('button', { name: /sign in with google/i }).click();
    const req = await signInPost;
    expect(req.postDataJSON()).toMatchObject({ provider: 'google' });
  });
});

test.describe('authenticated routes load', () => {
  test.beforeEach(async ({ page }) => {
    await stubAuthedShell(page);
  });

  test('home route loads', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1, name: /cook from what's already/i })).toBeVisible();
  });

  test('inventory route loads', async ({ page }) => {
    await page.goto('/inventory');
    await expect(page.getByRole('heading', { level: 1, name: 'Inventory' })).toBeVisible();
  });

  test('inventory item form only offers canonical storage units', async ({ page }) => {
    await page.goto('/inventory');
    await page.getByRole('button', { name: /add item/i }).click();
    const unitSelect = page.locator('#unit');
    await expect(unitSelect).toBeVisible();
    await expect(unitSelect.locator('option')).toHaveText(['g', 'ml', 'count']);
  });

  test('recipes route loads', async ({ page }) => {
    await page.goto('/recipes');
    await expect(page.getByRole('heading', { level: 1, name: 'Recipes' })).toBeVisible();
  });

  test('plan route loads', async ({ page }) => {
    await page.goto('/plan');
    await expect(page.getByRole('heading', { level: 1, name: 'Plan' })).toBeVisible();
  });

  test('list route loads', async ({ page }) => {
    await page.goto('/list');
    await expect(page.getByRole('heading', { level: 1, name: 'The list' })).toBeVisible();
  });

  test('unknown route redirects to inventory', async ({ page }) => {
    await page.goto('/this-route-does-not-exist');
    await expect(page).toHaveURL(/\/inventory$/);
  });

  test('plan page shows cook modal when mark cooked is clicked', async ({ page }) => {
    await page.goto('/plan');
    await page.getByTitle('Mark cooked').first().click();
    await expect(page.getByRole('heading', { name: /mark.*cooked/i })).toBeVisible();
    await expect(page.getByText('Will deduct from inventory')).toBeVisible();
  });

  test('plan page labels full days with the 4-recipe cap', async ({ page }) => {
    await page.route('**/api/meal-plans/entries*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          entries: [
            { id: 'entry-1', date: tomorrow, recipeId: 'recipe-1', recipeName: 'Pasta', servings: 4, status: 'planned' },
            { id: 'entry-2', date: tomorrow, recipeId: 'recipe-1', recipeName: 'Pasta', servings: 4, status: 'planned' },
            { id: 'entry-3', date: tomorrow, recipeId: 'recipe-1', recipeName: 'Pasta', servings: 4, status: 'planned' },
            { id: 'entry-4', date: tomorrow, recipeId: 'recipe-1', recipeName: 'Pasta', servings: 4, status: 'planned' },
          ],
        }),
      }),
    );

    await page.goto('/plan');
    await expect(page.getByText('max 4 recipes')).toBeVisible();
  });

  test('recipes page shows Import button that opens import modal', async ({ page }) => {
    await page.goto('/recipes');
    const importBtn = page.getByRole('button', { name: /import/i });
    await expect(importBtn).toBeVisible();
    await importBtn.click();
    await expect(page.getByRole('heading', { name: /import recipe/i })).toBeVisible();
    await expect(page.getByRole('button', { name: 'URL', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'photo', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'search', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'meal planner', exact: true })).toBeVisible();
    // close modal
    await page.keyboard.press('Escape');
  });

  test('recipes page imports duplicate sectioned ingredients into the confirmation form', async ({ page }) => {
    await page.route('**/api/ingest/meal-planner', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'meal-planner-1',
            title: 'Lemon Pasta',
            source: 'Meal Planner',
            servings: 3,
            ingredientCount: 2,
            alreadyImported: false,
          },
        ]),
      }),
    );
    await page.route('**/api/ingest/meal-planner/parse', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          name: 'Lemon Pasta',
          servings: 3,
          sourceUrl: null,
          sourceImage: null,
          heroImageUrl: null,
          instructions: 'Toss pasta with lemon.',
          ingredients: [
            {
              rawText: '1 lemon',
              canonicalFoodId: '00000000-0000-0000-0000-000000000001',
              foodName: 'lemon',
              canonicalDefaultUnit: 'count',
              qty: '1',
              unit: 'count',
              section: 'Pasta',
              optional: false,
              confidence: 'high',
            },
            {
              rawText: '1 lemon',
              canonicalFoodId: '00000000-0000-0000-0000-000000000001',
              foodName: 'lemon',
              canonicalDefaultUnit: 'count',
              qty: '1',
              unit: 'count',
              section: 'Sauce',
              optional: false,
              confidence: 'high',
            },
          ],
        }),
      }),
    );
    await page.route('**/api/recipes', async (route) => {
      if (route.request().method() !== 'POST') return route.fallback();
      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'recipe-lemon',
          householdId: 'h-1',
          name: 'Lemon Pasta',
          servings: 3,
          sourceUrl: null,
          sourceImage: null,
          instructions: 'Toss pasta with lemon.',
          ingredients: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }),
      });
    });

    await page.goto('/recipes');
    await page.getByRole('button', { name: /import/i }).click();
    await page.getByRole('button', { name: 'meal planner', exact: true }).click();
    await expect(page.getByText('Lemon Pasta')).toBeVisible();

    await page.getByRole('button', { name: 'import', exact: true }).click();

    await expect(page.getByRole('heading', { name: /review imported recipe/i })).toBeVisible();
    await expect(page.locator('#name')).toHaveValue('Lemon Pasta');
    await expect(page.locator('#servings')).toHaveValue('3');
    await expect(page.locator('.ingredients-grid .ingredient-name', { hasText: 'lemon' })).toHaveCount(2);

    const recipeCreate = page.waitForRequest((request) =>
      request.url().endsWith('/api/recipes') && request.method() === 'POST',
    );
    await page.getByRole('button', { name: /save imported recipe/i }).click();
    const payload = (await recipeCreate).postDataJSON();
    expect(payload.ingredients).toMatchObject([
      { canonicalFoodId: '00000000-0000-0000-0000-000000000001', section: 'Pasta' },
      { canonicalFoodId: '00000000-0000-0000-0000-000000000001', section: 'Sauce' },
    ]);
  });

  test('top nav links navigate between routes', async ({ page }) => {
    await page.goto('/inventory');
    await page.getByRole('link', { name: 'recipes' }).click();
    await expect(page).toHaveURL(/\/recipes$/);
    await page.getByRole('link', { name: 'plan' }).click();
    await expect(page).toHaveURL(/\/plan$/);
    await page.getByRole('link', { name: 'list' }).click();
    await expect(page).toHaveURL(/\/list$/);
    await page.getByRole('link', { name: 'inventory' }).click();
    await expect(page).toHaveURL(/\/inventory$/);
  });
});

// ─── Shopping list: find products + manual pick + send to cart ─────────────────

const LIST_ID = 'sl-1';

const FAKE_SHOPPING_LIST = {
  id: LIST_ID,
  householdId: 'h-1',
  createdAt: '2026-05-12T09:14:00.000Z',
  finalizedAt: null,
  items: [
    {
      id: 'sli-1',
      shoppingListId: LIST_ID,
      canonicalFoodId: 'food-bread',
      name: 'bread',
      qty: 1,
      unit: 'count',
      source: 'manual',
      checked: false,
      category: 'pantry',
      sourceRecipeNames: null,
      sourceRecipeId: null,
    },
    {
      id: 'sli-2',
      shoppingListId: LIST_ID,
      canonicalFoodId: 'food-milk',
      name: 'milk',
      qty: 2,
      unit: 'count',
      source: 'staple',
      checked: false,
      category: 'dairy',
      sourceRecipeNames: null,
      sourceRecipeId: null,
    },
  ],
};

const CANDIDATE_A = {
  sku: 'NW001',
  name: 'Tip Top White Bread',
  brand: 'Tip Top',
  packSize: { qty: 700, unit: 'g' },
  price: 3.49,
  unitPrice: { value: 0.499, per: 'g' },
  inStock: true,
  onSpecial: false,
  cartQty: 1,
  resolution: 'manual',
};

const CANDIDATE_B = {
  sku: 'NW002',
  name: 'Vogels Mixed Grain',
  brand: 'Vogels',
  packSize: { qty: 750, unit: 'g' },
  price: 5.99,
  unitPrice: { value: 0.799, per: 'g' },
  inStock: true,
  onSpecial: false,
  cartQty: 1,
  resolution: 'manual',
};

const SOLE_CANDIDATE = {
  sku: 'NW003',
  name: 'Anchor Blue Top Milk 2L',
  brand: 'Anchor',
  packSize: { qty: 2, unit: 'count' },
  price: 4.5,
  unitPrice: null,
  inStock: true,
  onSpecial: false,
  cartQty: 2,
  resolution: 'sole',
};

const PRICES_WITH_PICKS_NEEDED = {
  job: { id: 'job-1', status: 'done', error: null },
  prices: [
    {
      id: 'price-1',
      shoppingListItemId: 'sli-1',
      store: 'new_world',
      sku: null,
      name: null,
      price: null,
      inStock: false,
      matched: false,
      checkedAt: '2026-05-12T09:14:00.000Z',
      candidates: [CANDIDATE_A, CANDIDATE_B],
      chosenSku: null,
    },
    {
      id: 'price-2',
      shoppingListItemId: 'sli-2',
      store: 'new_world',
      sku: SOLE_CANDIDATE.sku,
      name: SOLE_CANDIDATE.name,
      price: SOLE_CANDIDATE.price,
      inStock: true,
      matched: true,
      checkedAt: '2026-05-12T09:14:00.000Z',
      candidates: [SOLE_CANDIDATE],
      chosenSku: SOLE_CANDIDATE.sku,
    },
  ],
};

const PRICES_AFTER_PICK = {
  ...PRICES_WITH_PICKS_NEEDED,
  prices: [
    {
      ...PRICES_WITH_PICKS_NEEDED.prices[0],
      sku: CANDIDATE_A.sku,
      name: CANDIDATE_A.name,
      price: CANDIDATE_A.price,
      inStock: true,
      matched: true,
      candidates: [CANDIDATE_A, CANDIDATE_B],
      chosenSku: CANDIDATE_A.sku,
    },
    PRICES_WITH_PICKS_NEEDED.prices[1],
  ],
};

const CART_RESULT_DONE = {
  job: { id: 'j1', status: 'done', error: null },
  result: {
    perItem: [
      {
        shoppingListItemId: 'sli-1',
        sku: 'NW001',
        requestedQty: 1,
        action: 'added',
      },
    ],
    cartTotalNzd: 12.34,
    trolleyUrl: 'https://www.newworld.co.nz/shop/trolley',
  },
};

test.describe('shopping list — find products + manual pick + send to cart', () => {
  test.beforeEach(async ({ page }) => {
    await stubAuthedShell(page);

    // Override the broad shopping-list stub with a real list response.
    // Playwright uses LIFO route ordering, so these more-specific handlers
    // registered after stubAuthedShell will be checked first.
    await page.route(`**/api/shopping-lists/current`, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(FAKE_SHOPPING_LIST),
      }),
    );
    await page.route(`**/api/shopping-lists/${LIST_ID}/prices`, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(PRICES_WITH_PICKS_NEEDED),
      }),
    );
    // Cart result starts as no-job so the reconcile modal is not shown on load
    await page.route(`**/api/shopping-lists/${LIST_ID}/cart-result`, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ job: null, result: null }),
      }),
    );
  });

  test('badges render: "Pick one" for manual-resolution row, "Sole match" for sole row', async ({ page }) => {
    await page.goto('/list');
    // Use locator scoped to the badge class to avoid the hint text match
    await expect(page.locator('.row-badge', { hasText: 'Pick one' })).toBeVisible();
    await expect(page.locator('.row-badge', { hasText: 'Sole match' })).toBeVisible();
  });

  test('Show options expands candidates for the "Pick one" row', async ({ page }) => {
    await page.goto('/list');
    await expect(page.getByText('Tip Top White Bread')).not.toBeVisible();
    await page.getByRole('button', { name: /show options/i }).click();
    await expect(page.getByText('Tip Top White Bread')).toBeVisible();
    await expect(page.getByText('Vogels Mixed Grain')).toBeVisible();
  });

  test('clicking a candidate sends PATCH to chosen-sku and Send to cart becomes enabled', async ({ page }) => {
    let pickedSkuBody: unknown;

    // Register the chosen-sku route BEFORE goto so it is ready from the start.
    // The broad **/api/shopping-lists* from stubAuthedShell was registered earlier
    // and Playwright LIFO means our later routes take priority.
    await page.route(`**/api/shopping-lists/items/sli-1/chosen-sku`, async (route) => {
      pickedSkuBody = route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, chosenSku: CANDIDATE_A.sku }),
      });
    });

    // Override prices: first call returns unpicked state; subsequent calls return picked state.
    let priceCallCount = 0;
    await page.route(`**/api/shopping-lists/${LIST_ID}/prices`, async (route) => {
      priceCallCount++;
      const body = priceCallCount === 1 ? PRICES_WITH_PICKS_NEEDED : PRICES_AFTER_PICK;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(body),
      });
    });

    await page.goto('/list');

    // Set up the waitForRequest listener BEFORE triggering the action
    const patchPromise = page.waitForRequest(
      (req) =>
        req.url().includes('/api/shopping-lists/items/sli-1/chosen-sku') &&
        req.method() === 'PATCH',
      { timeout: 10000 },
    );

    // Expand candidates and click the first option
    await page.getByRole('button', { name: /show options/i }).click();
    await page.getByRole('button', { name: /Tip Top White Bread/i }).click();

    // Wait for PATCH request and verify body
    await patchPromise;
    expect(pickedSkuBody).toMatchObject({ sku: 'NW001' });

    // After TanStack Query invalidation the prices re-fetch returns PRICES_AFTER_PICK.
    // Reload to simulate the UI re-rendering with the updated (all-picked) prices.
    await page.reload();
    await expect(page.getByRole('button', { name: /send to cart/i })).toBeEnabled();
  });

  test('clicking Send to cart POSTs to send-to-cart and reconcile modal renders', async ({ page }) => {
    // Use fully-picked prices from the start so Send to cart is enabled
    await page.route(`**/api/shopping-lists/${LIST_ID}/prices`, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(PRICES_AFTER_PICK),
      }),
    );

    // send-to-cart returns a job id; cart-result stays as null until we're ready
    let cartResultCallCount = 0;
    await page.route(`**/api/shopping-lists/${LIST_ID}/send-to-cart`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ jobId: 'j1', skipped: [] }),
      });
    });

    // Cart result: first call returns pending (so modal is not pre-opened), then done
    await page.route(`**/api/shopping-lists/${LIST_ID}/cart-result`, async (route) => {
      cartResultCallCount++;
      const body = cartResultCallCount <= 1
        ? { job: null, result: null }
        : CART_RESULT_DONE;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(body),
      });
    });

    await page.goto('/list');

    const sendBtn = page.getByRole('button', { name: /send to cart/i });
    await expect(sendBtn).toBeEnabled();

    // Set up POST listener before clicking
    const postPromise = page.waitForRequest(
      (req) =>
        req.url().includes(`/api/shopping-lists/${LIST_ID}/send-to-cart`) &&
        req.method() === 'POST',
      { timeout: 10000 },
    );

    await sendBtn.click();
    await postPromise;

    // Reconcile modal appears once cart result is 'done'
    const modal = page.getByRole('dialog', { name: /cart updated/i });
    await expect(modal).toBeVisible({ timeout: 15000 });
    // perItem row: action 'added' → label 'Added' (scoped to modal to avoid "you added" tab label)
    await expect(modal.getByText('Added', { exact: true })).toBeVisible();
    // Trolley link
    await expect(modal.getByRole('link', { name: /Open New World trolley/i })).toBeVisible();
  });
});
