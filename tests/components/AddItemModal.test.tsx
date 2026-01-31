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
}));

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

  it('processes a batch upload and renders the analyzed item', async () => {
    const user = userEvent.setup();
    mockRefreshAiEnabled.mockResolvedValue(true);
    mockAnalyzeImage.mockResolvedValue({
      title: 'Mock Artifact',
      notes: 'Some notes',
      data: {},
    });

    const collection = createMockCollection({
      name: 'Artifacts',
      customFields: [],
    });

    renderWithProviders(
      <AddItemModal
        isOpen
        onClose={mockOnClose}
        collections={[collection]}
        onSave={mockOnSave}
      />,
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
