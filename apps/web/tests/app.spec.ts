import { test, expect } from '@playwright/test';

test('page title is eat-thing', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('eat-thing');
});

test('top nav shows eat-thing brand', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('eat-thing').first()).toBeVisible();
});

test('health endpoint returns ok', async ({ request }) => {
  const res = await request.get('/api/health');
  expect(res.ok()).toBe(true);
  expect(await res.json()).toEqual({ status: 'ok' });
});

test('unknown routes redirect to home', async ({ page }) => {
  await page.goto('/this-route-does-not-exist');
  await expect(page).toHaveURL('/');
});
