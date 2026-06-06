/**
 * Phase 4: DeleteItemModal Component Tests
 *
 * Validates modal rendering, warning content, and user actions.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders, setMockTheme } from '../utils/test-utils';
import { DeleteItemModal } from '@/components/DeleteItemModal';
import { createMockItem } from '../utils/fixtures/collections';

vi.mock('@/theme', async () => {
  const { createThemeMock } = await import('../utils/test-utils');
  return createThemeMock();
});

describe('DeleteItemModal', () => {
  const item = createMockItem({ title: 'Arcade Cabinet' });
  const defaultProps = {
    isOpen: true,
    item,
    onClose: vi.fn(),
    onConfirm: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    setMockTheme('gallery');
  });

  it('renders nothing when closed', () => {
    renderWithProviders(<DeleteItemModal {...defaultProps} isOpen={false} />);
    expect(screen.queryByText(/Delete Item/i)).not.toBeInTheDocument();
  });

  it('renders nothing when item is missing', () => {
    renderWithProviders(<DeleteItemModal {...defaultProps} item={null} />);
    expect(screen.queryByText(/Delete Item/i)).not.toBeInTheDocument();
  });

  it('shows warning message with item title', () => {
    renderWithProviders(<DeleteItemModal {...defaultProps} />);
    expect(screen.getByText(/Arcade Cabinet/)).toBeInTheDocument();
  });

  it('calls onClose when cancel is clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<DeleteItemModal {...defaultProps} />);

    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onConfirm when delete is clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<DeleteItemModal {...defaultProps} />);

    await user.click(screen.getByRole('button', { name: /delete item/i }));
    expect(defaultProps.onConfirm).toHaveBeenCalledTimes(1);
  });

  describe('accessibility (CUR-78)', () => {
    it('renders as a labelled dialog', () => {
      renderWithProviders(<DeleteItemModal {...defaultProps} />);
      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-modal', 'true');
      expect(dialog).toHaveAttribute('aria-labelledby');
    });

    it('closes on Escape', async () => {
      renderWithProviders(<DeleteItemModal {...defaultProps} />);

      fireEvent.keyDown(document, { key: 'Escape' });

      await waitFor(() => {
        expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
      });
    });

    it('lands initial focus on Cancel (safe action), not Delete', async () => {
      renderWithProviders(<DeleteItemModal {...defaultProps} />);

      await waitFor(() => {
        expect(document.activeElement).toBe(screen.getByRole('button', { name: /cancel/i }));
      });
    });
  });
});
