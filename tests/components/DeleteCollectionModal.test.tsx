/**
 * Phase 4: DeleteCollectionModal Component Tests
 *
 * Validates modal rendering, warning content, and user actions.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders, setMockTheme } from '../utils/test-utils';
import { DeleteCollectionModal } from '@/components/DeleteCollectionModal';
import { createMockCollection, createMockItem } from '../utils/fixtures/collections';

vi.mock('@/theme', async () => {
  const { createThemeMock } = await import('../utils/test-utils');
  return createThemeMock();
});

describe('DeleteCollectionModal', () => {
  const collection = createMockCollection({
    name: 'Vintage Cameras',
    items: [createMockItem({ title: 'Polaroid SX-70' }), createMockItem({ title: 'Leica M6' })],
  });
  const defaultProps = {
    isOpen: true,
    collection,
    onClose: vi.fn(),
    onConfirm: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    setMockTheme('gallery');
  });

  it('renders nothing when closed', () => {
    renderWithProviders(<DeleteCollectionModal {...defaultProps} isOpen={false} />);
    expect(screen.queryByText(/Delete Collection/i)).not.toBeInTheDocument();
  });

  it('renders nothing when collection is missing', () => {
    renderWithProviders(<DeleteCollectionModal {...defaultProps} collection={null} />);
    expect(screen.queryByText(/Delete Collection/i)).not.toBeInTheDocument();
  });

  it('shows warning message with collection name and item count', () => {
    renderWithProviders(<DeleteCollectionModal {...defaultProps} />);
    expect(screen.getByText(/Vintage Cameras/)).toBeInTheDocument();
    expect(screen.getByText(/2 items/i)).toBeInTheDocument();
  });

  it('calls onClose when cancel is clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<DeleteCollectionModal {...defaultProps} />);

    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onConfirm when delete is clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<DeleteCollectionModal {...defaultProps} />);

    await user.click(screen.getByRole('button', { name: /delete collection/i }));
    expect(defaultProps.onConfirm).toHaveBeenCalledTimes(1);
  });

  describe('accessibility (CUR-78)', () => {
    it('renders as a labelled dialog', () => {
      renderWithProviders(<DeleteCollectionModal {...defaultProps} />);
      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-modal', 'true');
      expect(dialog).toHaveAttribute('aria-labelledby');
    });

    it('closes on Escape', async () => {
      renderWithProviders(<DeleteCollectionModal {...defaultProps} />);

      fireEvent.keyDown(document, { key: 'Escape' });

      await waitFor(() => {
        expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
      });
    });

    it('lands initial focus on Cancel (safe action), not Delete', async () => {
      renderWithProviders(<DeleteCollectionModal {...defaultProps} />);

      await waitFor(() => {
        expect(document.activeElement).toBe(screen.getByRole('button', { name: /cancel/i }));
      });
    });
  });

  describe('Vault theme contrast (CUR-22)', () => {
    it('renders the warning icon with a Vault-tinted tile, not a pastel pill', () => {
      setMockTheme('vault');
      renderWithProviders(<DeleteCollectionModal {...defaultProps} />);
      const icon = screen.getByTestId('delete-collection-warning-icon');
      expect(icon).toHaveClass('bg-red-500/15');
      expect(icon).toHaveClass('text-red-300');
      // Cream pastel must NOT leak through onto the dark surface.
      expect(icon).not.toHaveClass('bg-red-100');
      expect(icon).not.toHaveClass('text-red-600');
    });

    it('keeps the Gallery icon tile unchanged on the default theme', () => {
      setMockTheme('gallery');
      renderWithProviders(<DeleteCollectionModal {...defaultProps} />);
      const icon = screen.getByTestId('delete-collection-warning-icon');
      expect(icon).toHaveClass('bg-red-100');
      expect(icon).toHaveClass('text-red-600');
    });
  });
});
