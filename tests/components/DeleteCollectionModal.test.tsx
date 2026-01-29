/**
 * Phase 4: DeleteCollectionModal Component Tests
 *
 * Validates modal rendering, warning content, and user actions.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
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
});
