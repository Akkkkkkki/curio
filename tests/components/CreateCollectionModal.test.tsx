import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders, setMockTheme } from '../utils/test-utils';
import { CreateCollectionModal } from '@/components/CreateCollectionModal';

vi.mock('@/theme', async () => {
  const { createThemeMock } = await import('../utils/test-utils');
  return createThemeMock();
});

vi.mock('@/services/geminiService', () => ({
  suggestCollectionFields: vi.fn().mockResolvedValue([]),
}));

describe('CreateCollectionModal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onCreate: vi.fn().mockReturnValue('new-collection-id'),
    onAddFirstItem: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    setMockTheme('gallery');
  });

  describe('Escape key dismissal (CUR-82)', () => {
    it('closes the modal when Escape is pressed on the entry step', async () => {
      renderWithProviders(<CreateCollectionModal {...defaultProps} />);

      expect(screen.getByTestId('create-collection-modal')).toBeInTheDocument();

      fireEvent.keyDown(document, { key: 'Escape' });

      await waitFor(() => {
        expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
      });
    });

    it('closes only the icon picker (not the modal) when Escape fires while the picker is open', async () => {
      const user = userEvent.setup();
      renderWithProviders(<CreateCollectionModal {...defaultProps} />);

      await user.click(screen.getByTestId('collection-icon-picker'));
      // Picker opens an options grid.
      expect(screen.getByRole('button', { name: '🎴' })).toBeInTheDocument();

      fireEvent.keyDown(document, { key: 'Escape' });

      await waitFor(() => {
        expect(screen.queryByRole('button', { name: '🎴' })).not.toBeInTheDocument();
      });

      // Modal itself remains; onClose was not invoked.
      expect(screen.getByTestId('create-collection-modal')).toBeInTheDocument();
      expect(defaultProps.onClose).not.toHaveBeenCalled();

      // Pressing Escape again now closes the modal.
      fireEvent.keyDown(document, { key: 'Escape' });
      await waitFor(() => {
        expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
      });
    });

    it('does nothing when Escape fires while the modal is closed', () => {
      renderWithProviders(<CreateCollectionModal {...defaultProps} isOpen={false} />);

      fireEvent.keyDown(document, { key: 'Escape' });

      expect(defaultProps.onClose).not.toHaveBeenCalled();
    });
  });

  describe('CUR-126 collection setup flow', () => {
    it('starts with the collector prompt and preset shelf instead of field rows', () => {
      renderWithProviders(<CreateCollectionModal {...defaultProps} />);

      expect(screen.getByText('What do you collect?')).toBeInTheDocument();
      expect(screen.getByTestId('collection-description-input')).toBeInTheDocument();
      expect(screen.getByTestId('collection-preset-vinyl')).toBeInTheDocument();
      expect(screen.queryByText('Suggested fields')).not.toBeInTheDocument();
      expect(screen.queryByTestId('collection-preset-select')).not.toBeInTheDocument();
    });

    it('defaults a preset to its pinned identity fields and leaves other suggestions optional', async () => {
      const user = userEvent.setup();
      renderWithProviders(<CreateCollectionModal {...defaultProps} />);

      await user.click(screen.getByTestId('collection-preset-vinyl'));
      await user.click(screen.getByTestId('collection-continue-btn'));

      const selectedRows = screen.getAllByTestId('selected-field-row');
      expect(selectedRows).toHaveLength(2);
      expect(selectedRows[0]).toHaveTextContent('Artist');
      expect(selectedRows[1]).toHaveTextContent('Release Year');
      expect(selectedRows.some((row) => row.textContent?.includes('Genre'))).toBe(false);
      expect(screen.getByTestId('suggested-field-3')).toHaveTextContent('Genre');
    });

    it('creates the collection and launches Add Item for the new collection', async () => {
      const user = userEvent.setup();
      renderWithProviders(<CreateCollectionModal {...defaultProps} />);

      await user.click(screen.getByTestId('collection-preset-vinyl'));
      await user.click(screen.getByTestId('collection-continue-btn'));
      await user.click(screen.getByTestId('suggested-field-3'));
      await user.click(screen.getByRole('button', { name: 'Next' }));
      await user.click(screen.getByRole('button', { name: /Create & add first piece/i }));

      expect(defaultProps.onCreate).toHaveBeenCalledWith({
        name: 'Vinyl Archives',
        icon: '🎵',
        templateId: 'vinyl',
        description: undefined,
        fields: ['Artist', 'Release Year', 'Genre'],
        pinnedFields: ['Artist', 'Release Year'],
      });
      expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
      expect(defaultProps.onAddFirstItem).toHaveBeenCalledWith('new-collection-id');
    });
  });
});
