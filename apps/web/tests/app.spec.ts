import { test, expect, type Page } from '@playwright/test';

function isoDate(d: Date) { return d.toISOString().slice(0, 10); }
function mondayOf(d: Date) { const day = d.getDay(); const diff = (day + 6) % 7; const m = new Date(d); m.setDate(m.getDate() - diff); return m; }
const thisMonday = isoDate(mondayOf(new Date()));
const thisTuesday = isoDate(new Date(new Date(thisMonday).setDate(new Date(thisMonday).getDate() + 1)));

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
  await page.route('**/api/recipes*', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
  );
  await page.route('**/api/meal-plans*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        weekStart: thisMonday,
        mealPlanId: 'plan-1',
        entries: [
          { id: 'entry-1', mealPlanId: 'plan-1', date: thisTuesday, recipeId: 'recipe-1', recipeName: 'Pasta', servings: 4, status: 'planned' },
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

  test('redirects / to /inventory', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/inventory$/);
  });

  test('inventory route loads', async ({ page }) => {
    await page.goto('/inventory');
    await expect(page.getByRole('heading', { level: 1, name: 'Inventory' })).toBeVisible();
  });

  test('recipes route loads', async ({ page }) => {
    await page.goto('/recipes');
    await expect(page.getByRole('heading', { level: 1, name: 'Recipes' })).toBeVisible();
  });

  test('plan route loads', async ({ page }) => {
    await page.goto('/plan');
    await expect(page.getByRole('heading', { level: 1, name: 'This week' })).toBeVisible();
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

  test('recipes page shows Import button that opens import modal', async ({ page }) => {
    await page.goto('/recipes');
    const importBtn = page.getByRole('button', { name: /import/i });
    await expect(importBtn).toBeVisible();
    await importBtn.click();
    await expect(page.getByRole('heading', { name: /import recipe/i })).toBeVisible();
    await expect(page.getByRole('button', { name: 'URL', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Photo', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Search', exact: true })).toBeVisible();
    // close modal
    await page.keyboard.press('Escape');
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
