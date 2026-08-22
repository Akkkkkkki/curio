import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { act, screen, waitFor, fireEvent } from '@testing-library/react';
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
import { compressImageForAi } from '@/services/imageProcessor';
import { Camera, CameraSource } from '@capacitor/camera';

const mockCompressImageForAi = compressImageForAi as ReturnType<typeof vi.fn>;
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
    mockRefreshAiEnabled.mockReset();
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
    expect(screen.getByText('Choose a collection')).toBeInTheDocument();
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
    expect(screen.queryByText('Choose a collection')).not.toBeInTheDocument();
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
    expect(screen.queryByText('Choose a collection')).not.toBeInTheDocument();
  });

  it('describes AI in the future tense on the idle upload step, before any photo (#374)', () => {
    const c1 = createMockCollection({ id: 'c1', name: 'Vinyl Vault' });

    renderWithProviders(
      <AddItemModal
        isOpen
        onClose={mockOnClose}
        collections={[c1]}
        defaultCollectionId="c1"
        onSave={mockOnSave}
      />,
    );

    // Idle upload state: nothing is being extracted yet, so the copy must
    // promise the future rather than claim analysis is already running.
    expect(
      screen.getByText('Add a photo and Gemini will suggest the details.'),
    ).toBeInTheDocument();
    expect(
      screen.queryByText('Gemini is extracting details for your collection.'),
    ).not.toBeInTheDocument();
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
    expect(screen.getByText('Choose a collection')).toBeInTheDocument();
    expect(screen.getByText('Vinyl Vault')).toBeInTheDocument();
  });

  it('shows collection picker when no defaultCollectionId and multiple collections', async () => {
    const c1 = createMockCollection({ id: 'c1', name: 'Vinyl Vault' });
    const c2 = createMockCollection({ id: 'c2', name: 'Chocolate Vault' });

    renderWithProviders(
      <AddItemModal isOpen onClose={mockOnClose} collections={[c1, c2]} onSave={mockOnSave} />,
    );

    // Without a default, multi-collection modal starts on picker.
    expect(screen.getByText('Choose a collection')).toBeInTheDocument();
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

  it('makes the single-item verify step photo-first with details collapsed by default (CUR-125)', async () => {
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

    expect(screen.getByTestId('add-item-photo-hero')).toBeInTheDocument();
    expect(screen.getByTestId('add-item-save-footer')).toHaveClass('sticky');
    expect(
      screen.getByText('Start with the photo. Details can stay tucked away until you need them.'),
    ).toBeInTheDocument();
    expect(screen.getByTestId('add-item-more-details-toggle')).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    expect(screen.queryByRole('button', { name: 'Rate 4 stars' })).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue('Miles Davis')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'More details' }));

    expect(screen.getByTestId('add-item-more-details')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Rate 4 stars' })).toBeInTheDocument();
  });

  it('keeps AI metadata as accepted suggestion chips instead of hidden prefilled fields (CUR-125)', async () => {
    const user = userEvent.setup();
    mockRefreshAiEnabled.mockResolvedValue(true);
    mockAnalyzeImage.mockResolvedValue({
      status: 'success',
      title: 'Kind of Blue',
      notes: 'AI-generated description',
      aiDescription: 'A blue jazz record sleeve.',
      data: {
        artist: 'Miles Davis',
        year: '1959',
      },
    });
    mockGetPhoto.mockResolvedValue({
      dataUrl: 'data:image/png;base64,ZmFrZQ==',
      format: 'png',
    });

    const collection = createMockCollection();
    renderWithProviders(
      <AddItemModal isOpen onClose={mockOnClose} collections={[collection]} onSave={mockOnSave} />,
    );

    await user.click(screen.getAllByRole('button', { name: /upload photo/i })[0]);

    expect(await screen.findByDisplayValue('Kind of Blue')).toBeInTheDocument();
    expect(screen.getByTestId('add-item-ai-suggestions')).toBeInTheDocument();
    expect(screen.queryByDisplayValue('Miles Davis')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Accept Artist: Miles Davis' }));
    await user.click(screen.getByRole('button', { name: 'More details' }));

    expect(screen.getByDisplayValue('Miles Davis')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Save without story' }));

    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalledWith(
        collection.id,
        expect.objectContaining({
          title: 'Kind of Blue',
          data: expect.objectContaining({ artist: 'Miles Davis' }),
        }),
      );
    });
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
    expect(screen.getByText('Choose a collection')).toBeInTheDocument();
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

    await user.click(screen.getByRole('button', { name: 'Save 1 piece' }));

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

  it('shows localized fallback copy, not raw AI errors, after single-photo analysis fails', async () => {
    const user = userEvent.setup();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockRefreshAiEnabled.mockResolvedValue(true);
    mockAnalyzeImage.mockResolvedValue({
      status: 'error',
      message: '413 Payload Too Large',
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

    await user.click(screen.getAllByRole('button', { name: /upload photo/i })[0]);

    expect(
      await screen.findByText('Analysis failed. Continue with manual entry.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('413 Payload Too Large')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry analysis' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Enter manually' })).toBeInTheDocument();
    expect(warnSpy).toHaveBeenCalledWith('AI analysis failed:', '413 Payload Too Large');

    warnSpy.mockRestore();
  });

  it('shows localized fallback copy, not raw AI errors, after batch analysis fails', async () => {
    const user = userEvent.setup();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockRefreshAiEnabled.mockResolvedValue(true);
    mockAnalyzeImage.mockResolvedValue({
      status: 'error',
      message: 'HTTP 503 from /api/gemini/analyze',
    });

    renderWithProviders(
      <AddItemModal
        isOpen
        onClose={mockOnClose}
        collections={[createMockCollection({ name: 'Artifacts', customFields: [] })]}
        onSave={mockOnSave}
      />,
    );

    const file = new File(['fake'], 'artifact.png', { type: 'image/png' });
    const input = screen.getByTestId('add-item-batch-input') as HTMLInputElement;
    await user.upload(input, file);

    expect(
      await screen.findByText('Analysis failed. Continue with manual entry.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('HTTP 503 from /api/gemini/analyze')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry analysis' })).toBeInTheDocument();
    expect(warnSpy).toHaveBeenCalledWith(
      'AI analysis failed:',
      'HTTP 503 from /api/gemini/analyze',
    );

    warnSpy.mockRestore();
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

    await user.click(screen.getByRole('button', { name: /Save \d+ pieces?/ }));

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

    await user.click(screen.getByRole('button', { name: /Save \d+ pieces?/ }));

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

  it('surfaces a calm slow-analysis notice after 10s while keeping the manual path (#73)', async () => {
    mockRefreshAiEnabled.mockResolvedValue(true);
    let resolveAnalysis: (value: unknown) => void = () => {};
    mockAnalyzeImage.mockReturnValue(
      new Promise((resolve) => {
        resolveAnalysis = resolve;
      }),
    );

    const collection = createMockCollection({ name: 'Artifacts', customFields: [] });
    renderWithProviders(
      <AddItemModal isOpen onClose={mockOnClose} collections={[collection]} onSave={mockOnSave} />,
    );

    // Fake timers must be active before the analyzing step mounts, or the
    // notice timeout is scheduled on the real clock and can't be advanced.
    // shouldAdvanceTime keeps userEvent's internal micro-delays flowing so
    // the upload interaction doesn't dead-lock on the mocked clock.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      // Single-photo path (Camera.getPhoto → analyze).
      mockGetPhoto.mockResolvedValue({ dataUrl: 'data:image/png;base64,ZmFrZQ==' });
      await user.click(screen.getAllByRole('button', { name: 'Upload Photo' })[0]);

      await screen.findByRole('heading', { name: 'Analyzing photo...' });
      expect(screen.queryByTestId('analysis-slow-notice')).not.toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(10_000);
      });
      const notice = screen.getByTestId('analysis-slow-notice');
      expect(notice).toHaveTextContent(
        'Taking longer than usual. You can skip the wait and enter the details yourself.',
      );
      // Announced politely for screen readers, with the escape hatch intact.
      expect(notice.parentElement).toHaveAttribute('role', 'status');
      expect(screen.getByRole('button', { name: 'Enter manually' })).toBeInTheDocument();

      // A late result still lands, and the notice leaves with the step.
      vi.useRealTimers();
      resolveAnalysis({ status: 'success', title: 'Late Artifact', data: {} });
      await waitFor(() => {
        expect(screen.queryByTestId('analysis-slow-notice')).not.toBeInTheDocument();
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it('shows the slow-analysis notice during batch analyzing now that the escape is real (#366)', async () => {
    mockRefreshAiEnabled.mockResolvedValue(true);
    mockAnalyzeImage.mockReturnValue(new Promise<never>(() => {}));

    const collection = createMockCollection({ name: 'Artifacts', customFields: [] });
    renderWithProviders(
      <AddItemModal isOpen onClose={mockOnClose} collections={[collection]} onSave={mockOnSave} />,
    );

    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const files = [
        new File(['a'], 'a.png', { type: 'image/png' }),
        new File(['b'], 'b.png', { type: 'image/png' }),
      ];
      const input = screen.getByTestId('add-item-batch-input') as HTMLInputElement;
      await user.upload(input, files);

      await screen.findByRole('heading', { name: 'Analyzing photo...' });
      // Batch has its own honest progress line…
      await screen.findByText('Analyzing 1 of 2');

      act(() => {
        vi.advanceTimersByTime(10_000);
      });
      // …and the notice's "enter the details yourself" promise is now kept
      // during batch runs (#366), so it shows here too.
      expect(screen.getByTestId('analysis-slow-notice')).toBeInTheDocument();

      // Asking for manual entry replaces the notice with the wrapping-up
      // acknowledgment — we shouldn't offer a skip that already happened.
      await user.click(screen.getByRole('button', { name: 'Enter manually' }));
      expect(screen.queryByTestId('analysis-slow-notice')).not.toBeInTheDocument();
      expect(screen.getByTestId('batch-manual-pending')).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('cancels the rest of a batch when the user enters manually during analyzing (#366)', async () => {
    const user = userEvent.setup();
    mockRefreshAiEnabled.mockResolvedValue(true);
    let resolveFirst: (value: unknown) => void = () => {};
    mockAnalyzeImage.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveFirst = resolve;
        }),
    );

    const collection = createMockCollection({ name: 'Artifacts', customFields: [] });
    renderWithProviders(
      <AddItemModal isOpen onClose={mockOnClose} collections={[collection]} onSave={mockOnSave} />,
    );

    const files = [
      new File(['a'], 'a.png', { type: 'image/png' }),
      new File(['b'], 'b.png', { type: 'image/png' }),
    ];
    const input = screen.getByTestId('add-item-batch-input') as HTMLInputElement;
    await user.upload(input, files);

    // First photo is in flight.
    await screen.findByRole('heading', { name: 'Analyzing photo...' });
    await waitFor(() => expect(mockAnalyzeImage).toHaveBeenCalledTimes(1));

    // Escape during the batch: acknowledged immediately, button disarmed.
    const escape = screen.getByRole('button', { name: 'Enter manually' });
    await user.click(escape);
    expect(screen.getByTestId('batch-manual-pending')).toBeInTheDocument();
    expect(escape).toBeDisabled();

    // The in-flight photo finishes; the batch must stop there and land on
    // batch-verify with the second photo as a blank, manually editable row.
    resolveFirst({ status: 'success', title: 'First Artifact', data: {} });
    await screen.findByTestId('add-item-batch-info');
    expect(await screen.findByDisplayValue('First Artifact')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save 2 pieces' })).toBeInTheDocument();
    // The second photo was never sent to analysis.
    expect(mockAnalyzeImage).toHaveBeenCalledTimes(1);
  });

  it('does not let a late-finishing batch replace the step after the modal was reset (#366)', async () => {
    const user = userEvent.setup();
    mockRefreshAiEnabled.mockResolvedValue(true);
    let resolveFirst: (value: unknown) => void = () => {};
    mockAnalyzeImage.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveFirst = resolve;
        }),
    );

    const collection = createMockCollection({ name: 'Artifacts', customFields: [] });
    const { rerender } = renderWithProviders(
      <AddItemModal isOpen onClose={mockOnClose} collections={[collection]} onSave={mockOnSave} />,
    );

    const files = [
      new File(['a'], 'a.png', { type: 'image/png' }),
      new File(['b'], 'b.png', { type: 'image/png' }),
    ];
    const input = screen.getByTestId('add-item-batch-input') as HTMLInputElement;
    await user.upload(input, files);
    await screen.findByRole('heading', { name: 'Analyzing photo...' });
    await waitFor(() => expect(mockAnalyzeImage).toHaveBeenCalledTimes(1));

    // Close and reopen: the reset claims a new analysis session.
    rerender(
      <AddItemModal
        isOpen={false}
        onClose={mockOnClose}
        collections={[collection]}
        onSave={mockOnSave}
      />,
    );
    rerender(
      <AddItemModal isOpen onClose={mockOnClose} collections={[collection]} onSave={mockOnSave} />,
    );
    await screen.findByRole('heading', { name: 'Upload Photo' });

    // The stale batch resolves late — it must not yank the user to
    // batch-verify or leak its items into the fresh session.
    resolveFirst({ status: 'success', title: 'Stale Artifact', data: {} });
    // Let the abandoned loadBatch chain fully settle before asserting.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(mockAnalyzeImage).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('heading', { name: 'Upload Photo' })).toBeInTheDocument();
    expect(screen.queryByTestId('add-item-batch-info')).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue('Stale Artifact')).not.toBeInTheDocument();
  });

  it('stops a closed batch before analyzing the next photo (#366)', async () => {
    const user = userEvent.setup();
    mockRefreshAiEnabled.mockResolvedValue(true);
    let resolveFirst: (value: unknown) => void = () => {};
    mockAnalyzeImage.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveFirst = resolve;
        }),
    );

    const collection = createMockCollection({ name: 'Artifacts', customFields: [] });
    const { rerender } = renderWithProviders(
      <AddItemModal isOpen onClose={mockOnClose} collections={[collection]} onSave={mockOnSave} />,
    );

    const files = [
      new File(['a'], 'a.png', { type: 'image/png' }),
      new File(['b'], 'b.png', { type: 'image/png' }),
    ];
    const input = screen.getByTestId('add-item-batch-input') as HTMLInputElement;
    await user.upload(input, files);
    await screen.findByRole('heading', { name: 'Analyzing photo...' });
    await waitFor(() => expect(mockAnalyzeImage).toHaveBeenCalledTimes(1));

    // Closing without reopening used to leave the run id unchanged, so the
    // hidden batch continued into the second photo and kept spending AI calls.
    rerender(
      <AddItemModal
        isOpen={false}
        onClose={mockOnClose}
        collections={[collection]}
        onSave={mockOnSave}
      />,
    );

    resolveFirst({ status: 'success', title: 'Closed Artifact', data: {} });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(mockAnalyzeImage).toHaveBeenCalledTimes(1);
  });

  it('stops a closed batch while the first photo is still compressing', async () => {
    // Compression is an await gap before any request is sent. The run-id check
    // sat above it, so closing mid-compression still spent an AI call on a
    // photo the user had already dismissed.
    const user = userEvent.setup();
    mockRefreshAiEnabled.mockResolvedValue(true);
    let releaseCompression: () => void = () => {};
    mockCompressImageForAi.mockImplementationOnce(
      (dataUrl: string) =>
        new Promise((resolve) => {
          releaseCompression = () => {
            const idx = dataUrl.indexOf(',');
            resolve(idx >= 0 ? dataUrl.slice(idx + 1) : dataUrl);
          };
        }),
    );

    const collection = createMockCollection({ name: 'Artifacts', customFields: [] });
    const { rerender } = renderWithProviders(
      <AddItemModal isOpen onClose={mockOnClose} collections={[collection]} onSave={mockOnSave} />,
    );

    const files = [
      new File(['a'], 'a.png', { type: 'image/png' }),
      new File(['b'], 'b.png', { type: 'image/png' }),
    ];
    const input = screen.getByTestId('add-item-batch-input') as HTMLInputElement;
    await user.upload(input, files);
    await screen.findByRole('heading', { name: 'Analyzing photo...' });
    await waitFor(() => expect(mockCompressImageForAi).toHaveBeenCalled());
    expect(mockAnalyzeImage).not.toHaveBeenCalled();

    rerender(
      <AddItemModal
        isOpen={false}
        onClose={mockOnClose}
        collections={[collection]}
        onSave={mockOnSave}
      />,
    );

    releaseCompression();
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(mockAnalyzeImage).not.toHaveBeenCalled();
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

  it('sizes the verify-step scroll panel with flex, never percentage heights (CUR-142)', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <AddItemModal
        isOpen
        onClose={mockOnClose}
        collections={[createMockCollection()]}
        onSave={mockOnSave}
      />,
    );

    await user.click(await screen.findByRole('button', { name: 'Skip and add manually' }));

    const scroller = screen.getByTestId('add-item-scroll');
    const panel = scroller.parentElement!;

    // The desktop dialog is sm:h-auto, so its height is indefinite and h-full
    // on the scroller resolves to content height — the panel then paints over
    // the Save footer and clicks land on the rating stars. Both levels must
    // size via flex so the footer always stays below the scroll area.
    expect(panel.className).toContain('flex-col');
    expect(panel.className).toContain('min-h-0');
    expect(scroller.className).not.toContain('h-full');
    expect(scroller.className).toContain('flex-1');
    expect(scroller.className).toContain('min-h-0');

    // The Save footer is a sibling below the scroll panel, not content inside
    // it — the structural guarantee that it cannot be covered by overflow.
    const saveButton = screen.getByRole('button', { name: /save without story/i });
    expect(scroller.contains(saveButton)).toBe(false);
    expect(panel.contains(saveButton)).toBe(false);
    expect(
      panel.compareDocumentPosition(saveButton) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  describe('rating value clarity (CUR-47)', () => {
    it('shows the selected rating as a numeric value next to the stars in manual entry', async () => {
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

      // Rating lives behind the More details disclosure (CUR-125).
      await user.click(screen.getByRole('button', { name: 'More details' }));

      // Unrated: no numeric value shown yet.
      expect(screen.queryByText(/^\d\/5$/)).not.toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Rate 3 stars' }));
      expect(screen.getByText('3/5')).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Rate 5 stars' }));
      expect(screen.getByText('5/5')).toBeInTheDocument();
      expect(screen.queryByText('3/5')).not.toBeInTheDocument();
    });

    it('shows the numeric rating value for a batch item', async () => {
      const user = userEvent.setup();
      mockRefreshAiEnabled.mockResolvedValue(true);
      mockAnalyzeImage.mockResolvedValue({
        status: 'success',
        title: 'Mock Artifact',
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

      const file = new File(['fake'], 'artifact.png', { type: 'image/png' });
      await user.upload(screen.getByTestId('add-item-batch-input') as HTMLInputElement, file);
      expect(await screen.findByDisplayValue('Mock Artifact')).toBeInTheDocument();

      expect(screen.queryByText(/^\d\/5$/)).not.toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Rate 4 stars' }));
      expect(screen.getByText('4/5')).toBeInTheDocument();
    });
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
      await user.click(screen.getByRole('button', { name: 'More details' }));
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
      await user.click(screen.getByRole('button', { name: 'More details' }));

      // Verify step textboxes are: [0] title, [1] story textarea, [2] first
      // custom field (Artist in the mock vinyl template).
      const fields = screen.getAllByRole('textbox');
      await user.type(fields[2], 'Miles Davis');

      await user.click(screen.getByRole('button', { name: 'Close' }));

      expect(mockOnClose).not.toHaveBeenCalled();
      expect(screen.getByTestId('add-item-discard-confirm')).toBeInTheDocument();
    });

    it('confirms before discarding a single selected photo while analysis is running', async () => {
      const user = userEvent.setup();
      mockRefreshAiEnabled.mockResolvedValue(true);
      mockAnalyzeImage.mockReturnValue(new Promise<never>(() => {}));
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

      await user.click(screen.getAllByRole('button', { name: /upload photo/i })[0]);
      await screen.findByRole('heading', { name: 'Analyzing photo...' });
      await user.click(screen.getByRole('button', { name: 'Close' }));

      expect(mockOnClose).not.toHaveBeenCalled();
      expect(screen.getByTestId('add-item-discard-confirm')).toBeInTheDocument();
    });

    it('confirms before discarding a selected batch while analysis is running', async () => {
      const user = userEvent.setup();
      mockRefreshAiEnabled.mockResolvedValue(true);
      mockAnalyzeImage.mockReturnValue(new Promise<never>(() => {}));

      renderWithProviders(
        <AddItemModal
          isOpen
          onClose={mockOnClose}
          collections={[createMockCollection({ customFields: [] })]}
          onSave={mockOnSave}
        />,
      );

      const files = [
        new File(['a'], 'a.png', { type: 'image/png' }),
        new File(['b'], 'b.png', { type: 'image/png' }),
      ];
      const input = screen.getByTestId('add-item-batch-input') as HTMLInputElement;
      await user.upload(input, files);

      await screen.findByRole('heading', { name: 'Analyzing photo...' });
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

  describe('Vault theme contrast (CUR-22)', () => {
    it('renders collection picker tiles with theme-aware surface tokens on Vault', () => {
      setMockTheme('vault');
      renderWithProviders(
        <AddItemModal
          isOpen
          onClose={mockOnClose}
          collections={[
            createMockCollection({ id: 'a', name: 'Vinyl' }),
            createMockCollection({ id: 'b', name: 'Chocolate' }),
          ]}
          onSave={mockOnSave}
        />,
      );

      const tiles = screen.getAllByTestId('add-item-collection-tile');
      expect(tiles).toHaveLength(2);
      tiles.forEach((tile) => {
        // Light Gallery tokens (bg-stone-50/50, text-stone-800) must NOT leak
        // into the dark surface — they collapse against the dark modal body.
        expect(tile).not.toHaveClass('bg-stone-50/50');
        expect(tile).toHaveClass('bg-white/5');
        expect(tile).toHaveClass('border-white/10');
      });

      const titles = tiles.map((tile) => tile.querySelector('span.font-bold'));
      titles.forEach((title) => {
        expect(title).not.toBeNull();
        expect(title!.className).toMatch(/text-white/);
        expect(title!.className).not.toMatch(/text-stone-800/);
      });
    });

    it('renders the upload empty-state circle with a Vault-tinted surface, not a cream pill', () => {
      setMockTheme('vault');
      renderWithProviders(
        <AddItemModal
          isOpen
          onClose={mockOnClose}
          collections={[createMockCollection({ customFields: [] })]}
          onSave={mockOnSave}
        />,
      );

      const uploadEmpty = screen.getByTestId('add-item-upload-empty');
      expect(uploadEmpty).toHaveClass('bg-white/5');
      expect(uploadEmpty).toHaveClass('border-white/15');
      // The empty cream pill must not survive on Vault.
      expect(uploadEmpty).not.toHaveClass('bg-stone-50');
      expect(uploadEmpty).not.toHaveClass('hover:bg-amber-50');
    });

    it('keeps the "Skip Manual" link hover visible against the dark surface', () => {
      setMockTheme('vault');
      renderWithProviders(
        <AddItemModal
          isOpen
          onClose={mockOnClose}
          collections={[createMockCollection({ customFields: [] })]}
          onSave={mockOnSave}
        />,
      );

      const skipLink = screen.getByTestId('add-item-skip-manual');
      // hover:text-stone-600 was invisible on stone-900 — pin to white.
      expect(skipLink).toHaveClass('hover:text-white');
      expect(skipLink.className).not.toMatch(/hover:text-stone-(500|600|700)/);
    });

    it('preserves Gallery tokens for the collection picker on the default theme', () => {
      setMockTheme('gallery');
      renderWithProviders(
        <AddItemModal
          isOpen
          onClose={mockOnClose}
          collections={[
            createMockCollection({ id: 'a', name: 'Vinyl' }),
            createMockCollection({ id: 'b', name: 'Chocolate' }),
          ]}
          onSave={mockOnSave}
        />,
      );

      const tile = screen.getAllByTestId('add-item-collection-tile')[0];
      expect(tile).toHaveClass('bg-stone-50/50');
      expect(tile).toHaveClass('border-stone-100');
    });
  });

  describe('Batch surfaces theme contrast (CUR-110)', () => {
    const uploadBatchFile = async (user: ReturnType<typeof userEvent.setup>) => {
      const file = new File(['fake'], 'artifact.png', { type: 'image/png' });
      const input = screen.getByTestId('add-item-batch-input') as HTMLInputElement;
      await user.upload(input, file);
      return screen.findByTestId('add-item-batch-info');
    };

    beforeEach(() => {
      mockRefreshAiEnabled.mockResolvedValue(true);
      mockAnalyzeImage.mockResolvedValue({
        status: 'success',
        title: 'Mock Artifact',
        notes: '',
        data: {},
      });
    });

    it('renders the batch info card with Vault warn tones, not the Gallery pastel', async () => {
      setMockTheme('vault');
      const user = userEvent.setup();
      renderWithProviders(
        <AddItemModal
          isOpen
          onClose={mockOnClose}
          collections={[createMockCollection({ name: 'Artifacts', customFields: [] })]}
          onSave={mockOnSave}
        />,
      );

      const infoCard = await uploadBatchFile(user);
      // The Gallery-only pastel card collapses against Vault's dark panel.
      expect(infoCard).not.toHaveClass('bg-amber-50');
      expect(infoCard).toHaveClass('bg-amber-500/10');
      expect(infoCard).toHaveClass('border-amber-400/20');
      const title = infoCard.querySelector('h4');
      expect(title).not.toBeNull();
      expect(title!.className).toMatch(/text-amber-100/);
      expect(title!.className).not.toMatch(/text-amber-900/);
    });

    it('renders the batch error banner with Vault warn tones after a failed save', async () => {
      setMockTheme('vault');
      const user = userEvent.setup();
      renderWithProviders(
        <AddItemModal
          isOpen
          onClose={mockOnClose}
          collections={[createMockCollection({ name: 'Artifacts', customFields: [] })]}
          onSave={mockOnSave}
        />,
      );

      await uploadBatchFile(user);
      mockOnSave.mockReset();
      mockOnSave.mockRejectedValueOnce(new Error('Could not save image. Please try again.'));
      await user.click(screen.getByRole('button', { name: /Save \d+ pieces?/ }));

      const banner = await screen.findByText('Could not save image. Please try again.');
      expect(banner).not.toHaveClass('bg-amber-50');
      expect(banner).toHaveClass('bg-amber-500/10');
      expect(banner).toHaveClass('text-amber-200');
    });

    it('preserves the Gallery tones for the batch info card on the default theme', async () => {
      setMockTheme('gallery');
      const user = userEvent.setup();
      renderWithProviders(
        <AddItemModal
          isOpen
          onClose={mockOnClose}
          collections={[createMockCollection({ name: 'Artifacts', customFields: [] })]}
          onSave={mockOnSave}
        />,
      );

      const infoCard = await uploadBatchFile(user);
      expect(infoCard).toHaveClass('bg-amber-50');
      expect(infoCard).toHaveClass('border-amber-100');
    });
  });

  describe('Accessibility - label associations (CUR-62)', () => {
    it('associates the manual Title input with its label', async () => {
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

      // Resolves only when the Title <label> is associated with its input.
      const titleInput = await screen.findByLabelText('Title');
      expect(titleInput).toHaveAttribute('id', 'add-item-title');
    });
  });

  describe('Camera capture gating (CUR-161)', () => {
    // Controllable `(pointer: coarse)` mock: every matchMedia() call shares one
    // `coarse` flag + listener set, so flipping the pointer notifies the
    // component's live subscription — mirroring a convertible entering tablet
    // mode or DevTools device emulation being toggled after load.
    const installMatchMedia = (initialCoarse: boolean) => {
      const original = window.matchMedia;
      let coarse = initialCoarse;
      const listeners = new Set<() => void>();
      window.matchMedia = vi.fn().mockImplementation((query: string) => ({
        get matches() {
          return query.includes('pointer: coarse') ? coarse : false;
        },
        media: query,
        onchange: null,
        addListener: (cb: () => void) => listeners.add(cb),
        removeListener: (cb: () => void) => listeners.delete(cb),
        addEventListener: (_: string, cb: () => void) => listeners.add(cb),
        removeEventListener: (_: string, cb: () => void) => listeners.delete(cb),
        dispatchEvent: vi.fn(),
      })) as unknown as typeof window.matchMedia;
      return {
        setCoarse(value: boolean) {
          coarse = value;
          listeners.forEach((cb) => cb());
        },
        restore() {
          window.matchMedia = original;
        },
      };
    };

    it('hides "Take Photo" on desktop (fine pointer) so upload is the single action', async () => {
      const mql = installMatchMedia(false);
      try {
        renderWithProviders(
          <AddItemModal
            isOpen
            onClose={mockOnClose}
            collections={[createMockCollection()]}
            onSave={mockOnSave}
          />,
        );

        await screen.findByRole('heading', { name: 'Upload Photo' });

        expect(screen.queryByRole('button', { name: /take photo/i })).not.toBeInTheDocument();
        // The upload action itself stays available (tile + explicit CTA).
        expect(
          screen.getAllByRole('button', { name: 'Upload Photo' }).length,
        ).toBeGreaterThanOrEqual(1);
      } finally {
        mql.restore();
      }
    });

    it('shows "Take Photo" on a touch device (coarse pointer)', async () => {
      const mql = installMatchMedia(true);
      try {
        renderWithProviders(
          <AddItemModal
            isOpen
            onClose={mockOnClose}
            collections={[createMockCollection()]}
            onSave={mockOnSave}
          />,
        );

        await screen.findByRole('heading', { name: 'Upload Photo' });

        expect(screen.getByRole('button', { name: /take photo/i })).toBeInTheDocument();
      } finally {
        mql.restore();
      }
    });

    it('reveals "Take Photo" live when the pointer switches to coarse without a remount', async () => {
      const mql = installMatchMedia(false);
      try {
        renderWithProviders(
          <AddItemModal
            isOpen
            onClose={mockOnClose}
            collections={[createMockCollection()]}
            onSave={mockOnSave}
          />,
        );

        await screen.findByRole('heading', { name: 'Upload Photo' });
        expect(screen.queryByRole('button', { name: /take photo/i })).not.toBeInTheDocument();

        // Same mounted instance — the modal never unmounts in App.tsx — so a
        // stale one-shot probe would keep the button hidden here.
        act(() => mql.setCoarse(true));

        expect(await screen.findByRole('button', { name: /take photo/i })).toBeInTheDocument();
      } finally {
        mql.restore();
      }
    });
  });
});
