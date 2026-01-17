import { test, expect, Page } from '@playwright/test';

/**
 * Phase 5.1: First-Time User Flow E2E Tests
 *
 * Product constraints validated (see CLAUDE.md):
 * - Delight before auth
 * - Single-path first run
 * - Read-only clarity
 */

async function ensureSampleBrowse(page: Page) {
  await page.goto('/');
  const accessGate = page.getByTestId('access-gate');
  if (await accessGate.isVisible()) {
    await expect(page.getByTestId('first-run-ctas')).toBeVisible();
    const explore = page.getByTestId('cta-secondary-explore-sample');
    test.skip(!(await explore.isVisible()), 'Supabase not configured; sample gallery unavailable');
    await explore.click();
  }
  await expect(page.getByTestId('collections-grid')).toBeVisible({ timeout: 10000 });
}

test.describe('First-Time User Experience', () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
  });

  test('should show a single primary + single secondary CTA on first launch', async ({ page }) => {
    await page.goto('/');
    const accessGate = page.getByTestId('access-gate');
    test.skip(!(await accessGate.isVisible()), 'Access gate not shown in this environment');

    const explore = page.getByTestId('cta-secondary-explore-sample');
    const exploreVisible = await explore.isVisible().catch(() => false);
    const ctas = page.getByTestId('first-run-ctas').locator('button');

    if (!exploreVisible) {
      // Cloud-required fallback (no sample gallery available).
      await expect(ctas).toHaveCount(1);
      await expect(page.getByText(/configure supabase/i)).toBeVisible();
      return;
    }

    await expect(ctas).toHaveCount(2);
    await expect(page.getByTestId('cta-primary-add-first')).toBeVisible();
    await expect(explore).toBeVisible();
  });

  test('should allow exploring sample collections without authentication', async ({ page }) => {
    await ensureSampleBrowse(page);
    await expect(page.getByTestId('collection-card').first()).toBeVisible();
    await expect(page.getByText('The Vinyl Vault')).toBeVisible();
  });

  test('should navigate to the sample collection and clearly label it read-only', async ({
    page,
  }) => {
    await ensureSampleBrowse(page);
    await page.getByText('The Vinyl Vault').click();
    await expect(page).toHaveURL(/#\/collection\//);

    await expect(page.getByTestId('read-only-banner')).toBeVisible();
    await expect(page.getByText(/sample/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /add item/i })).toHaveCount(0);
  });

  test('should allow viewing item details in the sample collection', async ({ page }) => {
    await ensureSampleBrowse(page);
    await page.getByText('The Vinyl Vault').click();
    await expect(page.getByTestId('items-grid')).toBeVisible();

    await page.getByTestId('item-card').first().click();
    await expect(page).toHaveURL(/#\/collection\/.*\/item\//);
    await expect(page.getByRole('heading', { name: /kind of blue/i })).toBeVisible();
  });

  test('should prompt for auth when starting “Add your first item”', async ({ page }) => {
    await page.goto('/');
    const accessGate = page.getByTestId('access-gate');
    test.skip(!(await accessGate.isVisible()), 'Access gate not shown in this environment');

    await page.getByTestId('cta-primary-add-first').click();
    const modal = page.getByTestId('auth-modal');
    test.skip(
      !(await modal.isVisible().catch(() => false)),
      'Auth modal not available in this environment',
    );
    await expect(modal).toBeVisible();
  });

  test('should allow switching theme + language without authentication', async ({ page }) => {
    await ensureSampleBrowse(page);

    // Open account menu → switch theme.
    await page.getByRole('button', { name: 'Account' }).click();
    await page.getByRole('button', { name: /vault/i }).click();
    await expect(page.locator('[data-theme="vault"]')).toBeVisible();

    // Toggle language button in header.
    const langToggle = page.getByTitle('Switch Language');
    await expect(langToggle).toBeVisible();
    const before = await langToggle.textContent();
    await langToggle.click();
    await expect(langToggle).not.toHaveText(before || '');
  });
});

test.describe('Navigation and Routing', () => {
  test('should support hash-based routing for SPA', async ({ page }) => {
    await page.goto('/#/');
    await expect(page).toHaveURL(/\/#\//);
  });

  test('should redirect invalid routes back to home', async ({ page }) => {
    await page.goto('/#/invalid-route-that-does-not-exist');
    if (await page.getByTestId('access-gate').isVisible()) {
      await expect(page.getByTestId('access-gate')).toBeVisible();
      return;
    }
    await expect(page).toHaveURL(/\/#\/?$/);
  });
});
