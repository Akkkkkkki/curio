import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../utils/test-utils';
import { ExportModal } from '@/components/ExportModal';
import type { CollectionItem, FieldDefinition } from '@/types';

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
