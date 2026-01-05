import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../utils/test-utils';
import { AddItemModal } from '@/components/AddItemModal';
import {
  mockCollection,
  createMockCollection,
  mockVinylFields,
} from '../utils/fixtures/collections';

// Mock the geminiService module
vi.mock('@/services/geminiService', () => ({
  analyzeImage: vi.fn(),
  refreshAiEnabled: vi.fn(),
}));

// Mock the theme module to use our test theme context
vi.mock('@/theme', async () => {
  const actual = await vi.importActual('@/theme');
  return {
    ...actual,
    useTheme: () => ({ theme: 'gallery', setTheme: vi.fn() }),
  };
});

// Import the mocked functions
import { analyzeImage, refreshAiEnabled } from '@/services/geminiService';

const mockAnalyzeImage = analyzeImage as ReturnType<typeof vi.fn>;
const mockRefreshAiEnabled = refreshAiEnabled as ReturnType<typeof vi.fn>;

describe('AddItemModal', () => {
  const mockOnClose = vi.fn();
  const mockOnSave = vi.fn();

  const defaultProps = {
    isOpen: true,
    onClose: mockOnClose,
    collections: [mockCollection],
    onSave: mockOnSave,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockRefreshAiEnabled.mockResolvedValue(true);
    mockAnalyzeImage.mockResolvedValue({
      title: 'Test Album',
      notes: 'A great album',
      data: { artist: 'Test Artist', album: 'Test Album' },
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Modal Display', () => {
    it('renders nothing when isOpen is false', () => {
      renderWithProviders(<AddItemModal {...defaultProps} isOpen={false} />);
      expect(screen.queryByText(/add item/i)).not.toBeInTheDocument();
    });

    it('renders modal when isOpen is true', () => {
      renderWithProviders(<AddItemModal {...defaultProps} />);
      expect(screen.getByRole('heading', { name: /add item/i })).toBeInTheDocument();
    });

    it('displays close button that calls onClose when clicked', async () => {
      const user = userEvent.setup();
      renderWithProviders(<AddItemModal {...defaultProps} />);

      const closeButton = screen.getByRole('button', { name: '' });
      await user.click(closeButton);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('Step Navigation - Single Collection', () => {
    it('skips collection selection when only one collection exists', () => {
      renderWithProviders(<AddItemModal {...defaultProps} />);

      // Should skip to upload step directly - multiple "Upload Photo" texts can exist
      expect(screen.getAllByText(/Upload Photo/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.queryByText(/New Archive/i)).not.toBeInTheDocument();
    });

    it('displays stepper with correct progress indicators', () => {
      renderWithProviders(<AddItemModal {...defaultProps} />);

      // Should show step 2/4 since we skip collection selection
      expect(screen.getByText(/Step 2 of 4/i)).toBeInTheDocument();
    });
  });

  describe('Step Navigation - Multiple Collections', () => {
    const multipleCollections = [
      mockCollection,
      createMockCollection({ id: 'collection-2', name: 'Chocolate Collection', icon: '🍫' }),
    ];

    it('shows collection selection step when multiple collections exist', () => {
      renderWithProviders(<AddItemModal {...defaultProps} collections={multipleCollections} />);

      expect(screen.getByText(/new archive/i)).toBeInTheDocument();
      expect(screen.getByText('Test Vinyl Collection')).toBeInTheDocument();
      expect(screen.getByText('Chocolate Collection')).toBeInTheDocument();
    });

    it('navigates to upload step when collection is selected', async () => {
      const user = userEvent.setup();
      renderWithProviders(<AddItemModal {...defaultProps} collections={multipleCollections} />);

      await user.click(screen.getByText('Test Vinyl Collection'));

      // Should now be on upload step - multiple "Upload Photo" texts can exist
      expect(screen.getAllByText(/Upload Photo/i).length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Upload Step', () => {
    it('displays upload options including camera, upload, and batch mode', () => {
      renderWithProviders(<AddItemModal {...defaultProps} />);

      expect(screen.getAllByText(/Take Photo/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/Upload Photo/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText(/Rapid-Fire Mode/i)).toBeInTheDocument();
    });

    it('displays skip to manual entry option (AI recovery per product design)', () => {
      renderWithProviders(<AddItemModal {...defaultProps} />);

      // Product requirement: AI must be recoverable - users can skip AI analysis
      expect(screen.getByText(/Skip and add manually/i)).toBeInTheDocument();
    });

    it('allows manual entry when skip is clicked (AI recovery)', async () => {
      const user = userEvent.setup();
      renderWithProviders(<AddItemModal {...defaultProps} />);

      await user.click(screen.getByText(/Skip and add manually/i));

      // Should now be on verify step for manual entry
      expect(screen.getByText(/Add to Collection/i)).toBeInTheDocument();
    });
  });

  describe('AI Analysis Flow', () => {
    it('triggers AI analysis when image is uploaded', async () => {
      // Make analysis take some time so we can see the analyzing state
      mockAnalyzeImage.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ title: 'Test' }), 2000)),
      );

      renderWithProviders(<AddItemModal {...defaultProps} />);

      // Get the hidden file input (first one without multiple attribute)
      const fileInputs = document.querySelectorAll('input[type="file"][accept="image/*"]');
      const fileInput = Array.from(fileInputs).find(
        (input) => !(input as HTMLInputElement).multiple,
      );
      expect(fileInput).toBeInTheDocument();

      // Create a mock file
      const file = new File(['test image content'], 'test.jpg', { type: 'image/jpeg' });

      // Simulate file selection
      fireEvent.change(fileInput!, { target: { files: [file] } });

      // Should show analyzing step (text contains "Analyzing" in translation)
      await waitFor(
        () => {
          expect(screen.getByText(/Gemini/i)).toBeInTheDocument();
        },
        { timeout: 2000 },
      );
    });

    it('populates form with AI analysis results on success', async () => {
      mockAnalyzeImage.mockResolvedValue({
        title: 'AI Generated Title',
        notes: 'AI Generated Notes',
        data: { artist: 'AI Artist', album: 'AI Album' },
      });

      renderWithProviders(<AddItemModal {...defaultProps} />);

      const fileInput = document.querySelector('input[type="file"][accept="image/*"]');
      const file = new File(['test image content'], 'test.jpg', { type: 'image/jpeg' });

      await waitFor(() => {
        fireEvent.change(fileInput!, { target: { files: [file] } });
      });

      // Wait for analysis to complete and verify step to appear
      await waitFor(
        () => {
          expect(screen.getByDisplayValue('AI Generated Title')).toBeInTheDocument();
        },
        { timeout: 3000 },
      );
    });

    it('shows manual entry button during analysis (AI recovery)', async () => {
      // Make analysis take a long time
      mockAnalyzeImage.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ title: 'Test' }), 5000)),
      );

      renderWithProviders(<AddItemModal {...defaultProps} />);

      const fileInput = document.querySelector('input[type="file"][accept="image/*"]');
      const file = new File(['test image content'], 'test.jpg', { type: 'image/jpeg' });

      await waitFor(() => {
        fireEvent.change(fileInput!, { target: { files: [file] } });
      });

      // Product requirement: Users can always skip to manual entry
      await waitFor(() => {
        expect(screen.getByText(/enter manually/i)).toBeInTheDocument();
      });
    });
  });

  describe('AI Failure Handling (Graceful Degradation)', () => {
    it('shows error message and allows manual entry when AI is unavailable', async () => {
      mockRefreshAiEnabled.mockResolvedValue(false);

      renderWithProviders(<AddItemModal {...defaultProps} />);

      const fileInput = document.querySelector('input[type="file"][accept="image/*"]');
      const file = new File(['test image content'], 'test.jpg', { type: 'image/jpeg' });

      await waitFor(() => {
        fireEvent.change(fileInput!, { target: { files: [file] } });
      });

      // Should show verify step (allowing manual entry) even when AI is unavailable
      await waitFor(() => {
        expect(screen.getByText(/Add to Collection/i)).toBeInTheDocument();
      });
    });

    it('shows error message and allows manual entry when AI analysis fails', async () => {
      mockAnalyzeImage.mockRejectedValue(new Error('Analysis failed'));

      renderWithProviders(<AddItemModal {...defaultProps} />);

      const fileInput = document.querySelector('input[type="file"][accept="image/*"]');
      const file = new File(['test image content'], 'test.jpg', { type: 'image/jpeg' });

      await waitFor(() => {
        fireEvent.change(fileInput!, { target: { files: [file] } });
      });

      // Should still proceed to verify step (never blocking user per product design)
      await waitFor(() => {
        expect(screen.getByText(/Add to Collection/i)).toBeInTheDocument();
      });
    });

    it('preserves user progress when switching to manual entry during AI failure', async () => {
      mockAnalyzeImage.mockRejectedValue(new Error('Analysis failed'));

      renderWithProviders(<AddItemModal {...defaultProps} />);

      const fileInput = document.querySelector('input[type="file"][accept="image/*"]');
      const file = new File(['test image content'], 'test.jpg', { type: 'image/jpeg' });

      await waitFor(() => {
        fireEvent.change(fileInput!, { target: { files: [file] } });
      });

      // Wait for verify step
      await waitFor(() => {
        expect(screen.getByText(/Add to Collection/i)).toBeInTheDocument();
      });

      // Image preview should still be visible (progress preserved)
      const imgElement = document.querySelector('img');
      expect(imgElement).toBeInTheDocument();
    });
  });

  describe('Verify Step - Form Editing', () => {
    beforeEach(async () => {
      mockAnalyzeImage.mockResolvedValue({
        title: 'AI Title',
        notes: 'AI Notes',
        data: { artist: 'AI Artist' },
      });
    });

    it('displays custom fields from collection template', async () => {
      const user = userEvent.setup();
      renderWithProviders(<AddItemModal {...defaultProps} />);

      // Skip to manual entry
      await user.click(screen.getByText(/Skip and add manually/i));

      // Should show template fields (uppercase labels)
      expect(screen.getByText(/ARTIST/i)).toBeInTheDocument();
      expect(screen.getByText(/ALBUM/i)).toBeInTheDocument();
    });

    it('allows editing of all form fields', async () => {
      const user = userEvent.setup();
      renderWithProviders(<AddItemModal {...defaultProps} />);

      await user.click(screen.getByText(/Skip and add manually/i));

      // Find text inputs (title is the first one)
      const inputs = screen.getAllByRole('textbox');
      await user.clear(inputs[0]);
      await user.type(inputs[0], 'My Custom Title');

      expect(screen.getByDisplayValue('My Custom Title')).toBeInTheDocument();
    });

    it('displays rating selector with 5 stars', async () => {
      const user = userEvent.setup();
      renderWithProviders(<AddItemModal {...defaultProps} />);

      await user.click(screen.getByText(/Skip and add manually/i));

      // Should have 5 rating buttons
      const ratingButtons = screen.getAllByRole('button', { name: '★' });
      expect(ratingButtons.length).toBe(5);
    });

    it('updates rating when star is clicked', async () => {
      const user = userEvent.setup();
      renderWithProviders(<AddItemModal {...defaultProps} />);

      await user.click(screen.getByText(/Skip and add manually/i));

      const ratingButtons = screen.getAllByRole('button', { name: '★' });
      await user.click(ratingButtons[3]); // Click 4th star (rating = 4)

      // The 4th button should now have the active styling
      expect(ratingButtons[3]).toHaveClass('bg-amber-400');
    });
  });

  describe('Save Flow', () => {
    it('calls onSave with correct data when save button is clicked', async () => {
      const user = userEvent.setup();
      mockAnalyzeImage.mockResolvedValue({
        title: 'Test Title',
        notes: 'Test Notes',
        data: { artist: 'Test Artist' },
      });

      renderWithProviders(<AddItemModal {...defaultProps} />);

      // Skip to manual entry
      await user.click(screen.getByText(/Skip and add manually/i));

      // Fill in the title
      const inputs = screen.getAllByRole('textbox');
      await user.clear(inputs[0]);
      await user.type(inputs[0], 'My Saved Item');

      // Click save
      await user.click(screen.getByText(/Add to Collection/i));

      expect(mockOnSave).toHaveBeenCalledTimes(1);
      expect(mockOnSave).toHaveBeenCalledWith(
        mockCollection.id,
        expect.objectContaining({
          collectionId: mockCollection.id,
          title: 'My Saved Item',
        }),
      );
    });

    it('closes modal after successful save', async () => {
      const user = userEvent.setup();
      renderWithProviders(<AddItemModal {...defaultProps} />);

      await user.click(screen.getByText(/Skip and add manually/i));
      await user.click(screen.getByText(/Add to Collection/i));

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('saves with "Untitled" if no title is provided', async () => {
      const user = userEvent.setup();
      renderWithProviders(<AddItemModal {...defaultProps} />);

      await user.click(screen.getByText(/Skip and add manually/i));
      await user.click(screen.getByText(/Add to Collection/i));

      expect(mockOnSave).toHaveBeenCalledWith(
        mockCollection.id,
        expect.objectContaining({
          title: 'Untitled',
        }),
      );
    });
  });

  describe('Batch Mode', () => {
    it('displays batch mode button on upload step', () => {
      renderWithProviders(<AddItemModal {...defaultProps} />);
      expect(screen.getByText(/Rapid-Fire Mode/i)).toBeInTheDocument();
    });

    it('allows multiple file selection in batch mode', () => {
      renderWithProviders(<AddItemModal {...defaultProps} />);

      // The batch input should have 'multiple' attribute
      const batchInput = document.querySelectorAll('input[type="file"]')[1] as HTMLInputElement;
      expect(batchInput).toHaveAttribute('multiple');
    });
  });

  describe('Theme Support', () => {
    it('renders correctly with gallery theme', () => {
      renderWithProviders(<AddItemModal {...defaultProps} />, { initialTheme: 'gallery' });
      expect(screen.getByRole('heading', { name: /add item/i })).toBeInTheDocument();
    });

    it('renders correctly with vault theme', () => {
      renderWithProviders(<AddItemModal {...defaultProps} />, { initialTheme: 'vault' });
      expect(screen.getByRole('heading', { name: /add item/i })).toBeInTheDocument();
    });

    it('renders correctly with atelier theme', () => {
      renderWithProviders(<AddItemModal {...defaultProps} />, { initialTheme: 'atelier' });
      expect(screen.getByRole('heading', { name: /add item/i })).toBeInTheDocument();
    });
  });

  describe('Modal State Reset', () => {
    it('resets form state when modal is reopened', async () => {
      const user = userEvent.setup();
      const { rerender } = renderWithProviders(<AddItemModal {...defaultProps} />);

      // Fill in some data
      await user.click(screen.getByText(/Skip and add manually/i));
      const inputs = screen.getAllByRole('textbox');
      await user.type(inputs[0], 'Test Title');

      // Close modal
      rerender(<AddItemModal {...defaultProps} isOpen={false} />);

      // Reopen modal
      rerender(<AddItemModal {...defaultProps} isOpen={true} />);

      // Should be back at upload step (since we have only 1 collection)
      expect(screen.getAllByText(/Upload Photo/i).length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Accessibility', () => {
    it('has accessible modal structure', () => {
      renderWithProviders(<AddItemModal {...defaultProps} />);

      // Modal should have proper heading
      expect(screen.getByRole('heading', { name: /add item/i })).toBeInTheDocument();
    });

    it('file inputs have proper accept attributes', () => {
      renderWithProviders(<AddItemModal {...defaultProps} />);

      const fileInputs = document.querySelectorAll('input[type="file"]');
      fileInputs.forEach((input) => {
        expect(input).toHaveAttribute('accept', 'image/*');
      });
    });
  });
});
