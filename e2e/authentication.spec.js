import { test, expect } from '@playwright/test';

test('sign-in is Google-only and has no password or role fields', async ({ page }) => {
  await page.goto('/signin');
  await expect(page.getByRole('heading', { name: 'Sign in to TRACE' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible();
  await expect(page.getByLabel('Password')).toHaveCount(0);
  await expect(page.getByLabel('Account role')).toHaveCount(0);
});

test('self-registration redirects to Google sign-in', async ({ page }) => {
  await page.goto('/signup');
  await expect(page).toHaveURL(/\/signin$/);
  await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible();
});
