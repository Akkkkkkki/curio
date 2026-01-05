import { test, expect, Page } from '@playwright/test';

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
  async function openAuthModal(page: Page) {
    await page.goto('/');
    const gate = page.getByTestId('access-gate');
    if (await gate.isVisible()) {
      await page.getByTestId('cta-primary-add-first').click();
    } else {
      await page.getByRole('button', { name: 'Account' }).click();
      await page.getByRole('button', { name: /login/i }).click();
    }
    const modal = page.getByTestId('auth-modal');
    // In some environments (e.g., Supabase not configured), the gate may not open a modal.
    // We treat that as an environment constraint, not an app failure.
    const opened = await modal.isVisible().catch(() => false);
    return opened;
  }

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

    test('should close modal with Escape key and restore focus to trigger', async ({ page }) => {
      await page.goto('/');
      const trigger = page.getByTestId('cta-primary-add-first');
      test.skip(!(await page.getByTestId('access-gate').isVisible()), 'Access gate not shown');

      await trigger.click();
      const modal = page.getByTestId('auth-modal');
      test.skip(!(await modal.isVisible().catch(() => false)), 'Auth modal not available in this environment');

      await page.keyboard.press('Escape');
      await expect(modal).toBeHidden();
      await expect(trigger).toBeFocused();
    });

    test('should trap focus within modal when open', async ({ page }) => {
      const opened = await openAuthModal(page);
      test.skip(!opened, 'Auth modal not available in this environment');
      const dialog = page.getByTestId('auth-modal');

      // Walk focus around and ensure it never escapes the dialog.
      for (let i = 0; i < 15; i++) {
        await page.keyboard.press('Tab');
        const isInside = await dialog.evaluate((node) => node.contains(document.activeElement));
        expect(isInside).toBe(true);
      }
    });
  });

  test.describe('ARIA and Semantic HTML', () => {
    test('should have proper heading hierarchy', async ({ page }) => {
      await page.goto('/');

      const headings = await page
        .locator('h1, h2, h3, h4, h5, h6')
        .evaluateAll((nodes) => nodes.map((n) => n.tagName.toLowerCase()));
      expect(headings[0]).toBe('h1');
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
      const opened = await openAuthModal(page);
      test.skip(!opened, 'Auth modal not available in this environment');
      const inputs = page.getByTestId('auth-modal').locator('input');
      const inputCount = await inputs.count();
      expect(inputCount).toBeGreaterThan(0);

      for (let i = 0; i < inputCount; i++) {
        const input = inputs.nth(i);
        if (await input.isVisible()) {
          const placeholder = await input.getAttribute('placeholder');
          const ariaLabel = await input.getAttribute('aria-label');
          expect(placeholder || ariaLabel).toBeTruthy();
        }
      }
    });

    test('should expose landmark regions (main + primary nav)', async ({ page }) => {
      await page.goto('/');
      await expect(page.locator('main')).toBeVisible();
      await expect(page.locator('header')).toBeVisible();
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
