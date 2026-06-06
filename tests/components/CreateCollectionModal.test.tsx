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
    onCreate: vi.fn().mockReturnValue(true),
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
});
