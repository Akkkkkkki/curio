import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders, setMockTheme } from '../utils/test-utils';
import { AddItemModal } from '@/components/AddItemModal';
import { createMockCollection } from '../utils/fixtures/collections';

vi.mock('@/theme', async () => {
  const { createThemeMock } = await import('../utils/test-utils');
  return createThemeMock();
});

vi.mock('@/services/geminiService', () => ({
  analyzeImage: vi.fn(),
  refreshAiEnabled: vi.fn(),
  fetchStoryPrompts: vi.fn().mockResolvedValue({ prompts: [] }),
}));

// JSDOM can't decode <img>, so the real canvas path in compressImageForAi
// fails on fake data URLs. Stub it to return the raw base64 unchanged.
vi.mock('@/services/imageProcessor', async () => {
  const actual = await vi.importActual<typeof import('@/services/imageProcessor')>(
    '@/services/imageProcessor',
  );
  return {
    ...actual,
    compressImageForAi: vi.fn(async (dataUrl: string) => {
      const idx = dataUrl.indexOf(',');
      return idx >= 0 ? dataUrl.slice(idx + 1) : dataUrl;
    }),
  };
});

vi.mock('@/services/analytics', async () => {
  const actual =
    await vi.importActual<typeof import('@/services/analytics')>('@/services/analytics');
  return {
    ...actual,
    trackEvent: vi.fn(),
  };
});

vi.mock('@capacitor/camera', () => ({
  Camera: {
    getPhoto: vi.fn(),
  },
  CameraResultType: {
    DataUrl: 'dataUrl',
  },
  CameraSource: {
    Camera: 'camera',
    Photos: 'photos',
  },
}));

import { analyzeImage, refreshAiEnabled } from '@/services/geminiService';
import { trackEvent } from '@/services/analytics';
import { Camera, CameraSource } from '@capacitor/camera';

const mockAnalyzeImage = analyzeImage as ReturnType<typeof vi.fn>;
const mockRefreshAiEnabled = refreshAiEnabled as ReturnType<typeof vi.fn>;
const mockTrackEvent = trackEvent as ReturnType<typeof vi.fn>;
const mockGetPhoto = Camera.getPhoto as ReturnType<typeof vi.fn>;

class MockFileReader {
  result: string | ArrayBuffer | null = null;
  onloadend: ((this: FileReader, ev: ProgressEvent<FileReader>) => any) | null = null;
  onerror: ((this: FileReader, ev: ProgressEvent<FileReader>) => any) | null = null;

  readAsDataURL() {
    this.result = 'data:image/png;base64,ZmFrZQ==';
    if (this.onloadend) {
      this.onloadend(new ProgressEvent('loadend'));
    }
  }
}

describe('AddItemModal', () => {
  const mockOnClose = vi.fn();
  const mockOnSave = vi.fn();

  beforeAll(() => {
    if (!global.requestAnimationFrame) {
      global.requestAnimationFrame = (cb: FrameRequestCallback) => window.setTimeout(cb, 0);
    }
    global.FileReader = MockFileReader as unknown as typeof FileReader;
  });

  beforeEach(() => {
    mockOnClose.mockClear();
    mockOnSave.mockReset();
    mockOnSave.mockResolvedValue(undefined);
    mockRefreshAiEnabled.mockResolvedValue(false);
    mockAnalyzeImage.mockReset();
    mockTrackEvent.mockClear();
    mockGetPhoto.mockReset();
    setMockTheme('gallery');
  });

  it('tracks an item creation start each time the modal opens', () => {
    renderWithProviders(
      <AddItemModal
        isOpen
        onClose={mockOnClose}
        collections={[createMockCollection()]}
        onSave={mockOnSave}
      />,
    );

    expect(mockTrackEvent).toHaveBeenCalledWith('item_creation_started', {
      surface: 'add_item_modal',
    });
  });

  it('renders nothing when closed', () => {
    renderWithProviders(
      <AddItemModal
        isOpen={false}
        onClose={mockOnClose}
        collections={[createMockCollection()]}
        onSave={mockOnSave}
      />,
    );

    expect(screen.queryByText('Rapid-Fire Mode')).not.toBeInTheDocument();
  });

  it('preserves the selected collection when the parent re-renders with a new collections array (CUR-44)', async () => {
    const user = userEvent.setup();
    const c1 = createMockCollection({ id: 'c1', name: 'Vinyl Vault' });
    const c2 = createMockCollection({ id: 'c2', name: 'Chocolate Vault' });

    const { rerender } = renderWithProviders(
      <AddItemModal isOpen onClose={mockOnClose} collections={[c1, c2]} onSave={mockOnSave} />,
    );

    // Starts on the select-type step with both collections offered.
    expect(screen.getByText('New Archive')).toBeInTheDocument();
    expect(screen.getByText('Vinyl Vault')).toBeInTheDocument();

    // Pick Vinyl Vault → advances to the upload step.
    await user.click(screen.getByText('Vinyl Vault'));
    await screen.findByRole('heading', { name: 'Upload Photo' });

    // Parent re-renders with a brand-new collections array of identical content
    // (simulates a cloud merge / unrelated setCollections firing mid-flow).
    rerender(
      <AddItemModal
        isOpen
        onClose={mockOnClose}
        collections={[{ ...c1 }, { ...c2 }]}
        onSave={mockOnSave}
      />,
    );

    // Should remain on the upload step. Previously this would snap back to
    // select-type and silently drop `selectedCollectionId`.
    expect(screen.getByRole('heading', { name: 'Upload Photo' })).toBeInTheDocument();
    expect(screen.queryByText('New Archive')).not.toBeInTheDocument();
  });

  it('skips collection picker when defaultCollectionId matches a known collection', async () => {
    const c1 = createMockCollection({ id: 'c1', name: 'Vinyl Vault' });
    const c2 = createMockCollection({ id: 'c2', name: 'Chocolate Vault' });

    renderWithProviders(
      <AddItemModal
        isOpen
        onClose={mockOnClose}
        collections={[c1, c2]}
        defaultCollectionId="c2"
        onSave={mockOnSave}
      />,
    );

    // Should skip select-type and land on upload step directly.
    expect(screen.getByRole('heading', { name: 'Upload Photo' })).toBeInTheDocument();
    expect(screen.queryByText('New Archive')).not.toBeInTheDocument();
  });

  it('falls back to collection picker when defaultCollectionId does not match any collection', async () => {
    const c1 = createMockCollection({ id: 'c1', name: 'Vinyl Vault' });
    const c2 = createMockCollection({ id: 'c2', name: 'Chocolate Vault' });

    renderWithProviders(
      <AddItemModal
        isOpen
        onClose={mockOnClose}
        collections={[c1, c2]}
        defaultCollectionId="deleted-id"
        onSave={mockOnSave}
      />,
    );

    // Should show the collection picker since the default ID is stale.
    expect(screen.getByText('New Archive')).toBeInTheDocument();
    expect(screen.getByText('Vinyl Vault')).toBeInTheDocument();
  });

  it('shows collection picker when no defaultCollectionId and multiple collections', async () => {
    const c1 = createMockCollection({ id: 'c1', name: 'Vinyl Vault' });
    const c2 = createMockCollection({ id: 'c2', name: 'Chocolate Vault' });

    renderWithProviders(
      <AddItemModal isOpen onClose={mockOnClose} collections={[c1, c2]} onSave={mockOnSave} />,
    );

    // Without a default, multi-collection modal starts on picker.
    expect(screen.getByText('New Archive')).toBeInTheDocument();
  });

  it('routes to collection picker (not upload dead-end) when defaultCollectionId becomes stale mid-session', async () => {
    const c1 = createMockCollection({ id: 'c1', name: 'Vinyl Vault' });
    const c2 = createMockCollection({ id: 'c2', name: 'Chocolate Vault' });

    const { rerender } = renderWithProviders(
      <AddItemModal
        isOpen
        onClose={mockOnClose}
        collections={[c1, c2]}
        defaultCollectionId="c2"
        onSave={mockOnSave}
      />,
    );

    // Opens on upload step with c2 preselected (skip picker).
    expect(screen.getByRole('heading', { name: 'Upload Photo' })).toBeInTheDocument();

    // Mid-session: c2 is deleted, parent re-renders with only c1.
    // The reset effect does NOT re-run (isOpen is still true — CUR-44 guard),
    // so selectedCollectionId is still 'c2' but currentCollection is now null.
    rerender(
      <AddItemModal
        isOpen
        onClose={mockOnClose}
        collections={[c1]}
        defaultCollectionId="c2"
        onSave={mockOnSave}
      />,
    );

    // Close and reopen the modal to trigger the reset effect with the stale default.
    rerender(
      <AddItemModal
        isOpen={false}
        onClose={mockOnClose}
        collections={[c1]}
        defaultCollectionId="c2"
        onSave={mockOnSave}
      />,
    );
    rerender(
      <AddItemModal
        isOpen
        onClose={mockOnClose}
        collections={[c1]}
        defaultCollectionId="c2"
        onSave={mockOnSave}
      />,
    );

    // With only 1 collection remaining and stale default, should skip to upload
    // (single-collection auto-select), NOT get stuck in a dead-end.
    // If there were 2+ collections, it would show the picker instead.
    expect(screen.getByRole('heading', { name: 'Upload Photo' })).toBeInTheDocument();
  });

  it('recovers a stale preselected collection before retrying save mid-session', async () => {
    const user = userEvent.setup();
    const c1 = createMockCollection({ id: 'c1', name: 'Vinyl Vault' });
    const c2 = createMockCollection({ id: 'c2', name: 'Chocolate Vault' });

    const { rerender } = renderWithProviders(
      <AddItemModal
        isOpen
        onClose={mockOnClose}
        collections={[c1, c2]}
        defaultCollectionId="c2"
        onSave={mockOnSave}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Skip and add manually' }));
    await waitFor(() => {
      expect(screen.getAllByRole('textbox').length).toBeGreaterThan(0);
    });

    rerender(
      <AddItemModal
        isOpen
        onClose={mockOnClose}
        collections={[c1]}
        defaultCollectionId="c2"
        onSave={mockOnSave}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Save without story' }));
    expect(screen.getByRole('heading', { name: 'Upload Photo' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Skip and add manually' }));
    await user.type(screen.getAllByRole('textbox')[0], 'Recovered Artifact');
    await user.click(screen.getByRole('button', { name: 'Save without story' }));

    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalledWith(
        'c1',
        expect.objectContaining({ title: 'Recovered Artifact' }),
      );
    });
  });

  it('keeps the modal open and shows save errors returned by onSave', async () => {
    const user = userEvent.setup();
    mockOnSave.mockRejectedValue(new Error('Could not save image. Please try again.'));

    renderWithProviders(
      <AddItemModal
        isOpen
        onClose={mockOnClose}
        collections={[createMockCollection()]}
        onSave={mockOnSave}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Skip and add manually' }));
    await user.type(screen.getAllByRole('textbox')[0], 'Fragile Artifact');
    await user.click(screen.getByRole('button', { name: 'Save without story' }));

    expect(await screen.findByText('Could not save image. Please try again.')).toBeInTheDocument();
    expect(mockOnClose).not.toHaveBeenCalled();
  });

  it('shows picker on reopen when stale default and multiple collections remain', async () => {
    const c1 = createMockCollection({ id: 'c1', name: 'Vinyl Vault' });
    const c2 = createMockCollection({ id: 'c2', name: 'Chocolate Vault' });
    const c3 = createMockCollection({ id: 'c3', name: 'Sneaker Gallery' });

    const { rerender } = renderWithProviders(
      <AddItemModal
        isOpen
        onClose={mockOnClose}
        collections={[c1, c2, c3]}
        defaultCollectionId="c2"
        onSave={mockOnSave}
      />,
    );

    // Opens directly on upload (c2 preselected).
    expect(screen.getByRole('heading', { name: 'Upload Photo' })).toBeInTheDocument();

    // c2 deleted mid-session. Close and reopen with stale default.
    rerender(
      <AddItemModal
        isOpen={false}
        onClose={mockOnClose}
        collections={[c1, c3]}
        defaultCollectionId="c2"
        onSave={mockOnSave}
      />,
    );
    rerender(
      <AddItemModal
        isOpen
        onClose={mockOnClose}
        collections={[c1, c3]}
        defaultCollectionId="c2"
        onSave={mockOnSave}
      />,
    );

    // Stale default + multiple collections → must show picker, not upload dead-end.
    expect(screen.getByText('New Archive')).toBeInTheDocument();
    expect(screen.getByText('Vinyl Vault')).toBeInTheDocument();
    expect(screen.getByText('Sneaker Gallery')).toBeInTheDocument();
  });

  it('processes a batch upload and renders the analyzed item', async () => {
    const user = userEvent.setup();
    mockRefreshAiEnabled.mockResolvedValue(true);
    mockAnalyzeImage.mockResolvedValue({
      status: 'success',
      title: 'Mock Artifact',
      notes: 'Some notes',
      data: {},
    });

    const collection = createMockCollection({
      name: 'Artifacts',
      customFields: [],
    });

    renderWithProviders(
      <AddItemModal isOpen onClose={mockOnClose} collections={[collection]} onSave={mockOnSave} />,
    );

    const file = new File(['fake'], 'artifact.png', { type: 'image/png' });
    const input = screen.getByTestId('add-item-batch-input') as HTMLInputElement;

    await user.upload(input, file);

    await waitFor(() => {
      expect(mockRefreshAiEnabled).toHaveBeenCalledTimes(1);
      expect(mockAnalyzeImage).toHaveBeenCalled();
    });

    expect(await screen.findByDisplayValue('Mock Artifact')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Archive 1 Artifacts' }));

    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalledTimes(1);
      expect(mockTrackEvent).toHaveBeenCalledWith('item_saved', {
        mode: 'batch',
        has_story: false,
        has_photo: true,
        story_length_bucket: '0',
      });
    });
  });

  it('does not re-save already-saved items when a batch save fails partway and is retried', async () => {
    const user = userEvent.setup();
    mockRefreshAiEnabled.mockResolvedValue(true);
    mockAnalyzeImage
      .mockResolvedValueOnce({ status: 'success', title: 'Artifact A', notes: '', data: {} })
      .mockResolvedValueOnce({ status: 'success', title: 'Artifact B', notes: '', data: {} });

    const collection = createMockCollection({ name: 'Artifacts', customFields: [] });

    renderWithProviders(
      <AddItemModal isOpen onClose={mockOnClose} collections={[collection]} onSave={mockOnSave} />,
    );

    const file1 = new File(['a'], 'a.png', { type: 'image/png' });
    const file2 = new File(['b'], 'b.png', { type: 'image/png' });
    const input = screen.getByTestId('add-item-batch-input') as HTMLInputElement;

    await user.upload(input, [file1, file2]);

    // Wait until both analyzed items render on the batch-verify step.
    expect(await screen.findByDisplayValue('Artifact A')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Artifact B')).toBeInTheDocument();

    // First item saves, the second fails mid-batch.
    mockOnSave.mockReset();
    mockOnSave
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('Could not save image. Please try again.'));

    await user.click(screen.getByRole('button', { name: /Archive \d+ Artifacts/ }));

    expect(await screen.findByText('Could not save image. Please try again.')).toBeInTheDocument();
    expect(mockOnClose).not.toHaveBeenCalled();
    expect(mockOnSave).toHaveBeenCalledTimes(2);
    expect(mockOnSave).toHaveBeenNthCalledWith(
      1,
      collection.id,
      expect.objectContaining({ title: 'Artifact A' }),
    );

    // Retrying must only reprocess the failed item, never the already-saved one.
    mockOnSave.mockReset();
    mockOnSave.mockResolvedValue(undefined);

    await user.click(screen.getByRole('button', { name: /Archive \d+ Artifacts/ }));

    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalledTimes(1);
    });
    expect(mockOnSave).toHaveBeenCalledWith(
      collection.id,
      expect.objectContaining({ title: 'Artifact B' }),
    );
    expect(mockOnSave).not.toHaveBeenCalledWith(
      collection.id,
      expect.objectContaining({ title: 'Artifact A' }),
    );
  });

  it('exposes the upload-step circle as a keyboard-activatable button (CUR-119)', async () => {
    const user = userEvent.setup();
    mockGetPhoto.mockResolvedValue({ dataUrl: undefined });

    renderWithProviders(
      <AddItemModal
        isOpen
        onClose={mockOnClose}
        collections={[createMockCollection()]}
        onSave={mockOnSave}
      />,
    );

    await screen.findByRole('heading', { name: 'Upload Photo' });

    // The visual circle and the explicit CTA below both name themselves
    // "Upload Photo". The circle is the first interactive control on the
    // step and used to be a div with no role/tabindex/keyboard handler.
    const uploadButtons = screen.getAllByRole('button', { name: 'Upload Photo' });
    expect(uploadButtons.length).toBeGreaterThanOrEqual(2);

    const circle = uploadButtons[0];
    expect(circle.tagName).toBe('BUTTON');

    circle.focus();
    expect(circle).toHaveFocus();

    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(mockGetPhoto).toHaveBeenCalledWith(
        expect.objectContaining({ source: CameraSource.Photos }),
      );
    });
  });

  it('renders the analyzing step with theme-aware copy on Vault (#110)', async () => {
    const user = userEvent.setup();
    setMockTheme('vault');
    mockRefreshAiEnabled.mockResolvedValue(true);
    // Pending promise — keep the modal on the analyzing step so we can inspect it.
    mockAnalyzeImage.mockReturnValue(new Promise<never>(() => {}));

    const collection = createMockCollection({ name: 'Artifacts', customFields: [] });
    renderWithProviders(
      <AddItemModal isOpen onClose={mockOnClose} collections={[collection]} onSave={mockOnSave} />,
    );

    const file = new File(['a'], 'a.png', { type: 'image/png' });
    const input = screen.getByTestId('add-item-batch-input') as HTMLInputElement;
    await user.upload(input, file);

    // Heading must use the theme's foreground; text-stone-900 would disappear on the dark Vault panel.
    const heading = await screen.findByRole('heading', { name: 'Analyzing photo...' });
    expect(heading.className).toContain('text-white');
    expect(heading.className).not.toContain('text-stone-900');

    // Helper copy ("Gemini is extracting…") must stay above WCAG AA on stone-900,
    // i.e. it must not regress to stone-500 (~3.77:1).
    const helper = screen.getByText('Gemini is extracting details for your collection.');
    expect(helper.className).not.toContain('text-stone-500');

    // CUR-92: the Sparkles pill behind the icon must drop the Gallery-only
    // white surface so it doesn't punch through the Vault panel.
    const sparklesIcon = heading.parentElement?.parentElement?.querySelector('svg.lucide-sparkles');
    const pill = sparklesIcon?.parentElement;
    expect(pill?.className).not.toContain('bg-white');
    expect(pill?.className).not.toContain('border-stone-100');
  });

  it('fades the verify-step scroll edge while fields remain below the fold (CUR-45)', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <AddItemModal
        isOpen
        onClose={mockOnClose}
        collections={[createMockCollection()]}
        onSave={mockOnSave}
      />,
    );

    // Single collection auto-selects the upload step; skip AI to reach verify.
    await user.click(await screen.findByRole('button', { name: 'Skip and add manually' }));

    const fade = await screen.findByTestId('add-item-scroll-fade');
    const scroller = screen.getByTestId('add-item-scroll');

    // No measurable overflow yet (happy-dom reports 0 height) → fade hidden.
    expect(fade.className).toContain('opacity-0');

    // Simulate overflowing content with room left to scroll down.
    Object.defineProperty(scroller, 'scrollHeight', { configurable: true, value: 1000 });
    Object.defineProperty(scroller, 'clientHeight', { configurable: true, value: 300 });
    Object.defineProperty(scroller, 'scrollTop', { configurable: true, value: 0 });
    fireEvent.scroll(scroller);
    expect(fade.className).toContain('opacity-100');

    // Scrolled to the bottom → fade clears so the last field reads as complete.
    Object.defineProperty(scroller, 'scrollTop', { configurable: true, value: 700 });
    fireEvent.scroll(scroller);
    expect(fade.className).toContain('opacity-0');
  });

  describe('discard confirmation (CUR-80)', () => {
    it('closes immediately when the user has no work in progress on the verify step', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <AddItemModal
          isOpen
          onClose={mockOnClose}
          collections={[createMockCollection()]}
          onSave={mockOnSave}
        />,
      );

      // Skip → verify step with empty form, no photo, no batch.
      await user.click(screen.getByRole('button', { name: 'Skip and add manually' }));

      await user.click(screen.getByRole('button', { name: 'Close' }));

      expect(mockOnClose).toHaveBeenCalledTimes(1);
      expect(screen.queryByTestId('add-item-discard-confirm')).not.toBeInTheDocument();
    });

    it('confirms before discarding a typed title + story on the verify step', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <AddItemModal
          isOpen
          onClose={mockOnClose}
          collections={[createMockCollection()]}
          onSave={mockOnSave}
        />,
      );

      await user.click(screen.getByRole('button', { name: 'Skip and add manually' }));
      await user.type(screen.getAllByRole('textbox')[0], 'Sentimental Artifact');
      const storyField = screen.getByPlaceholderText("What's the story behind this piece?");
      await user.type(storyField, 'Found in my grandmother attic.');

      // Tapping X should show the confirmation, not close the modal.
      await user.click(screen.getByRole('button', { name: 'Close' }));

      expect(mockOnClose).not.toHaveBeenCalled();
      expect(await screen.findByTestId('add-item-discard-confirm')).toBeInTheDocument();
      expect(screen.getByText('Discard this item?')).toBeInTheDocument();

      // Keep editing returns to the form with everything intact.
      await user.click(screen.getByRole('button', { name: 'Keep editing' }));

      expect(screen.queryByTestId('add-item-discard-confirm')).not.toBeInTheDocument();
      expect(screen.getByDisplayValue('Sentimental Artifact')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Found in my grandmother attic.')).toBeInTheDocument();
      expect(mockOnClose).not.toHaveBeenCalled();

      // Tapping X → Discard actually closes.
      await user.click(screen.getByRole('button', { name: 'Close' }));
      await user.click(screen.getByRole('button', { name: 'Discard' }));

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('confirms before discarding a rating-only manual entry', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <AddItemModal
          isOpen
          onClose={mockOnClose}
          collections={[createMockCollection()]}
          onSave={mockOnSave}
        />,
      );

      await user.click(screen.getByRole('button', { name: 'Skip and add manually' }));
      await user.click(screen.getByRole('button', { name: 'Rate 4 stars' }));

      await user.click(screen.getByRole('button', { name: 'Close' }));

      expect(mockOnClose).not.toHaveBeenCalled();
      expect(await screen.findByTestId('add-item-discard-confirm')).toBeInTheDocument();

      // Keep editing → rating is still set on the form behind.
      await user.click(screen.getByRole('button', { name: 'Keep editing' }));
      expect(
        screen.getByRole('button', { name: 'Rate 4 stars', pressed: true }),
      ).toBeInTheDocument();
    });

    it('confirms before discarding a custom-field-only manual entry', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <AddItemModal
          isOpen
          onClose={mockOnClose}
          collections={[createMockCollection()]}
          onSave={mockOnSave}
        />,
      );

      await user.click(screen.getByRole('button', { name: 'Skip and add manually' }));

      // Verify step textboxes are: [0] title, [1] story textarea, [2] first
      // custom field (Artist in the mock vinyl template).
      const fields = screen.getAllByRole('textbox');
      await user.type(fields[2], 'Miles Davis');

      await user.click(screen.getByRole('button', { name: 'Close' }));

      expect(mockOnClose).not.toHaveBeenCalled();
      expect(screen.getByTestId('add-item-discard-confirm')).toBeInTheDocument();
    });

    it('confirms on Esc when a batch is queued for save', async () => {
      const user = userEvent.setup();
      mockRefreshAiEnabled.mockResolvedValue(true);
      mockAnalyzeImage.mockResolvedValue({
        status: 'success',
        title: 'Batched Artifact',
        notes: '',
        data: {},
      });

      renderWithProviders(
        <AddItemModal
          isOpen
          onClose={mockOnClose}
          collections={[createMockCollection({ customFields: [] })]}
          onSave={mockOnSave}
        />,
      );

      const file = new File(['fake'], 'a.png', { type: 'image/png' });
      const input = screen.getByTestId('add-item-batch-input') as HTMLInputElement;
      await user.upload(input, file);

      // Land on batch-verify once analysis finishes.
      await screen.findByDisplayValue('Batched Artifact');

      await user.keyboard('{Escape}');

      expect(mockOnClose).not.toHaveBeenCalled();
      expect(screen.getByTestId('add-item-discard-confirm')).toBeInTheDocument();

      // Esc again dismisses the confirmation without losing the batch.
      await user.keyboard('{Escape}');

      expect(screen.queryByTestId('add-item-discard-confirm')).not.toBeInTheDocument();
      expect(screen.getByDisplayValue('Batched Artifact')).toBeInTheDocument();
      expect(mockOnClose).not.toHaveBeenCalled();
    });

    it('yields Escape to the nested ImageEditModal — child closes alone, parent stays open (CUR-86)', async () => {
      const user = userEvent.setup();
      mockRefreshAiEnabled.mockResolvedValue(true);
      mockAnalyzeImage.mockResolvedValue({
        status: 'success',
        title: 'Mock Artifact',
        notes: '',
        data: {},
      });
      mockGetPhoto.mockResolvedValue({
        dataUrl: 'data:image/png;base64,ZmFrZQ==',
        format: 'png',
      });

      renderWithProviders(
        <AddItemModal
          isOpen
          onClose={mockOnClose}
          collections={[createMockCollection({ customFields: [] })]}
          onSave={mockOnSave}
        />,
      );

      // Single-image upload routes to the verify step (not batch-verify).
      // Two controls expose "Upload Photo" — the visual circle (CUR-119) and
      // the explicit CTA below it. Clicking either calls pickFromGallery.
      await user.click(screen.getAllByRole('button', { name: /upload photo/i })[0]);

      // Wait for analysis to land on the verify step.
      expect(await screen.findByDisplayValue('Mock Artifact')).toBeInTheDocument();

      // Open the nested image editor.
      await user.click(screen.getByRole('button', { name: /edit photo/i }));
      const editorDialog = await screen.findByRole('dialog', { name: /edit photo/i });
      expect(editorDialog).toHaveAttribute('aria-labelledby', 'image-edit-title');

      // Escape on the child should close only the child — the parent's
      // CUR-80 discard-confirm path must NOT fire even though there's work
      // in progress (a title is in the form).
      await user.keyboard('{Escape}');

      await waitFor(() => {
        expect(screen.queryByRole('dialog', { name: /edit photo/i })).not.toBeInTheDocument();
      });
      expect(screen.queryByTestId('add-item-discard-confirm')).not.toBeInTheDocument();
      expect(screen.getByDisplayValue('Mock Artifact')).toBeInTheDocument();
      expect(mockOnClose).not.toHaveBeenCalled();
    });
  });
});
