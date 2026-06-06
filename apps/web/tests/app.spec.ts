import { test, expect, type Page } from '@playwright/test';

function isoDate(d: Date) { return d.toISOString().slice(0, 10); }
function localIsoDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function fullDayLabel(d: Date) {
  const weekday = d.toLocaleDateString(undefined, { weekday: 'long' });
  const month = d.toLocaleDateString(undefined, { month: 'long' });
  return `${weekday} ${d.getDate()} ${month} ${d.getFullYear()}`;
}
function shortDayLabel(d: Date) {
  return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}
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

  test('plan page expands a day card into a tray on click', async ({ page }) => {
    await page.goto('/plan');
    // Detail actions live in the tray now, not on hover — hidden until the card is expanded.
    await expect(page.getByTitle('Mark cooked')).toHaveCount(0);
    await expect(page.locator('.day-tray')).toHaveCount(0);

    await page.locator('.day-col-name', { hasText: 'Pasta' }).click();

    await expect(page.locator('.day-tray')).toBeVisible();
    await expect(page.getByRole('button', { name: /open recipe/i })).toBeVisible();
    await expect(page.getByTitle('Mark cooked')).toBeVisible();
  });

  test('plan page shows cook modal when mark cooked is clicked', async ({ page }) => {
    await page.goto('/plan');
    // Mark cooked now lives in the expand tray — open the card first.
    await page.locator('.day-col-name', { hasText: 'Pasta' }).click();
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

  test('plan load date recenters the 17-day rail around a distant date', async ({ page }) => {
    const selectedDate = new Date();
    selectedDate.setMonth(selectedDate.getMonth() + 1, 15);
    selectedDate.setHours(0, 0, 0, 0);
    const selectedIso = localIsoDate(selectedDate);
    const expectedFrom = localIsoDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate() - 2));
    const expectedTo = localIsoDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate() + 14));

    await page.unroute('**/api/meal-plans/entries*');
    await page.route('**/api/meal-plans/entries*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ entries: [] }),
      });
    });

    await page.goto('/plan');
    await page.getByRole('button', { name: 'Load date' }).click();
    await page.getByRole('button', { name: 'Next month' }).click();
    await page.getByRole('button', { name: fullDayLabel(selectedDate) }).click();
    const recenteredRequest = page.waitForRequest((request) => {
      const url = new URL(request.url());
      return (
        url.pathname === '/api/meal-plans/entries' &&
        url.searchParams.get('from') === expectedFrom &&
        url.searchParams.get('to') === expectedTo
      );
    });
    await page.getByRole('button', { name: `choose ${fullDayLabel(selectedDate).toLowerCase()}` }).click();
    await recenteredRequest;

    await expect(page.locator(`.day-col[data-iso="${selectedIso}"]`)).toBeVisible();
    const metrics = await page.locator('.plan-week-scroll').evaluate((node, iso) => {
      const rail = node as HTMLDivElement;
      const target = rail.querySelector(`.day-col[data-iso="${iso}"]`) as HTMLDivElement | null;
      if (!target) return null;
      return {
        scrollLeft: rail.scrollLeft,
        clientWidth: rail.clientWidth,
        targetLeft: target.offsetLeft,
        targetRight: target.offsetLeft + target.offsetWidth,
      };
    }, selectedIso);

    expect(metrics).not.toBeNull();
    expect(metrics?.scrollLeft ?? 0).toBeGreaterThan(0);
    expect((metrics?.targetLeft ?? 0) >= (metrics?.scrollLeft ?? 0)).toBe(true);
    expect((metrics?.targetRight ?? 0) <= ((metrics?.scrollLeft ?? 0) + (metrics?.clientWidth ?? 0))).toBe(true);
  });

  test('plan auto-shop preview opens with an empty state when the plan is already covered', async ({ page }) => {
    await page.goto('/plan');
    await page.getByRole('button', { name: /add recipes to list/i }).click();
    await expect(page.getByRole('dialog', { name: 'Auto-shop preview' })).toBeVisible();
    await expect(page.getByText('Everything in the current plan window is covered by inventory.')).toBeVisible();
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

  test('recipes hero adds the featured recipe to the next empty day without opening a picker', async ({ page }) => {
    let mealPlanPostBody: unknown;

    await page.unroute('**/api/recipes*');
    await page.route('**/api/recipes/recipe-hero', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'recipe-hero',
            householdId: 'h-1',
            name: 'Herby Pasta',
            servings: 3,
            sourceUrl: null,
            sourceImage: null,
            totalTimeMinutes: 25,
            tags: [],
            instructions: null,
            ingredients: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ][0]),
      }),
    );
    await page.route('**/api/recipes', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'recipe-hero',
            householdId: 'h-1',
            name: 'Herby Pasta',
            servings: 3,
            sourceUrl: null,
            sourceImage: null,
            ingredientCount: 4,
            totalTimeMinutes: 25,
            tags: [],
            canonicalFoodIds: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ]),
      }),
    );
    await page.unroute('**/api/meal-plans/entries*');
    await page.route('**/api/meal-plans/entries*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ entries: [] }),
      }),
    );
    await page.route('**/api/meal-plans/entries', async (route) => {
      if (route.request().method() !== 'POST') return route.fallback();
      mealPlanPostBody = route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'entry-new',
          date: todayIso,
          recipeId: 'recipe-hero',
          recipeName: 'Herby Pasta',
          servings: 3,
          status: 'planned',
        }),
      });
    });

    await page.goto('/recipes');
    await page.waitForResponse((response) => response.url().includes('/api/recipes/recipe-hero') && response.ok());
    const [todayIso, addedLabel] = await page.evaluate(() => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const localIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      return [
        localIso,
        today.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' }),
      ];
    });
    await page.getByRole('button', { name: 'add to next open day' }).click();

    await expect.poll(() => mealPlanPostBody).not.toBeUndefined();
    expect(mealPlanPostBody).toMatchObject({
      date: todayIso,
      recipeId: 'recipe-hero',
      servings: 3,
    });
    await expect(page.getByRole('button', { name: `added to ${addedLabel}` })).toBeVisible();
    await expect(page.getByRole('dialog', { name: 'Choose a date' })).toHaveCount(0);
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
  scheduledFor: null,
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

  test('shows the Mac-mini sign-in prompt when New World session is expired', async ({ page }) => {
    await page.route(`**/api/shopping-lists/${LIST_ID}/prices`, route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          prices: [],
          job: {
            id: 'job-expired',
            status: 'failed',
            error: 'session_expired',
            retrying: false,
            failure: {
              code: 'session_expired',
              message: 'New World session expired',
              retryable: false,
              attempt: 1,
              maxAttempts: 3,
            },
          },
        }),
      }),
    );

    await page.goto('/list');

    await expect(page.getByText(/new world needs you to sign in again on the mac mini/i)).toBeVisible();
    await expect(page.getByText(/re-run bootstrap and ingest your session/i)).toBeVisible();
  });

  test('shows retrying status while a New World price job is retried', async ({ page }) => {
    await page.route(`**/api/shopping-lists/${LIST_ID}/prices`, route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          prices: [],
          job: {
            id: 'job-retrying',
            status: 'in_progress',
            error: null,
            retrying: true,
            failure: {
              code: 'navigation_timeout',
              message: 'Navigation timed out',
              retryable: true,
              attempt: 2,
              maxAttempts: 3,
            },
          },
        }),
      }),
    );

    await page.goto('/list');

    await expect(page.getByText(/retrying price check at new world/i)).toBeVisible();
    await expect(page.getByText(/attempt 2 of 3/i)).toBeVisible();
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

  test('scheduled shopping date updates Recipes quick-shop copy', async ({ page }) => {
    let scheduledFor: string | null = null;
    const listWithDate = () => ({ ...FAKE_SHOPPING_LIST, scheduledFor });

    await page.route(`**/api/shopping-lists/current`, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(listWithDate()),
      }),
    );
    await page.route(`**/api/shopping-lists/${LIST_ID}`, async (route) => {
      if (route.request().method() !== 'PATCH') return route.fallback();
      scheduledFor = route.request().postDataJSON().scheduledFor;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(listWithDate()),
      });
    });
    await page.unroute('**/api/recipes*');
    await page.route('**/api/recipes/recipe-shop', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'recipe-shop',
          householdId: 'h-1',
          name: 'Fish tacos',
          servings: 4,
          sourceUrl: null,
          sourceImage: null,
          totalTimeMinutes: null,
          tags: [],
          instructions: null,
          ingredients: [
            { id: 'ing-1', canonicalFoodId: 'food-extra', foodName: 'extra', qty: '1', unit: 'count', originalQty: '1', originalUnit: 'count', section: null, optional: false },
          ],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }),
      }),
    );
    await page.route('**/api/recipes', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{
          id: 'recipe-shop',
          householdId: 'h-1',
          name: 'Fish tacos',
          servings: 4,
          sourceUrl: null,
          sourceImage: null,
          ingredientCount: 1,
          totalTimeMinutes: null,
          tags: [],
          canonicalFoodIds: ['food-extra'],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }]),
      }),
    );

    await page.goto('/list');
    await page.getByRole('button', { name: /set shop date/i }).click();
    await expect(page.getByRole('dialog', { name: /choose a date/i })).toBeVisible();
    await page.getByRole('button', { name: /friday 5 june 2026/i }).click();
    await page.getByRole('button', { name: /choose friday 5 june 2026/i }).click();

    await expect.poll(() => scheduledFor).toBe('2026-06-05');
    await expect(page.getByRole('button', { name: /shop fri 5 jun/i })).toBeVisible();

    await page.getByRole('link', { name: 'recipes' }).click();
    await expect(page.getByText(/1 quick shop for fri 5 jun/i)).toBeVisible();
    await expect(page.getByText(/add to your fri 5 jun list/i)).toBeVisible();
  });
});
