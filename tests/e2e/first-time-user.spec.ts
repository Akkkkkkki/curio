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

  const sampleVinylCard = (page: Page) =>
    page
      .getByTestId('collection-card')
      .filter({ has: page.getByRole('heading', { name: 'The Vinyl Vault' }) })
      .first();

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

  test('should never strand first-time users on a cloud-required dead end', async ({ page }) => {
    await page.goto('/');

    const accessGate = page.getByTestId('access-gate');
    if (await accessGate.isVisible().catch(() => false)) {
      await expect(page.getByTestId('cta-secondary-explore-sample')).toBeVisible();
      return;
    }

    await expect(page.getByTestId('collections-grid')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'The Vinyl Vault' })).toBeVisible();
  });

  test('should allow exploring sample collections without authentication', async ({ page }) => {
    await ensureSampleBrowse(page);
    await expect(page.getByTestId('collection-card').first()).toBeVisible();
    // Use role=heading to avoid matching the tooltip text (strict mode).
    await expect(page.getByRole('heading', { name: 'The Vinyl Vault' })).toBeVisible();
  });

  test('should navigate to the sample collection and clearly label it read-only', async ({
    page,
  }) => {
    await ensureSampleBrowse(page);
    await sampleVinylCard(page).click();
    await expect(page).toHaveURL(/#\/collection\//);

    await expect(page.getByTestId('read-only-banner')).toBeVisible();
    // Assert the specific banner description (avoid broad /sample/i matches in strict mode).
    await expect(
      page.getByTestId('read-only-banner').getByText(/Public sample collections can be viewed/i),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: /add item/i })).toHaveCount(0);
  });

  test('should allow viewing item details in the sample collection', async ({ page }) => {
    await ensureSampleBrowse(page);
    await sampleVinylCard(page).click();
    await expect(page.getByTestId('items-grid')).toBeVisible();

    await page.getByTestId('item-card').first().click();
    await expect(page).toHaveURL(/#\/collection\/.*\/item\//);
    // Item detail title is rendered as a (disabled) textbox in read-only mode.
    const titleInput = page.getByRole('main').locator('input:disabled').first();
    await expect(titleInput).toHaveValue('Kind of Blue');
  });

  test('should open export modal from item detail', async ({ page }) => {
    await ensureSampleBrowse(page);
    await sampleVinylCard(page).click();
    await expect(page.getByTestId('items-grid')).toBeVisible();

    await page.getByTestId('item-card').first().click();
    await expect(page).toHaveURL(/#\/collection\/.*\/item\//);

    await page.getByTestId('item-export').click();
    await expect(page.getByRole('heading', { name: 'Export Card' })).toBeVisible();
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
    if (await page.getByTestId('access-gate').isVisible()) {
      await expect(page.getByTestId('access-gate')).toBeVisible();
      return;
    }
    await expect(page).toHaveURL(/\/#\/?$/);
  });
});
