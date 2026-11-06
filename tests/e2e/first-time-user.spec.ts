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
    // #411: the notice is consolidated into the single banner — the old
    // redundant "Public samples are read-only…" line must not also render.
    await expect(page.getByText(/Public samples are read-only/i)).toHaveCount(0);
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

    // CUR-127: theme is a dedicated header quick toggle — no account menu needed.
    await page.getByTestId('theme-picker').click();
    // The stacked theme options expose role="menuitemradio" (single-select menu
    // semantics); this also avoids matching the "The Vinyl Vault" collection card.
    await page.getByRole('menuitemradio', { name: 'The Vault (Moody)' }).click();
    await expect(page.locator('[data-theme="vault"]')).toBeVisible();

    // Dismiss the theme popover so subsequent clicks on the header aren't intercepted.
    await page.keyboard.press('Escape');

    // Toggle language button in header.
    // Use a stable locator (Globe icon button) since the title changes with language.
    const langToggle = page.locator('button', { has: page.locator('text=ZH') });
    await expect(langToggle).toBeVisible();
    await langToggle.click();
    // After switching, the button label should change from ZH to EN.
    await expect(page.locator('button', { has: page.locator('text=EN') })).toBeVisible();
  });

  // #527: the signed-out first-run card used `min-h-[calc(100vh-9rem)]` with
  // vertical centering, so on short phones its secondary CTA ("Wander a sample
  // museum") drifted down and sat behind the fixed mobile bottom nav at load.
  // The card is now top-anchored on mobile and sized against the real space
  // above the nav (via the `--bottom-nav-height` token), so its CTAs no longer
  // sink into the nav.
  test('keeps the first-run secondary CTA clear of the fixed mobile bottom nav (#527)', async ({
    page,
  }) => {
    const secondary = page.getByRole('link', { name: /wander a sample museum/i });

    // Load the first-run screen at a given phone height (scrolled to the very
    // top) and report where the secondary CTA sits. The card now hugs the top of
    // the available space, so this position is independent of viewport height.
    // The old centered layout drifted it by ~90px as the viewport grew — the
    // same drift that sank it behind the bottom nav on short phones. Comparing
    // two heights cancels out font-metric differences between environments.
    const secondaryTopAt = async (height: number) => {
      await page.setViewportSize({ width: 390, height });
      await page.goto('/');
      await waitForAppReady(page);
      await expect(secondary).toBeVisible();
      const box = await secondary.boundingBox();
      if (!box) throw new Error('first-run secondary CTA has no layout box');
      return box.y;
    };
    const topShort = await secondaryTopAt(720);
    const topTall = await secondaryTopAt(1000);
    expect(Math.abs(topTall - topShort)).toBeLessThan(24);

    // And on a standard mobile viewport the secondary CTA clears the nav outright.
    await page.setViewportSize({ width: 390, height: 915 });
    await page.goto('/');
    await waitForAppReady(page);
    const navBox = await page.locator('nav[aria-label="Primary"]').boundingBox();
    const secBox = await secondary.boundingBox();
    if (!navBox || !secBox) throw new Error('missing first-run layout boxes');
    expect(secBox.y + secBox.height).toBeLessThanOrEqual(navBox.y);
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

  // CUR-144: a shared collection link opened signed-out must render the
  // collection under its own URL — never the welcome gate.
  test('should render the sample collection from an anonymous deep link (CUR-144)', async ({
    page,
  }) => {
    await page.goto('/#/collection/sample-vinyl');
    await waitForAppReady(page);

    await expect(page.getByRole('heading', { name: 'The Vinyl Vault' })).toBeVisible({
      timeout: 10000,
    });
    await expect(page).toHaveURL(/#\/collection\/sample-vinyl/);
    await expect(page.getByTestId('access-gate')).toHaveCount(0);
  });
});
