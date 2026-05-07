import { test, expect } from '@playwright/test';

test.describe('Counter REST Syncing', () => {
    test('increments the counter via TanStack query', async ({ page }) => {
        await page.goto('http://localhost:5173/');

        // Ensure the initial data is fetched
        await expect(page.locator('.counter-display')).toBeVisible();

        // Get the initial text
        const initialText = await page.locator('.counter-value').innerText();
        const initialValue = parseInt(initialText, 10);

        // Increment the counter
        const incrementBtn = page.getByRole('button', { name: 'Increment' });
        await incrementBtn.click();

        // Verify Tab shows the incremented value
        const expectedValue = String(initialValue + 1);
        await expect(page.locator('.counter-value')).toHaveText(expectedValue);
        
        // Reset the counter
        const resetBtn = page.getByRole('button', { name: 'Reset' });
        await resetBtn.click();
        
        await expect(page.locator('.counter-value')).toHaveText('0');
    });
});
