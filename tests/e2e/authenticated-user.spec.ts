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
    // Account button is in the header on desktop; on mobile, it's the bottom-nav Profile.
    await page
      .getByRole('button', { name: 'Account' })
      .or(page.getByRole('button', { name: 'Profile', exact: true }))
      .first()
      .click();
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
    await page.getByText(/start a collection/i).click();

    await expect(page.getByTestId('create-collection-modal')).toBeVisible();
    await page.getByTestId('create-collection-name').fill('E2E Collection');
    await page.getByRole('button', { name: /create/i }).click();

    await expect(page.getByText('E2E Collection')).toBeVisible({ timeout: 15000 });
    await page.getByText('E2E Collection').click();

    // Add item (manual path — recoverable AI)
    await page.getByRole('button', { name: /add item/i }).click();
    await page.getByText(/skip and add manually/i).click();

    const title = page.getByRole('textbox').first();
    await title.fill('E2E Item');
    await page.getByRole('button', { name: /add to collection/i }).click();

    await expect(page.getByTestId('status-toast')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('status-toast-message')).toContainText(/saved/i);
  });

  test('keeps Save clickable on desktop when the verify fields overflow (CUR-142)', async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, 'Desktop-only regression — the mobile dialog has a definite height');

    // Short desktop viewport so the verify fields panel is guaranteed to
    // overflow the dialog (the CUR-142 geometry: panel taller than its
    // parent, previously painting over the Save footer).
    await page.setViewportSize({ width: 1280, height: 600 });

    await expect(page.getByTestId('collections-grid')).toBeVisible({ timeout: 15000 });
    await page.getByText(/start a collection/i).click();
    await expect(page.getByTestId('create-collection-modal')).toBeVisible();
    const name = `CUR-142 ${Date.now()}`;
    await page.getByTestId('create-collection-name').fill(name);
    await page.getByRole('button', { name: /create/i }).click();

    await expect(page.getByText(name).first()).toBeVisible({ timeout: 15000 });
    await page.getByText(name).first().click();

    await page.getByRole('button', { name: /add item/i }).click();
    await page.getByText(/skip and add manually/i).click();

    await page.getByRole('textbox').first().fill('CUR-142 Item');
    await page.getByRole('textbox').nth(1).fill('A story long enough to keep.');

    // The regression only manifests when the scroll panel actually overflows.
    const scroller = page.getByTestId('add-item-scroll');
    await expect
      .poll(() => scroller.evaluate((el) => el.scrollHeight - el.clientHeight))
      .toBeGreaterThan(0);

    // Before the fix the panel covered the footer: this trial click failed
    // with "subtree intercepts pointer events" and real clicks changed the
    // item's rating instead of saving.
    const save = page.getByRole('button', { name: /add to collection/i });
    await save.click({ trial: true });
    await save.click();

    await expect(page.getByTestId('status-toast')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('status-toast-message')).toContainText(/saved/i);
  });
});
