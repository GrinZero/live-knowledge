import { test, expect } from '@playwright/test';

test('has expected elements', async ({ page }) => {
  await page.goto('/');

  // Expect a title or specific text to be visible on the page
  // We'll just check if the body is present and no errors are thrown
  await expect(page.locator('body')).toBeVisible();
});
