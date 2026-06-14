import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../utils/test-utils';
import { ExportModal } from '@/components/ExportModal';
import type { CollectionItem, FieldDefinition } from '@/types';
import { toBlob } from 'html-to-image';
import { getAsset, getEnhancedAsset } from '@/services/db';

vi.mock('@/services/db', () => ({
  extractCurioAssetPath: vi.fn().mockReturnValue(null),
  getAsset: vi.fn().mockResolvedValue(null),
  getEnhancedAsset: vi.fn().mockResolvedValue(null),
}));

vi.mock('html-to-image', () => ({
  toBlob: vi.fn().mockResolvedValue(new Blob(['fake'], { type: 'image/png' })),
}));

vi.mock('@/theme', async () => {
  const actual = await vi.importActual('@/theme');
  return {
    ...actual,
    useTheme: () => ({ theme: 'gallery', setTheme: vi.fn() }),
  };
});

const LONG_TITLE = 'Karuna Pipa Barrel Aged Dark Chocolate 75%';

const makeItem = (overrides: Partial<CollectionItem> = {}): CollectionItem => ({
  id: 'item-1',
  collectionId: 'col-1',
  photoUrl: 'asset',
  title: LONG_TITLE,
  rating: 4,
  data: {},
  createdAt: new Date().toISOString(),
  notes: '',
  ...overrides,
});

const FIELDS: FieldDefinition[] = [];

const findTitleHeading = () => {
  const headings = screen.getAllByRole('heading', { level: 3, name: LONG_TITLE });
  // The card preview renders exactly one <h3> for the active template.
  expect(headings).toHaveLength(1);
  return headings[0];
};

describe('ExportModal — CUR-74 long title rendering', () => {
  const baseProps = {
    isOpen: true,
    onClose: vi.fn(),
    item: makeItem(),
    fields: FIELDS,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the full title without line-clamp on the Minimal template', () => {
    renderWithProviders(<ExportModal {...baseProps} />);
    // Minimal is the default template.
    const heading = findTitleHeading();
    expect(heading).toHaveTextContent(LONG_TITLE);
    expect(heading.className).not.toMatch(/line-clamp-/);
  });

  it('renders the full title without line-clamp on the Retro template', async () => {
    const userEvent = (await import('@testing-library/user-event')).default;
    const user = userEvent.setup();
    renderWithProviders(<ExportModal {...baseProps} />);

    await user.click(screen.getByRole('button', { name: /retro/i }));

    const heading = findTitleHeading();
    expect(heading).toHaveTextContent(LONG_TITLE);
    expect(heading.className).not.toMatch(/line-clamp-/);
  });
});

describe('ExportModal — CUR-83 footer CTA hierarchy', () => {
  const baseProps = {
    isOpen: true,
    onClose: vi.fn(),
    item: makeItem(),
    fields: FIELDS,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('demotes Print below Save image and Share so it stops competing on mobile', () => {
    renderWithProviders(<ExportModal {...baseProps} />);

    const save = screen.getByRole('button', { name: /save image/i });
    const share = screen.getByRole('button', { name: /^share$/i });
    const print = screen.getByRole('button', { name: /^print$/i });

    // Visual hierarchy: Save (lg primary) > Share (md outline) > Print (sm ghost).
    // Save keeps the dominant stone-800 surface, Share keeps an outline border,
    // and Print drops the outline border + shrinks so it reads as a quiet
    // tertiary action.
    expect(save.className).toMatch(/bg-stone-800/);
    expect(save.className).toMatch(/text-base/);

    expect(share.className).toMatch(/border-stone-300/);
    expect(share.className).toMatch(/text-sm/);

    expect(print.className).not.toMatch(/border-stone-300/);
    expect(print.className).toMatch(/text-xs/);
  });

  it('Print still triggers window.print()', async () => {
    const userEvent = (await import('@testing-library/user-event')).default;
    const user = userEvent.setup();
    const printSpy = vi.fn();
    const originalPrint = window.print;
    window.print = printSpy;
    try {
      renderWithProviders(<ExportModal {...baseProps} />);
      await user.click(screen.getByRole('button', { name: /^print$/i }));
      expect(printSpy).toHaveBeenCalledTimes(1);
    } finally {
      window.print = originalPrint;
    }
  });
});

describe('ExportModal — CUR-100 Print disabled while photo loading', () => {
  const baseProps = {
    isOpen: true,
    onClose: vi.fn(),
    item: makeItem(),
    fields: FIELDS,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('disables Print, Save, and Share until the card photo finishes loading', async () => {
    let resolveAsset: (value: Blob | null) => void = () => {};
    const loadingPromise = new Promise<Blob | null>((resolve) => {
      resolveAsset = resolve;
    });
    vi.mocked(getEnhancedAsset).mockReturnValueOnce(loadingPromise);
    vi.mocked(getAsset).mockResolvedValue(null);

    renderWithProviders(<ExportModal {...baseProps} />);

    // While the photo fetch is in flight, Print must be disabled so it cannot
    // snapshot the loading spinner / empty placeholder.
    expect(screen.getByRole('button', { name: /^print$/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /save image/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /^share$/i })).toBeDisabled();

    await act(async () => {
      resolveAsset(null);
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^print$/i })).not.toBeDisabled();
    });
  });
});

describe('ExportModal — CUR-99 fixed export resolution', () => {
  const baseProps = {
    isOpen: true,
    onClose: vi.fn(),
    item: makeItem(),
    fields: FIELDS,
  };

  const stubOffsetWidth = (width: number) => {
    const card = document.getElementById('card-preview') as HTMLElement | null;
    expect(card).not.toBeNull();
    Object.defineProperty(card!, 'offsetWidth', { configurable: true, value: width });
    return card!;
  };

  const triggerSave = async () => {
    const userEvent = (await import('@testing-library/user-event')).default;
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /save image/i }));
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('bumps pixelRatio so a narrow phone preview still rasterises at ≥1080px short edge', async () => {
    renderWithProviders(<ExportModal {...baseProps} />);
    stubOffsetWidth(331); // 390px viewport × 85vw ≈ 331px

    await triggerSave();

    expect(toBlob).toHaveBeenCalledTimes(1);
    const [, options] = (toBlob as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(options.pixelRatio).toBeGreaterThanOrEqual(1080 / 331);
    expect(331 * options.pixelRatio).toBeGreaterThanOrEqual(1080);
  });

  it('keeps pixelRatio at 2 on desktop where the preview is already wide enough', async () => {
    renderWithProviders(<ExportModal {...baseProps} />);
    stubOffsetWidth(560); // desktop cap from min(85vw, 560px)

    await triggerSave();

    const [, options] = (toBlob as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(options.pixelRatio).toBe(2);
  });

  it('falls back to pixelRatio 2 if the preview width is unmeasurable', async () => {
    renderWithProviders(<ExportModal {...baseProps} />);
    stubOffsetWidth(0);

    await triggerSave();

    const [, options] = (toBlob as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(options.pixelRatio).toBe(2);
  });
});
