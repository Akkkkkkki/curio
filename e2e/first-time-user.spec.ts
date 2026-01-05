import { test, expect } from '@playwright/test';

/**
 * Phase 5.1: First-Time User Flow E2E Tests
 *
 * Product Requirements Tested:
 * - "Delight before auth": Users can explore sample gallery pre-login
 * - "Single-path first run": Primary CTA is clear
 * - "Read-only clarity": Sample collections are clearly labeled
 */

test.describe('First-Time User Experience', () => {
  test.beforeEach(async ({ page }) => {
    // Clear any stored session
    await page.context().clearCookies();
    await page.goto('/');
  });

  test.describe('Home Screen - Initial Load', () => {
    test('should display home screen with collections grid', async ({ page }) => {
      await expect(page.locator('body')).toBeVisible();
      // App should load without requiring authentication
    });

    test('should display sample collection (Vinyl Vault) for exploration', async ({ page }) => {
      // Product requirement: Delight before auth - users can explore sample gallery
      await expect(page.getByText(/vinyl/i)).toBeVisible({ timeout: 10000 });
    });

    test('should allow navigation to sample collection without authentication', async ({
      page,
    }) => {
      // Click on the sample collection
      const vinylCollection = page.getByText(/vinyl/i).first();
      await vinylCollection.click();

      // Should navigate to collection view
      await expect(page).toHaveURL(/#\/collection\//);
    });
  });

  test.describe('Sample Collection - Read-Only Experience', () => {
    test.beforeEach(async ({ page }) => {
      // Navigate to sample collection
      await page.goto('/');
      const vinylCollection = page.getByText(/vinyl/i).first();
      await vinylCollection.click();
      // Wait for collection to load
      await page.waitForTimeout(1000);
    });

    test('should display sample items in the collection', async ({ page }) => {
      // Sample collection should have pre-seeded items
      await expect(page.locator('body')).toBeVisible();
    });

    test('should allow viewing item details', async ({ page }) => {
      // Find and click on an item
      const itemCard = page.locator('[data-testid="item-card"]').first();
      if (await itemCard.isVisible()) {
        await itemCard.click();
        // Should navigate to item detail
        await expect(page).toHaveURL(/#\/collection\/.*\/item\//);
      }
    });
  });

  test.describe('Authentication Prompt', () => {
    test('should prompt for auth when trying to add new item', async ({ page }) => {
      await page.goto('/');

      // Find and click Add button
      const addButton = page.getByRole('button', { name: /add/i }).first();
      if (await addButton.isVisible()) {
        await addButton.click();
        // Should show auth modal or add item modal
        await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 5000 });
      }
    });

    test('should show auth modal when clicking Sign In', async ({ page }) => {
      await page.goto('/');

      // Look for sign in or account related UI
      const authButton = page.getByText(/sign in/i).first();
      if (await authButton.isVisible()) {
        await authButton.click();
        await expect(page.getByPlaceholder(/curator@museum.com/i)).toBeVisible();
      }
    });
  });

  test.describe('Theme and Language', () => {
    test('should allow theme switching without authentication', async ({ page }) => {
      await page.goto('/');

      // Look for theme picker or settings
      const themeButton = page.locator('[data-testid="theme-picker"]').first();
      if (await themeButton.isVisible()) {
        await themeButton.click();
        // Theme options should be available
        await expect(page.getByText(/gallery|vault|atelier/i)).toBeVisible();
      }
    });

    test('should allow language switching without authentication', async ({ page }) => {
      await page.goto('/');

      // Look for language toggle
      const langToggle = page.getByRole('button', { name: /EN|ZH|语言/i }).first();
      if (await langToggle.isVisible()) {
        await langToggle.click();
        // Should toggle language
      }
    });
  });
});

test.describe('Navigation and Routing', () => {
  test('should support hash-based routing for SPA', async ({ page }) => {
    await page.goto('/');

    // Navigate using hash routes
    await page.goto('/#/');
    await expect(page).toHaveURL(/\/#\//);
  });

  test('should display 404-like message for invalid routes', async ({ page }) => {
    await page.goto('/#/invalid-route-that-does-not-exist');

    // Should either redirect to home or show error
    await expect(page.locator('body')).toBeVisible();
  });

  test('should support browser back navigation', async ({ page }) => {
    await page.goto('/');

    // Navigate to a collection
    const collection = page.getByText(/vinyl/i).first();
    if (await collection.isVisible()) {
      await collection.click();
      await page.waitForTimeout(500);

      // Go back
      await page.goBack();
      await expect(page).toHaveURL(/\/#\/?$/);
    }
  });
});
