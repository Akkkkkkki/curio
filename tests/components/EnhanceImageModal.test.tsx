import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders, setMockTheme } from '../utils/test-utils';
import { EnhanceImageModal } from '@/components/EnhanceImageModal';
import { refreshAiImageEditEnabled } from '@/services/geminiService';
import { getAsset } from '@/services/db';

vi.mock('@/theme', async () => {
  const { createThemeMock } = await import('../utils/test-utils');
  return createThemeMock();
});

vi.mock('@/services/geminiService', () => ({
  enhanceImage: vi.fn(),
  isAiImageEditEnabled: vi.fn(() => false),
  refreshAiImageEditEnabled: vi.fn(),
}));

vi.mock('@/services/db', () => ({
  getAsset: vi.fn(),
  saveEnhancedAsset: vi.fn(),
}));

const defaultProps = {
  isOpen: true,
  onClose: vi.fn(),
  itemId: 'item-1',
  photoUrl: 'asset',
  collectionId: 'collection-1',
  onEnhancementComplete: vi.fn(),
};

describe('EnhanceImageModal AI image-edit gate (CUR-183)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setMockTheme('gallery');
    vi.mocked(getAsset).mockResolvedValue(new Blob(['original image'], { type: 'image/jpeg' }));
    vi.mocked(refreshAiImageEditEnabled).mockResolvedValue(false);
  });

  it('surfaces the unavailable state and disables enhancement when image editing is off', async () => {
    renderWithProviders(<EnhanceImageModal {...defaultProps} />);

    expect(await screen.findByText(/AI image enhancement is not available/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Enhance Image' })).toBeDisabled();
    });
  });

  it('enables the enhancement action when image editing is available and the original loads', async () => {
    vi.mocked(refreshAiImageEditEnabled).mockResolvedValueOnce(true);

    renderWithProviders(<EnhanceImageModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Enhance Image' })).toBeEnabled();
    });
    expect(screen.queryByText(/AI image enhancement is not available/i)).not.toBeInTheDocument();
  });
});
