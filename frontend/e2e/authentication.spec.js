import { test, expect } from '@playwright/test';

test('sign-in requires credentials and offers backend roles', async ({ page }) => {
  await page.goto('/signin');
  await expect(page.getByRole('heading', { name: 'Sign in to TRACE' })).toBeVisible();
  await expect(page.getByLabel('Account role')).toHaveValue('client');
  await expect(page.getByLabel('Work email')).toHaveValue('');
  await expect(page.getByLabel('Password')).toHaveValue('');
});

test('registration only offers self-service backend roles', async ({ page }) => {
  await page.goto('/signup');
  await expect(page.getByRole('heading', { name: 'Create your account' })).toBeVisible();
  const roles = await page.getByLabel('Account role').locator('option').allTextContents();
  expect(roles).toEqual(['Client', 'Independent auditor']);
  await expect(page.getByLabel('Full name')).toHaveValue('');
  await expect(page.getByLabel('Organization')).toHaveValue('');
});
