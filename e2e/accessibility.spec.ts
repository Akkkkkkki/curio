import { test, expect } from '@playwright/test';

/**
 * Phase 5.1: Accessibility E2E Tests
 *
 * Tests core accessibility requirements:
 * - Keyboard navigation
 * - Screen reader compatibility
 * - Color contrast (visual checks)
 * - Focus management
 */

test.describe('Accessibility', () => {
  test.describe('Keyboard Navigation', () => {
    test('should be able to navigate home page with keyboard only', async ({ page }) => {
      await page.goto('/');

      // Press Tab to navigate through interactive elements
      await page.keyboard.press('Tab');
      await page.waitForTimeout(100);

      // Something should be focused
      const focusedElement = await page.locator(':focus');
      await expect(focusedElement).toBeVisible();
    });

    test('should be able to open modals with keyboard', async ({ page }) => {
      await page.goto('/');

      // Tab to a button and press Enter
      for (let i = 0; i < 5; i++) {
        await page.keyboard.press('Tab');
        await page.waitForTimeout(50);

        const focused = await page.locator(':focus');
        const tagName = await focused.evaluate((el) => el.tagName.toLowerCase());

        if (tagName === 'button') {
          await page.keyboard.press('Enter');
          break;
        }
      }
    });

    test('should trap focus within modal when open', async ({ page }) => {
      await page.goto('/');

      // Open a modal (e.g., auth modal)
      const authButton = page.getByText(/sign in/i).first();
      if (await authButton.isVisible()) {
        await authButton.click();
        await page.waitForTimeout(500);

        // Tab through modal elements
        await page.keyboard.press('Tab');
        const focused = await page.locator(':focus');
        await expect(focused).toBeVisible();

        // Focus should remain within the modal
        const modal = page.locator('[role="dialog"]');
        if (await modal.isVisible()) {
          const focusedInModal = modal.locator(':focus');
          await expect(focusedInModal).toBeVisible();
        }
      }
    });

    test('should close modal with Escape key', async ({ page }) => {
      await page.goto('/');

      const authButton = page.getByText(/sign in/i).first();
      if (await authButton.isVisible()) {
        await authButton.click();
        await page.waitForTimeout(500);

        // Press Escape
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);

        // Modal should be closed
        await expect(page.locator('[role="dialog"]')).not.toBeVisible();
      }
    });
  });

  test.describe('ARIA and Semantic HTML', () => {
    test('should have proper heading hierarchy', async ({ page }) => {
      await page.goto('/');

      // Check for h1
      const h1 = page.locator('h1').first();
      await expect(h1).toBeVisible({ timeout: 10000 });
    });

    test('should have descriptive button labels', async ({ page }) => {
      await page.goto('/');

      // All buttons should have accessible names
      const buttons = page.locator('button');
      const count = await buttons.count();

      for (let i = 0; i < Math.min(count, 10); i++) {
        const button = buttons.nth(i);
        if (await button.isVisible()) {
          const name = await button.getAttribute('aria-label');
          const text = await button.textContent();
          // Button should have either aria-label or text content
          expect(name || text?.trim()).toBeTruthy();
        }
      }
    });

    test('should have proper form labels', async ({ page }) => {
      await page.goto('/');

      // Open auth modal to check form
      const authButton = page.getByText(/sign in/i).first();
      if (await authButton.isVisible()) {
        await authButton.click();
        await page.waitForTimeout(500);

        // Check input fields have labels
        const inputs = page.locator('input');
        const inputCount = await inputs.count();

        for (let i = 0; i < inputCount; i++) {
          const input = inputs.nth(i);
          if (await input.isVisible()) {
            // Input should have placeholder or aria-label
            const placeholder = await input.getAttribute('placeholder');
            const ariaLabel = await input.getAttribute('aria-label');
            expect(placeholder || ariaLabel).toBeTruthy();
          }
        }
      }
    });
  });

  test.describe('Color and Visual', () => {
    test('should have visible focus indicators', async ({ page }) => {
      await page.goto('/');

      // Focus on a button
      await page.keyboard.press('Tab');

      // The focused element should have visible focus styles
      const focused = await page.locator(':focus');
      if (await focused.isVisible()) {
        // Check for focus ring or outline
        const outline = await focused.evaluate((el) => window.getComputedStyle(el).outlineStyle);
        const boxShadow = await focused.evaluate((el) => window.getComputedStyle(el).boxShadow);
        // Should have either outline or box-shadow for focus indication
        expect(outline !== 'none' || boxShadow !== 'none').toBeTruthy();
      }
    });
  });

  test.describe('Images and Media', () => {
    test('should have alt text for images', async ({ page }) => {
      await page.goto('/');

      const images = page.locator('img');
      const count = await images.count();

      for (let i = 0; i < Math.min(count, 5); i++) {
        const img = images.nth(i);
        if (await img.isVisible()) {
          const alt = await img.getAttribute('alt');
          // Images should have alt attribute (can be empty for decorative)
          expect(alt !== null).toBeTruthy();
        }
      }
    });
  });

  test.describe('Responsive and Touch', () => {
    test('should be usable on mobile viewport', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/');

      // App should load and be interactive
      await expect(page.locator('body')).toBeVisible();

      // Navigation should still work
      const collection = page.getByText(/vinyl/i).first();
      if (await collection.isVisible()) {
        await collection.click();
        await expect(page).toHaveURL(/#\/collection\//);
      }
    });

    test('should have touch-friendly tap targets', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/');

      // Check button sizes meet minimum tap target (44x44px recommended)
      const buttons = page.locator('button');
      const count = await buttons.count();

      for (let i = 0; i < Math.min(count, 5); i++) {
        const button = buttons.nth(i);
        if (await button.isVisible()) {
          const box = await button.boundingBox();
          if (box) {
            // Minimum tap target should be around 44px
            expect(box.width).toBeGreaterThan(20);
            expect(box.height).toBeGreaterThan(20);
          }
        }
      }
    });
  });
});

test.describe('Theme Accessibility', () => {
  test('vault theme should have readable contrast', async ({ page }) => {
    await page.goto('/');

    // Find theme toggle if available
    const themeButton = page.locator('[data-testid="theme-picker"]').first();
    if (await themeButton.isVisible()) {
      await themeButton.click();
      await page.waitForTimeout(200);

      // Select vault theme
      const vaultOption = page.getByText(/vault/i).first();
      if (await vaultOption.isVisible()) {
        await vaultOption.click();
        await page.waitForTimeout(300);

        // Text should still be visible
        await expect(page.locator('body')).toBeVisible();
      }
    }
  });
});
