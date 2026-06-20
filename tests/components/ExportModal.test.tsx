import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../utils/test-utils';
import { ExportModal } from '@/components/ExportModal';
import { trackEvent } from '@/services/analytics';

vi.mock('@/theme', async () => {
  const { createThemeMock } = await import('../utils/test-utils');
  return createThemeMock();
});

vi.mock('html-to-image', () => ({
  toBlob: vi.fn().mockResolvedValue(new Blob(['card'], { type: 'image/png' })),
}));

vi.mock('@/services/db', () => ({
  extractCurioAssetPath: vi.fn().mockReturnValue(null),
  getAsset: vi.fn().mockResolvedValue(null),
  getEnhancedAsset: vi.fn().mockResolvedValue(null),
}));

vi.mock('@/services/analytics', () => ({
  trackEvent: vi.fn(),
}));

describe('ExportModal analytics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(HTMLImageElement.prototype, 'complete', {
      configurable: true,
      get: () => true,
    });
    Object.defineProperty(navigator, 'canShare', {
      configurable: true,
      value: vi.fn().mockReturnValue(true),
    });
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: vi.fn().mockResolvedValue(undefined),
    });
  });

  it('tracks item-card share attempts and successful native shares', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <ExportModal
        isOpen
        onClose={vi.fn()}
        fields={[]}
        item={{
          id: 'item-1',
          collectionId: 'collection-1',
          title: 'A favorite object',
          rating: 5,
          notes: 'A story',
          data: {},
          photoUrl: 'data:image/png;base64,ZmFrZQ==',
          createdAt: '2026-06-20T00:00:00.000Z',
          updatedAt: '2026-06-20T00:00:00.000Z',
        }}
      />,
    );

    await user.click(await screen.findByRole('button', { name: 'Share' }));

    await waitFor(() => {
      expect(trackEvent).toHaveBeenCalledWith('share_initiated', {
        surface: 'item_card',
      });
      expect(trackEvent).toHaveBeenCalledWith('share_completed', {
        method: 'native',
        surface: 'item_card',
      });
    });
  });
});
