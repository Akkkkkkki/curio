/**
 * Phase 4: StatusToast Component Tests
 *
 * Validates tone rendering, actions, and accessibility attributes.
 */

import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../utils/test-utils';
import { StatusToast } from '@/components/StatusToast';

describe('StatusToast', () => {
  it('renders message with default info tone', () => {
    renderWithProviders(<StatusToast message="Saved to archive" />);

    const toast = screen.getByTestId('status-toast');
    expect(toast).toHaveAttribute('role', 'status');
    expect(toast).toHaveAttribute('aria-live', 'polite');
    expect(screen.getByTestId('status-toast-message')).toHaveTextContent('Saved to archive');
    expect(toast).toHaveClass('bg-stone-50');
  });

  it('applies success tone styles', () => {
    renderWithProviders(<StatusToast message="Synced" tone="success" />);

    const toast = screen.getByTestId('status-toast');
    expect(toast).toHaveClass('bg-emerald-50');
    expect(toast).toHaveClass('text-emerald-800');
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
