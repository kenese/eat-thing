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
          totalTimeMinutes: null,
          tags: [],
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
  await page.route('**/api/staples*', (route) => {
    if (route.request().url().includes('/api/staples/low-stock')) {
      return route.fallback();
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });
  await page.route('**/api/foods*', (route) =>
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

  test('inventory route shows low-stock staples from the server', async ({ page }) => {
    await page.unroute('**/api/inventory*');
    await page.unroute('**/api/staples*');
    await page.route('**/api/inventory*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'inv-1',
            householdId: 'h-1',
            canonicalFoodId: 'food-apples',
            foodName: 'Apples',
            brand: null,
            qty: 3,
            unit: 'count',
            category: 'produce',
            purchasedAt: new Date().toISOString(),
            expiresAt: null,
          },
        ]),
      }),
    );
    await page.route('**/api/staples/low-stock*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'staple-rice',
            householdId: 'h-1',
            canonicalFoodId: 'food-rice',
            foodName: 'Rice',
            thresholdQty: 1000,
            thresholdUnit: 'g',
            currentQty: 250,
            neededQty: 750,
          },
        ]),
      }),
    );
    await page.route('**/api/staples*', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
    );

    await Promise.all([
      page.waitForResponse((response) => response.url().includes('/api/staples/low-stock') && response.ok()),
      page.goto('/inventory'),
    ]);
    await expect(page.getByText('Low staples')).toBeVisible();
    await expect(page.getByText('Rice')).toBeVisible();
    await expect(page.getByText('750 g needed')).toBeVisible();
  });

  test('inventory item form only offers canonical storage units', async ({ page }) => {
    await page.goto('/inventory');
    await page.getByRole('button', { name: /add item/i }).click();
    const unitSelect = page.locator('#unit');
    await expect(unitSelect).toBeVisible();
    await expect(unitSelect.locator('option')).toHaveText(['g', 'ml', 'count']);
  });

  test('inventory add prompts for taxonomy review before reusing an existing canonical food', async ({ page }) => {
    let finalInventoryBody: unknown;

    await page.route('**/api/inventory*', async (route) => {
      const { method } = route.request();
      if (method === 'GET') {
        await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
        return;
      }

      const body = route.request().postDataJSON() as { canonicalFoodId?: string } | null;
      if (!body || body.canonicalFoodId !== 'food-1') {
        await route.fulfill({
          status: 409,
          contentType: 'application/json',
          body: JSON.stringify({
            code: 'taxonomy_review_required',
            error: 'Taxonomy review required',
            proposed: { name: 'Dish Soap', category: 'other', defaultUnit: 'count' },
            matches: [{ id: 'food-1', name: 'Dish soap', category: 'other', defaultUnit: 'count' }],
          }),
        });
        return;
      }

      finalInventoryBody = body;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'inv-2',
          householdId: 'h-1',
          canonicalFoodId: 'food-1',
          foodName: 'Dish Soap',
          brand: null,
          qty: 1,
          unit: 'count',
          category: 'other',
          purchasedAt: null,
          expiresAt: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }),
      });
    });

    await page.goto('/inventory');
    await page.getByRole('button', { name: /add item/i }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Food *').fill('Dish Soap');
    await dialog.getByLabel(/quantity/i).fill('1');
    await dialog.getByLabel(/unit/i).selectOption('count');
    await dialog.getByRole('button', { name: /^add item$/i }).click();

    await expect(page.getByRole('button', { name: /use existing: dish soap/i })).toBeVisible();
    await page.getByRole('button', { name: /use existing: dish soap/i }).click();

    await expect.poll(() => finalInventoryBody).not.toBeNull();
    expect(finalInventoryBody).toMatchObject({
      canonicalFoodId: 'food-1',
      qty: 1,
      unit: 'count',
    });
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
          totalTimeMinutes: 25,
          tags: ['quick', 'pasta'],
          instructions: 'Toss pasta with lemon.',
          ingredients: [
            {
              rawText: '1 lemon',
              canonicalFoodId: '00000000-0000-0000-0000-000000000001',
              foodName: 'lemon',
              canonicalDefaultUnit: 'count',
              qty: '1',
              unit: '',
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
          totalTimeMinutes: 25,
          tags: ['quick', 'pasta'],
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

    await expect(page.locator('#totalTimeMinutes')).toHaveValue('25');
    await expect(page.locator('#tags')).toHaveValue('quick, pasta');
    await expect(page.locator('.ingredient-unit').first()).toHaveValue('');
    await expect(page.locator('.ingredient-unit').nth(1)).toHaveValue('count');

    const recipeCreate = page.waitForRequest((request) =>
      request.url().endsWith('/api/recipes') && request.method() === 'POST',
    );
    await page.getByRole('button', { name: /save imported recipe/i }).click();
    const payload = (await recipeCreate).postDataJSON();
    expect(payload.ingredients).toMatchObject([
      { canonicalFoodId: '00000000-0000-0000-0000-000000000001', section: 'Pasta', unit: '' },
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

  test('phone keeps compact navigation in the header without a footer bar', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    await expect(page.locator('.topnav')).toBeVisible();
    await expect(page.locator('.topnav-phone-brand')).toBeVisible();
    await expect(page.getByLabel('Eat thing')).toBeHidden();
    await expect(page.locator('.topnav-icon')).toHaveCount(5);
    await expect(page.getByText('shops', { exact: true })).toBeHidden();
    await expect(page.locator('.bottom-tab-bar')).toHaveCount(0);
  });

  test('tablet keeps the text header layout', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/');

    await expect(page.locator('.topnav')).toBeVisible();
    await expect(page.getByLabel('Eat thing')).toBeVisible();
    await expect(page.locator('.topnav-phone-brand')).toBeHidden();
    await expect(page.getByRole('link', { name: 'inventory' })).toContainText('inventory');
    await expect(page.getByText('shops', { exact: true })).toBeVisible();
    await expect(page.locator('.bottom-tab-bar')).toHaveCount(0);
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

  test('manual shopping-list add prompts for taxonomy review before creating a canonical food', async ({ page }) => {
    let addItemPostCount = 0;
    let createFoodBody: unknown;
    let finalItemBody: unknown;

    await page.route(`**/api/shopping-lists/${LIST_ID}/items`, async (route) => {
      addItemPostCount += 1;
      const body = route.request().postDataJSON();
      if (addItemPostCount === 1) {
        await route.fulfill({
          status: 409,
          contentType: 'application/json',
          body: JSON.stringify({
            code: 'taxonomy_review_required',
            error: 'Taxonomy review required',
            proposed: { name: 'Dish Soap', category: 'other', defaultUnit: 'count' },
            matches: [],
          }),
        });
        return;
      }

      finalItemBody = body;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'sli-new',
          shoppingListId: LIST_ID,
          canonicalFoodId: 'food-new',
          name: 'Dish Soap',
          qty: 1,
          unit: 'count',
          source: 'manual',
          checked: false,
          category: 'other',
          sourceRecipeNames: null,
          sourceRecipeId: null,
        }),
      });
    });
    await page.route('**/api/foods', async (route) => {
      createFoodBody = route.request().postDataJSON();
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'food-new',
          name: 'Dish Soap',
          defaultUnit: 'count',
          aliases: [],
          densityGPerMl: null,
          countToGrams: null,
        }),
      });
    });

    await page.goto('/list');
    await page.getByPlaceholder('Food name or search…').fill('Dish Soap');
    await page.getByRole('spinbutton').fill('1');
    await page.getByRole('button', { name: /\+ add/i }).click();

    await expect(page.getByText('Review this new canonical food before adding it.')).toBeVisible();
    await page.getByRole('button', { name: /create canonical food: dish soap/i }).click();

    await expect.poll(() => addItemPostCount).toBe(2);
    expect(createFoodBody).toMatchObject({
      name: 'Dish Soap',
      category: 'other',
      defaultUnit: 'count',
    });
    expect(finalItemBody).toMatchObject({
      canonicalFoodId: 'food-new',
      name: 'Dish Soap',
      qty: 1,
      unit: 'count',
    });
  });
});
