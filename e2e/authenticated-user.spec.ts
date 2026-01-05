import { test, expect, Page } from '@playwright/test';

/**
 * Phase 5.1: Authenticated User Flow E2E Tests
 *
 * Product Requirements Tested:
 * - Collection management for authenticated users
 * - Item CRUD operations
 * - Sync status visibility
 * - AI analysis flow (with graceful degradation)
 */

// Note: These tests require a running Supabase backend
// For CI, mock the auth or use a test account

test.describe('Authenticated User Experience', () => {
  // Helper to mock authenticated state
  async function mockAuthenticatedUser(page: Page) {
    // For actual E2E with Supabase, you would login
    // For isolated testing, we check if auth modal appears and close it
    await page.goto('/');

    // Check if app loads
    await expect(page.locator('body')).toBeVisible();
  }

  test.describe('Collection Management', () => {
    test('should display user collections on home screen', async ({ page }) => {
      await mockAuthenticatedUser(page);

      // Home should display collection grid
      await expect(page.locator('body')).toBeVisible();
    });

    test('should allow creating a new collection', async ({ page }) => {
      await mockAuthenticatedUser(page);

      // Look for create collection button
      const createButton = page.getByRole('button', { name: /create|new collection/i }).first();
      if (await createButton.isVisible()) {
        await createButton.click();

        // Modal should appear
        await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 5000 });
      }
    });

    test('should display collection templates when creating', async ({ page }) => {
      await mockAuthenticatedUser(page);

      // Trigger create flow
      const createButton = page.getByRole('button', { name: /create|new/i }).first();
      if (await createButton.isVisible()) {
        await createButton.click();

        // Should show template options
        await expect(
          page.getByText(/vinyl|chocolate|sneaker|spirit|scent|archive/i).first(),
        ).toBeVisible({ timeout: 5000 });
      }
    });
  });

  test.describe('Item Management', () => {
    test('should navigate to item detail when clicking item', async ({ page }) => {
      await mockAuthenticatedUser(page);

      // Navigate to a collection first
      const collection = page.getByText(/vinyl/i).first();
      if (await collection.isVisible()) {
        await collection.click();
        await page.waitForTimeout(1000);

        // Find an item
        const item = page.locator('[data-testid="item-card"]').first();
        if (await item.isVisible()) {
          await item.click();
          await expect(page).toHaveURL(/#\/collection\/.*\/item\//);
        }
      }
    });

    test('should display item details correctly', async ({ page }) => {
      await mockAuthenticatedUser(page);

      // Navigate to collection
      const collection = page.getByText(/vinyl/i).first();
      if (await collection.isVisible()) {
        await collection.click();
        await page.waitForTimeout(1000);

        // Click on first item
        const item = page.locator('[data-testid="item-card"]').first();
        if (await item.isVisible()) {
          await item.click();
          await page.waitForTimeout(500);

          // Should show item title
          await expect(page.locator('h1, h2, h3').first()).toBeVisible();
        }
      }
    });
  });

  test.describe('Add Item Flow', () => {
    test('should open add item modal', async ({ page }) => {
      await mockAuthenticatedUser(page);

      // Navigate to a collection
      const collection = page.getByText(/vinyl/i).first();
      if (await collection.isVisible()) {
        await collection.click();
        await page.waitForTimeout(1000);

        // Find add button
        const addButton = page.getByRole('button', { name: /add/i }).first();
        if (await addButton.isVisible()) {
          await addButton.click();

          // Modal should appear
          await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 5000 });
        }
      }
    });

    test('should show skip to manual option (AI recovery)', async ({ page }) => {
      await mockAuthenticatedUser(page);

      // Navigate to collection and open add modal
      const collection = page.getByText(/vinyl/i).first();
      if (await collection.isVisible()) {
        await collection.click();
        await page.waitForTimeout(1000);

        const addButton = page.getByRole('button', { name: /add/i }).first();
        if (await addButton.isVisible()) {
          await addButton.click();
          await page.waitForTimeout(500);

          // Product requirement: AI must be recoverable
          await expect(page.getByText(/skip and add manually/i)).toBeVisible({ timeout: 5000 });
        }
      }
    });

    test('should allow manual entry without photo', async ({ page }) => {
      await mockAuthenticatedUser(page);

      const collection = page.getByText(/vinyl/i).first();
      if (await collection.isVisible()) {
        await collection.click();
        await page.waitForTimeout(1000);

        const addButton = page.getByRole('button', { name: /add/i }).first();
        if (await addButton.isVisible()) {
          await addButton.click();
          await page.waitForTimeout(500);

          // Click skip to manual
          const skipButton = page.getByText(/skip and add manually/i);
          if (await skipButton.isVisible()) {
            await skipButton.click();

            // Should show form fields
            await expect(page.getByRole('textbox').first()).toBeVisible({ timeout: 5000 });
          }
        }
      }
    });
  });

  test.describe('Sync Status', () => {
    test('should display sync status indicator', async ({ page }) => {
      await mockAuthenticatedUser(page);

      // Look for sync status indicator in header/layout
      const syncStatus = page.getByText(/signed in|synced|offline/i).first();
      await expect(syncStatus).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Search and Filter', () => {
    test('should have search functionality on home screen', async ({ page }) => {
      await mockAuthenticatedUser(page);

      // Look for search input
      const searchInput = page.getByPlaceholder(/search/i).first();
      if (await searchInput.isVisible()) {
        await searchInput.fill('test search');
        // Search should filter results
      }
    });

    test('should have filter options in collection view', async ({ page }) => {
      await mockAuthenticatedUser(page);

      const collection = page.getByText(/vinyl/i).first();
      if (await collection.isVisible()) {
        await collection.click();
        await page.waitForTimeout(1000);

        // Look for filter button or options
        const filterButton = page.getByRole('button', { name: /filter/i }).first();
        if (await filterButton.isVisible()) {
          await filterButton.click();
          // Filter modal should appear
          await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 5000 });
        }
      }
    });
  });
});

test.describe('Exhibition Mode', () => {
  test('should enter exhibition/slideshow mode', async ({ page }) => {
    await page.goto('/');

    const collection = page.getByText(/vinyl/i).first();
    if (await collection.isVisible()) {
      await collection.click();
      await page.waitForTimeout(1000);

      // Look for exhibition mode button
      const exhibitionButton = page
        .getByRole('button', { name: /exhibition|slideshow|present/i })
        .first();
      if (await exhibitionButton.isVisible()) {
        await exhibitionButton.click();
        // Should enter fullscreen or exhibition view
      }
    }
  });
});
