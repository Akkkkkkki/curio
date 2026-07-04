/**
 * StatusToast Component Tests
 *
 * Toast is the highest-frequency trust surface in Curio (every save, sync,
 * and error). This suite locks in that each tone keeps its semantic hue
 * across all three themes and that action / dismiss buttons stay readable
 * — previously the toast hardcoded the Gallery palette and looked like a
 * foreign object on Vault / Atelier (CUR-88, mirrors CUR-81 on StatusBanner).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, setMockTheme, createThemeMock } from '../utils/test-utils';
import userEvent from '@testing-library/user-event';
import { fireEvent } from '@testing-library/react';
import {
  StatusToast,
  StatusTone,
  getStatusToastDurationMs,
  STATUS_TOAST_DURATIONS,
} from '@/components/StatusToast';
import { AppTheme } from '@/types';

vi.mock('@/theme', async () => {
  const { createThemeMock } = await import('../utils/test-utils');
  return createThemeMock();
});

const getToast = () => screen.getByTestId('status-toast');

describe('StatusToast', () => {
  beforeEach(() => {
    setMockTheme('gallery');
  });

  describe('rendering and accessibility', () => {
    it('renders message with default info tone and status role', () => {
      renderWithProviders(<StatusToast message="Saved & backed up" />);
      const toast = getToast();
      expect(toast).toHaveAttribute('role', 'status');
      expect(toast).toHaveAttribute('aria-live', 'polite');
      expect(screen.getByTestId('status-toast-message')).toHaveTextContent('Saved & backed up');
    });

    it('renders action button and calls onAction', async () => {
      const onAction = vi.fn();
      const user = userEvent.setup();
      renderWithProviders(
        <StatusToast message="Sync failed" tone="error" actionLabel="Retry" onAction={onAction} />,
      );
      await user.click(screen.getByRole('button', { name: /retry/i }));
      expect(onAction).toHaveBeenCalledTimes(1);
    });

    it('renders dismiss button and calls onDismiss', async () => {
      const onDismiss = vi.fn();
      const user = userEvent.setup();
      renderWithProviders(<StatusToast message="Will sync later" onDismiss={onDismiss} />);
      await user.click(screen.getByRole('button', { name: /close/i }));
      expect(onDismiss).toHaveBeenCalledTimes(1);
    });
  });

  describe('theme-aware tone surfaces (CUR-88)', () => {
    const cases: Array<[StatusTone, AppTheme, string[]]> = [
      ['success', 'gallery', ['bg-emerald-50', 'text-emerald-800', 'border-emerald-100']],
      ['success', 'vault', ['bg-emerald-500/10', 'text-emerald-200']],
      ['success', 'atelier', ['bg-emerald-100/70', 'text-emerald-900']],
      ['error', 'gallery', ['bg-red-50', 'text-red-700', 'border-red-100']],
      ['error', 'vault', ['bg-red-500/10', 'text-red-200']],
      ['error', 'atelier', ['bg-red-100/70', 'text-red-800']],
      ['warning', 'gallery', ['bg-amber-50', 'text-amber-800', 'border-amber-100']],
      ['warning', 'vault', ['bg-amber-500/10', 'text-amber-200']],
      ['warning', 'atelier', ['bg-amber-100/70', 'text-amber-900']],
      ['info', 'gallery', ['bg-stone-50', 'text-stone-700', 'border-stone-200']],
      ['info', 'vault', ['bg-white/5', 'text-stone-200']],
      ['info', 'atelier', ['bg-[#EDE4D3]', 'text-[#3D3530]']],
    ];

    it.each(cases)('%s tone uses theme-appropriate classes in %s', (tone, theme, fragments) => {
      setMockTheme(theme);
      renderWithProviders(<StatusToast message="m" tone={tone} />);
      const toast = getToast();
      for (const fragment of fragments) {
        expect(toast).toHaveClass(fragment);
      }
    });

    it('does not collapse non-info tones to the Gallery palette in Vault', () => {
      setMockTheme('vault');
      renderWithProviders(<StatusToast message="Sync failed" tone="error" />);
      const toast = getToast();
      // Pre-fix bug: every tone rendered with bg-red-50 in Vault, a foreign
      // light-mode surface floating over near-black. Guard explicitly.
      expect(toast).not.toHaveClass('bg-red-50');
      expect(toast.className).toMatch(/bg-red-500\/10/);
    });

    it('dismisses on a downward swipe past the commit threshold (CUR-109)', () => {
      const onDismiss = vi.fn();
      renderWithProviders(<StatusToast message="Saved" tone="success" onDismiss={onDismiss} />);
      const toast = getToast();

      // Travel of 60px (> 48px threshold) → commit dismiss.
      fireEvent.touchStart(toast, { touches: [{ clientX: 100, clientY: 100 }] });
      fireEvent.touchMove(toast, { touches: [{ clientX: 100, clientY: 160 }] });
      fireEvent.touchEnd(toast);

      expect(onDismiss).toHaveBeenCalledTimes(1);
    });

    it('springs back on a downward drag under the commit threshold', () => {
      const onDismiss = vi.fn();
      renderWithProviders(<StatusToast message="Saved" tone="success" onDismiss={onDismiss} />);
      const toast = getToast();

      // Travel of 20px (< 48px threshold) → no dismiss, transform clears.
      fireEvent.touchStart(toast, { touches: [{ clientX: 100, clientY: 100 }] });
      fireEvent.touchMove(toast, { touches: [{ clientX: 100, clientY: 120 }] });
      fireEvent.touchEnd(toast);

      expect(onDismiss).not.toHaveBeenCalled();
      expect(toast.style.transform).toBe('');
    });

    it('ignores upward swipes so the toast can be re-read but not yanked', () => {
      const onDismiss = vi.fn();
      renderWithProviders(<StatusToast message="Saved" tone="success" onDismiss={onDismiss} />);
      const toast = getToast();

      fireEvent.touchStart(toast, { touches: [{ clientX: 100, clientY: 200 }] });
      fireEvent.touchMove(toast, { touches: [{ clientX: 100, clientY: 80 }] });
      fireEvent.touchEnd(toast);

      expect(onDismiss).not.toHaveBeenCalled();
    });

    it('does not track swipes when no onDismiss is provided', () => {
      // Without a handler the gesture is meaningless — make sure we don't
      // leave a translate on the surface, which would look broken to the user.
      renderWithProviders(<StatusToast message="Read-only" tone="info" />);
      const toast = getToast();
      fireEvent.touchStart(toast, { touches: [{ clientX: 100, clientY: 100 }] });
      fireEvent.touchMove(toast, { touches: [{ clientX: 100, clientY: 200 }] });
      fireEvent.touchEnd(toast);
      expect(toast.style.transform).toBe('');
    });

    it('keeps action and dismiss buttons readable across themes', () => {
      const onAction = vi.fn();
      const onDismiss = vi.fn();
      setMockTheme('vault');
      renderWithProviders(
        <StatusToast
          message="Sync failed"
          tone="error"
          actionLabel="Retry"
          onAction={onAction}
          onDismiss={onDismiss}
        />,
      );
      // In Vault, the original `text-amber-700` action and `text-stone-400`
      // dismiss were too dim against the dark page — confirm they upgraded.
      expect(screen.getByRole('button', { name: /retry/i })).toHaveClass('text-amber-200');
      expect(screen.getByRole('button', { name: /close/i }).className).toMatch(/text-stone-/);
    });
  });

  describe('getStatusToastDurationMs (CUR-109)', () => {
    it('keeps trust-bearing tones on screen at least 3 seconds', () => {
      // Critical Saved / Synced / Will sync / Sync error feedback used to share
      // the 2400ms info default and disappeared before users could read it.
      expect(getStatusToastDurationMs('success')).toBeGreaterThanOrEqual(3000);
      expect(getStatusToastDurationMs('error')).toBeGreaterThanOrEqual(3000);
      expect(getStatusToastDurationMs('warning')).toBeGreaterThanOrEqual(3000);
      expect(getStatusToastDurationMs('success')).toBe(STATUS_TOAST_DURATIONS.trust);
    });

    it('lets info tones auto-dismiss faster', () => {
      expect(getStatusToastDurationMs('info')).toBe(STATUS_TOAST_DURATIONS.info);
      expect(STATUS_TOAST_DURATIONS.info).toBeLessThan(STATUS_TOAST_DURATIONS.trust);
    });

    it('extends to the action-toast duration when a button is offered', () => {
      // A user can't tap a button they didn't see — actionable toasts get the
      // longest lifetime regardless of tone.
      expect(getStatusToastDurationMs('success', { actionLabel: 'Retry' })).toBe(
        STATUS_TOAST_DURATIONS.withAction,
      );
      expect(getStatusToastDurationMs('info', { actionLabel: 'Retry' })).toBe(
        STATUS_TOAST_DURATIONS.withAction,
      );
    });

    it('respects an explicit durationMs override', () => {
      expect(getStatusToastDurationMs('success', { durationMs: 9999 })).toBe(9999);
      expect(getStatusToastDurationMs('info', { durationMs: 100 })).toBe(100);
    });
  });
});
