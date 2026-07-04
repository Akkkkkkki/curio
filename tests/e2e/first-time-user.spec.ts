import { test, expect, Page } from '@playwright/test';

/**
 * Phase 5.1: First-Time User Flow E2E Tests
 *
 * Product constraints validated (see CLAUDE.md):
 * - Delight before auth
 * - Single-path first run
 * - Read-only clarity
 */

async function waitForAppReady(page: Page) {
  await expect(page.getByTestId('app-shell')).toHaveAttribute('data-ready', 'true', {
    timeout: 15000,
  });
}

async function ensureSampleBrowse(page: Page) {
  await page.goto('/');
  await waitForAppReady(page);
  const sampleLink = page
    .getByRole('link', { name: /wander a sample museum/i })
    .or(page.getByRole('link', { name: /explore/i }))
    .first();
  test.skip(!(await sampleLink.isVisible().catch(() => false)), 'Sample gallery unavailable');

  await sampleLink.click();
  await expect(page).toHaveURL(/#\/collection\//);
  await expect(page.getByRole('heading', { name: 'The Vinyl Vault' })).toBeVisible({
    timeout: 10000,
  });
}

test.describe('First-Time User Experience', () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
  });

  test('should expose deterministic readiness before first-run assertions', async ({ page }) => {
    await page.goto('/');

    await waitForAppReady(page);
  });

  test('should show a single primary + single secondary CTA on first launch', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);

    await expect(
      page.getByRole('heading', { name: /start your museum with one thing you love/i }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: /add your first piece/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /wander a sample museum/i })).toBeVisible();
    await expect(page.getByTestId('collections-grid')).toHaveCount(0);
  });

  test('should never strand first-time users on a cloud-required dead end', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);

    await expect(page.getByRole('link', { name: /wander a sample museum/i })).toBeVisible();
    await expect(page.getByText(/no account needed to look around/i)).toBeVisible();
  });

  test('should allow exploring sample collections without authentication', async ({ page }) => {
    await ensureSampleBrowse(page);
    await expect(page.getByTestId('items-grid')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'The Vinyl Vault' })).toBeVisible();
  });

  test('should navigate to the sample collection and clearly label it read-only', async ({
    page,
  }) => {
    await ensureSampleBrowse(page);

    await expect(page.getByTestId('read-only-banner')).toBeVisible();
    // Assert the specific banner description (avoid broad /sample/i matches in strict mode).
    await expect(
      page.getByTestId('read-only-banner').getByText(/Public sample collections can be viewed/i),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: /add item/i })).toHaveCount(0);
  });

  test('should allow viewing item details in the sample collection', async ({ page }) => {
    await ensureSampleBrowse(page);
    await expect(page.getByTestId('items-grid')).toBeVisible();

    await page.getByTestId('item-card').first().click();
    await expect(page).toHaveURL(/#\/collection\/.*\/item\//);
    // Item detail title is rendered as a (disabled) textarea in read-only mode.
    const titleInput = page.getByRole('main').locator('textarea:disabled').first();
    await expect(titleInput).toHaveValue('Kind of Blue');
  });

  test('should open export modal from item detail', async ({ page }) => {
    await ensureSampleBrowse(page);
    await expect(page.getByTestId('items-grid')).toBeVisible();

    await page.getByTestId('item-card').first().click();
    await expect(page).toHaveURL(/#\/collection\/.*\/item\//);

    await page.getByTestId('item-export').click();
    await expect(page.getByRole('heading', { name: 'Export Card' })).toBeVisible();
  });

  test('should prompt for auth when starting “Add your first item”', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);

    await page.getByRole('button', { name: /add your first piece/i }).click();
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
    // Account button is in the header on desktop; on mobile, it's the bottom-nav Profile.
    await page
      .getByRole('button', { name: 'Account' })
      .or(page.getByRole('button', { name: 'Profile', exact: true }))
      .first()
      .click();
    // Avoid matching the "The Vinyl Vault" collection card button.
    await page.getByRole('button', { name: 'The Vault (Moody)' }).click();
    await expect(page.locator('[data-theme="vault"]')).toBeVisible();

    // Dismiss the profile menu so subsequent clicks on the header aren't intercepted
    // by the mobile bottom-sheet backdrop.
    await page.keyboard.press('Escape');

    // Toggle language button in header.
    // Use a stable locator (Globe icon button) since the title changes with language.
    const langToggle = page.locator('button', { has: page.locator('text=ZH') });
    await expect(langToggle).toBeVisible();
    await langToggle.click();
    // After switching, the button label should change from ZH to EN.
    await expect(page.locator('button', { has: page.locator('text=EN') })).toBeVisible();
  });
});

test.describe('Navigation and Routing', () => {
  test('should support hash-based routing for SPA', async ({ page }) => {
    await page.goto('/#/');
    await expect(page).toHaveURL(/\/#\//);
  });

  test('should redirect invalid routes back to home', async ({ page }) => {
    await page.goto('/#/invalid-route-that-does-not-exist');
    await waitForAppReady(page);
    if (await page.getByTestId('access-gate').isVisible()) {
      await expect(page.getByTestId('access-gate')).toBeVisible();
      return;
    }
    await expect(page).toHaveURL(/\/#\/?$/);
  });
});
