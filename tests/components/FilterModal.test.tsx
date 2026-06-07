import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { renderWithProviders, setMockTheme } from '../utils/test-utils';
import { FilterModal } from '@/components/FilterModal';
import { FieldDefinition } from '@/types';

vi.mock('@/theme', async () => {
  const { createThemeMock } = await import('../utils/test-utils');
  return createThemeMock();
});

describe('FilterModal', () => {
  const fields: FieldDefinition[] = [
    { id: 'artist', label: 'Artist', type: 'text', displayMode: 'primary' },
    { id: 'year', label: 'Year', type: 'number', displayMode: 'badge' },
  ];
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    fields,
    activeFilters: {},
    onApply: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    setMockTheme('gallery');
  });

  it('renders nothing when closed', () => {
    renderWithProviders(<FilterModal {...defaultProps} isOpen={false} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  describe('accessibility (CUR-78)', () => {
    it('renders as a labelled dialog', () => {
      renderWithProviders(<FilterModal {...defaultProps} />);
      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-modal', 'true');
      expect(dialog).toHaveAttribute('aria-labelledby');
    });

    it('closes on Escape', async () => {
      renderWithProviders(<FilterModal {...defaultProps} />);

      fireEvent.keyDown(document, { key: 'Escape' });

      await waitFor(() => {
        expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
      });
    });
  });
});
