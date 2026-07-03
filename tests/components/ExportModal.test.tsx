import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../utils/test-utils';
import { ExportModal } from '@/components/ExportModal';
import type { CollectionItem, FieldDefinition } from '@/types';
import { toBlob } from 'html-to-image';
import { getAsset, getEnhancedAsset } from '@/services/db';
import { trackEvent } from '@/services/analytics';

vi.mock('@/services/db', () => ({
  extractCurioAssetPath: vi.fn().mockReturnValue(null),
  getAsset: vi.fn().mockResolvedValue(null),
  getEnhancedAsset: vi.fn().mockResolvedValue(null),
}));

vi.mock('html-to-image', () => ({
  toBlob: vi.fn().mockResolvedValue(new Blob(['fake'], { type: 'image/png' })),
}));

vi.mock('@/services/analytics', () => ({
  trackEvent: vi.fn(),
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

describe('ExportModal — CUR-105 mobile sheet opens expanded', () => {
  const baseProps = {
    isOpen: true,
    onClose: vi.fn(),
    item: makeItem(),
    fields: FIELDS,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the mobile bottom sheet expanded on mount so Save / Share / Print are not hidden behind the drag handle', () => {
    renderWithProviders(<ExportModal {...baseProps} />);

    // The tap-to-collapse overlay only renders when the sheet is expanded.
    // Its presence on mount confirms the sheet opened expanded.
    expect(screen.getByTestId('export-sheet-tap-to-collapse')).toBeInTheDocument();
  });

  it('keeps the tap-to-collapse overlay out of the accessibility tree so AT users see exactly one Close action', () => {
    renderWithProviders(<ExportModal {...baseProps} />);

    // The overlay's onClick only collapses the sheet — it does not close the
    // modal — so it must not present itself as a second "Close" button (which
    // would strand keyboard / SR users behind the peek height on activation).
    expect(screen.getAllByRole('button', { name: /close/i })).toHaveLength(1);

    const overlay = screen.getByTestId('export-sheet-tap-to-collapse');
    expect(overlay).toHaveAttribute('aria-hidden', 'true');
    expect(overlay).toHaveAttribute('tabindex', '-1');
  });
});

describe('ExportModal — CUR-136 card preview clears the expanded mobile sheet', () => {
  const baseProps = {
    isOpen: true,
    onClose: vi.fn(),
    item: makeItem(),
    fields: FIELDS,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shrinks the preview container to match the sheet during an upward drag, instead of stranding it at the peek strip', async () => {
    renderWithProviders(<ExportModal {...baseProps} />);

    // The preview container is the closest absolutely-positioned ancestor of
    // the card; it reserves the space above the sheet. Anchoring its bottom
    // to the sheet height is what guarantees the card stays fully visible.
    const card = document.getElementById('card-preview');
    expect(card).not.toBeNull();
    const previewContainer = card!.parentElement!.parentElement as HTMLElement;
    expect(previewContainer.className).toMatch(/absolute/);

    // Drive a drag that forces `mobileSheetHeight` into a concrete pixel value
    // — JSDOM happily stores `${px}px` on inline styles (but normalises `dvh`-
    // based `clamp()` values away), so this is what lets us read the contract.
    const handle = document.querySelector<HTMLElement>('[class*="cursor-grab"]');
    expect(handle).not.toBeNull();
    Object.defineProperty(handle!, 'offsetHeight', {
      configurable: true,
      value: 320,
    });
    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: 844,
    });

    const fire = (type: string, clientY: number) => {
      const event = new PointerEvent(type, {
        bubbles: true,
        clientY,
        pointerId: 1,
        pointerType: 'touch',
      });
      handle!.dispatchEvent(event);
    };

    // Touch the handle and drag upward 200px → sheet grows to ~520px.
    await act(async () => {
      fire('pointerdown', 400);
      fire('pointermove', 200);
    });

    // While dragging, both the preview's bottom AND the sheet's height should
    // resolve to the same pixel value. Before the fix, the preview was pinned
    // to `var(--peek-height, 0px)` and ignored the drag entirely.
    const sheet = previewContainer.parentElement!.querySelector<HTMLElement>(
      '[class*="rounded-t-3xl"][class*="shadow-2xl"]',
    );
    expect(sheet).not.toBeNull();

    expect(previewContainer.style.bottom).toMatch(/^\d+(\.\d+)?px$/);
    expect(previewContainer.style.bottom).toBe(sheet!.style.height);
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

describe('ExportModal — export resilience when font embedding fails', () => {
  const baseProps = {
    isOpen: true,
    onClose: vi.fn(),
    item: makeItem(),
    fields: FIELDS,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('retries the render with skipFonts when the first toBlob attempt rejects', async () => {
    const mockedToBlob = toBlob as unknown as ReturnType<typeof vi.fn>;
    mockedToBlob
      .mockRejectedValueOnce(new Error('font fetch blocked by CSP'))
      .mockResolvedValueOnce(new Blob(['fake'], { type: 'image/png' }));

    const userEvent = (await import('@testing-library/user-event')).default;
    const user = userEvent.setup();
    renderWithProviders(<ExportModal {...baseProps} />);

    await user.click(screen.getByRole('button', { name: /save image/i }));

    await waitFor(() => {
      expect(mockedToBlob).toHaveBeenCalledTimes(2);
    });
    // First attempt embeds fonts; the retry skips them so the user still gets an image.
    expect(mockedToBlob.mock.calls[0][1]).not.toHaveProperty('skipFonts', true);
    expect(mockedToBlob.mock.calls[1][1]).toHaveProperty('skipFonts', true);

    // No error surfaced to the user because the retry succeeded.
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('ExportModal — CUR-106 export feedback tone', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(HTMLImageElement.prototype, 'complete', {
      configurable: true,
      get: () => true,
    });
  });

  it('reports successful Save image through the shared toast pattern and shows no inline alert', async () => {
    const userEvent = (await import('@testing-library/user-event')).default;
    const user = userEvent.setup();
    const onStatus = vi.fn();
    renderWithProviders(
      <ExportModal
        isOpen
        onClose={vi.fn()}
        fields={[]}
        item={makeItem({ photoUrl: 'data:image/png;base64,ZmFrZQ==', title: 'A treasured object' })}
        onStatus={onStatus}
      />,
    );

    await user.click(await screen.findByRole('button', { name: /save image/i }));

    await waitFor(() => {
      // Success surfaces as a positive trust toast ("Image saved"), not silent.
      expect(onStatus).toHaveBeenCalledWith(expect.stringMatching(/saved/i), 'success');
    });
    // The footer alert slot is reserved for real failures only.
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('treats the share download fallback as neutral info, not a red error', async () => {
    // Force the no-native-share path: navigator.share absent.
    const previousShare = Object.getOwnPropertyDescriptor(navigator, 'share');
    Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
    try {
      const userEvent = (await import('@testing-library/user-event')).default;
      const user = userEvent.setup();
      const onStatus = vi.fn();
      renderWithProviders(
        <ExportModal
          isOpen
          onClose={vi.fn()}
          fields={[]}
          item={makeItem({
            photoUrl: 'data:image/png;base64,ZmFrZQ==',
            title: 'Desktop fallback case',
          })}
          onStatus={onStatus}
        />,
      );

      await user.click(await screen.findByRole('button', { name: /^share$/i }));

      await waitFor(() => {
        // "Sharing isn't available — image saved instead" surfaces as info,
        // never as an error. Desktop users hit this path every time.
        expect(onStatus).toHaveBeenCalledWith(expect.stringMatching(/saved/i), 'info');
      });
      // No red role="alert" in the footer for what is really a successful save.
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    } finally {
      if (previousShare) Object.defineProperty(navigator, 'share', previousShare);
    }
  });

  it('still surfaces real save failures inline as an alert', async () => {
    const mockedToBlob = toBlob as unknown as ReturnType<typeof vi.fn>;
    mockedToBlob
      .mockRejectedValueOnce(new Error('font fetch blocked by CSP'))
      .mockRejectedValueOnce(new Error('still broken without fonts'));

    const userEvent = (await import('@testing-library/user-event')).default;
    const user = userEvent.setup();
    const onStatus = vi.fn();
    renderWithProviders(
      <ExportModal
        isOpen
        onClose={vi.fn()}
        fields={[]}
        item={makeItem({ photoUrl: 'data:image/png;base64,ZmFrZQ==' })}
        onStatus={onStatus}
      />,
    );

    await user.click(screen.getByRole('button', { name: /save image/i }));

    // Real failures keep the louder inline alert — this is the path the user
    // can act on (retry), distinct from informational toasts that auto-dismiss.
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toMatch(/could not save image/i);
    // Failure must not also masquerade as a positive trust signal.
    expect(onStatus).not.toHaveBeenCalledWith(expect.anything(), 'success');
  });
});

describe('ExportModal — CUR-137 broken-photo fallback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('falls back to the "No photo" placeholder when the card image fails to load instead of showing a broken-image glyph', async () => {
    renderWithProviders(
      <ExportModal
        isOpen
        onClose={vi.fn()}
        fields={[]}
        item={makeItem({
          photoUrl: 'https://example.invalid/missing.jpg',
          title: 'Broken photo case',
        })}
      />,
    );

    // The minimal template is default and is the path the user hits from the
    // mobile Save Image / Share flow. The card preview should render the photo
    // slot until the load actually fails.
    const card = document.getElementById('card-preview');
    expect(card).not.toBeNull();
    const img = card!.querySelector('img');
    expect(img).not.toBeNull();
    expect(img!.getAttribute('crossorigin')).toBe('anonymous');

    // Simulate the network / 404 / CORS failure that produced the broken-image
    // glyph in the bug report.
    await act(async () => {
      fireEvent.error(img!);
    });

    // The image is replaced by the explicit "No photo" placeholder. This is the
    // user-visible contract: no broken-image glyph ever survives to the card.
    expect(card!.querySelector('img')).toBeNull();
    expect(screen.getByText(/no photo/i)).toBeInTheDocument();
  });

  it('marks the photo slot empty when the IndexedDB asset waterfall returns nothing, so the card never relies on a broken <img>', async () => {
    // Default mocks already return null for both getEnhancedAsset and getAsset,
    // simulating an item whose photo blob is missing from local + cloud.
    renderWithProviders(
      <ExportModal
        isOpen
        onClose={vi.fn()}
        fields={[]}
        item={makeItem({ photoUrl: 'asset', title: 'Asset-keyword case' })}
      />,
    );

    // Wait for the loading spinner to clear (waterfall resolves).
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /save image/i })).not.toBeDisabled();
    });

    const card = document.getElementById('card-preview')!;
    expect(card.querySelector('img')).toBeNull();
    expect(screen.getByText(/no photo/i)).toBeInTheDocument();
  });
});

describe('ExportModal — product analytics', () => {
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
    const userEvent = (await import('@testing-library/user-event')).default;
    const user = userEvent.setup();
    renderWithProviders(
      <ExportModal
        isOpen
        onClose={vi.fn()}
        fields={[]}
        item={makeItem({
          photoUrl: 'data:image/png;base64,ZmFrZQ==',
          title: 'A favorite object',
        })}
      />,
    );

    await user.click(await screen.findByRole('button', { name: /^share$/i }));

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

describe('ExportModal — CUR-104 retro rating badge', () => {
  const baseProps = {
    isOpen: true,
    onClose: vi.fn(),
    fields: FIELDS,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const openRetro = async () => {
    const userEvent = (await import('@testing-library/user-event')).default;
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /retro/i }));
  };

  it('never labels the rating as a catalog "NO." number, and renders it as stars a viewer will read as a rating', async () => {
    renderWithProviders(<ExportModal {...baseProps} item={makeItem({ rating: 4 })} />);
    await openRetro();

    const card = document.getElementById('card-preview')!;
    // The badge previously read "NO. 4", which viewers mistake for a catalog
    // number rather than the user's own rating.
    expect(card.textContent).not.toMatch(/NO\.\s*\d/);

    // The badge renders the rating as filled stars — one glyph per star —
    // so it reads as a rating without a misleading text prefix.
    const badge = screen.getByLabelText(/rated 4 out of 5/i);
    expect(badge.textContent).toBe('★★★★');
  });

  it('hides the retro rating badge for unrated items so cards never show "NO. 0"', async () => {
    renderWithProviders(<ExportModal {...baseProps} item={makeItem({ rating: 0 })} />);
    await openRetro();

    // Neither the misleading legacy label nor an empty rating chip should
    // survive to the exported card.
    const card = document.getElementById('card-preview')!;
    expect(card.textContent).not.toMatch(/NO\.\s*0/);
    expect(screen.queryByLabelText(/rated .* out of 5/i)).not.toBeInTheDocument();
  });
});
