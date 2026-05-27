import { describe, it, expect, vi, beforeAll } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../utils/test-utils';
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

const mockAnalyzeImage = analyzeImage as ReturnType<typeof vi.fn>;
const mockRefreshAiEnabled = refreshAiEnabled as ReturnType<typeof vi.fn>;

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
  });
});
