import { test, expect } from '@playwright/test';

test('public landing does not render workspace records', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Every audit finding/i })).toBeVisible();
  await expect(page.locator('table')).toHaveCount(0);
});

test('workspace data is not rendered without an authenticated backend session', async ({ page }) => {
  await page.goto('/app/client/documents');
  await expect(page).toHaveURL(/\/signin$/);
  await expect(page.getByRole('heading', { name: 'Sign in to TRACE' })).toBeVisible();
});
