import { test, expect, Page } from '@playwright/test';

/**
 * Phase 5.2: Authenticated User Flow (Playwright)
 *
 * These tests require real Supabase credentials.
 * Provide:
 * - E2E_EMAIL
 * - E2E_PASSWORD
 */

const E2E_EMAIL = process.env.E2E_EMAIL;
const E2E_PASSWORD = process.env.E2E_PASSWORD;

async function signIn(page: Page) {
  await page.goto('/');

  // Open auth modal from the access gate when present; otherwise from the account menu.
  const gate = page.getByTestId('access-gate');
  if (await gate.isVisible()) {
    await page.getByTestId('cta-primary-add-first').click();
  } else {
    await page.getByRole('button', { name: 'Account' }).click();
    await page.getByRole('button', { name: /login/i }).click();
  }

  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByPlaceholder('curator@museum.com').fill(E2E_EMAIL!);
  await page.getByPlaceholder('••••••••').fill(E2E_PASSWORD!);
  await page.getByRole('button', { name: /login/i }).click();

  await expect(page.getByRole('dialog')).toBeHidden({ timeout: 15000 });
}

test.describe('Authenticated User Experience', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!E2E_EMAIL || !E2E_PASSWORD, 'E2E_EMAIL/E2E_PASSWORD not set');
    await signIn(page);
  });

  test('should show explicit “Saved” feedback after adding an item', async ({ page }) => {
    // Create a new collection
    await expect(page.getByTestId('collections-grid')).toBeVisible({ timeout: 15000 });
    await page.getByText(/new archive/i).click();

    await expect(page.getByTestId('create-collection-modal')).toBeVisible();
    await page.getByTestId('create-collection-name').fill('E2E Archive');
    await page.getByRole('button', { name: /create/i }).click();

    await expect(page.getByText('E2E Archive')).toBeVisible({ timeout: 15000 });
    await page.getByText('E2E Archive').click();

    // Add item (manual path — recoverable AI)
    await page.getByRole('button', { name: /add item/i }).click();
    await page.getByText(/skip and add manually/i).click();

    const title = page.getByRole('textbox').first();
    await title.fill('E2E Item');
    await page.getByRole('button', { name: /add to collection/i }).click();

    await expect(page.getByTestId('status-toast')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('status-toast-message')).toContainText(/saved/i);
  });
});
