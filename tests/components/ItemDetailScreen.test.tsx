import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { LanguageProvider } from '@/i18n';
import { ItemDetailScreen } from '@/components/ItemDetailScreen';
import { mockCollectionWithItems, mockItem } from '../utils/fixtures/collections';

vi.mock('@/services/db', () => ({
  clearEnhancedReference: vi.fn(),
  extractCurioAssetPath: vi.fn(() => null),
  saveAsset: vi.fn(async () => undefined),
  getAsset: vi.fn(async () => null),
  getEnhancedAsset: vi.fn(async () => null),
}));

vi.mock('@/services/geminiService', () => ({
  fetchStoryPrompts: vi.fn().mockResolvedValue({ prompts: [] }),
  refreshAiImageEditEnabled: vi.fn().mockResolvedValue(false),
}));

vi.mock('@/services/analytics', async () => {
  const actual =
    await vi.importActual<typeof import('@/services/analytics')>('@/services/analytics');
  return { ...actual, trackEvent: vi.fn() };
});

// Route the real useTheme through the test-utils mock state.
vi.mock('@/theme', async () => {
  const { createThemeMock } = await import('../utils/test-utils');
  return createThemeMock();
});

function renderItemDetail() {
  const noop = vi.fn();
  const path = `/collection/${mockCollectionWithItems.id}/item/${mockItem.id}`;
  return render(
    <MemoryRouter initialEntries={[path]}>
      <LanguageProvider>
        <Routes>
          <Route
            path="/collection/:id/item/:itemId"
            element={
              <ItemDetailScreen
                collections={[mockCollectionWithItems]}
                isAdmin={false}
                isLoading={false}
                itemSaveStates={{}}
                updateItem={noop}
                deleteItem={vi.fn(() => true)}
                retryItemSave={noop}
                checkStorageQuota={vi.fn(async () => undefined)}
                showStatus={noop}
              />
            }
          />
        </Routes>
      </LanguageProvider>
    </MemoryRouter>,
  );
}

describe('ItemDetailScreen accessibility (CURIO-372)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exposes an accessible name for the story field', () => {
    renderItemDetail();
    expect(screen.getByRole('textbox', { name: 'Story' })).toBeInTheDocument();
  });

  it('exposes each metadata field label as its input accessible name', () => {
    renderItemDetail();
    // Text field → textarea; select field → input. Both should be reachable by
    // their visible caption, not just placeholder text.
    expect(screen.getByRole('textbox', { name: 'Artist' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Condition' })).toBeInTheDocument();
  });

  it('leaves no metadata textbox without an accessible name', () => {
    renderItemDetail();
    for (const box of screen.getAllByRole('textbox')) {
      expect(box).toHaveAccessibleName();
    }
  });
});

// CUR-180: the item-detail Undo/Redo icon buttons (~42px) and the legacy
// story-migration pills (~32px) rendered below the 44px minimum touch target.
// Reserve the same coarse-pointer hit area used by the header toggles so touch
// users get a consistent target without resizing the glyph/label on desktop.
// The default fixture item predates the story feature launch, so the migration
// banner (and its three pills) renders alongside the editable Undo/Redo row.
describe('ItemDetailScreen touch targets (CUR-180)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('gives the Undo and Redo controls a >=44px touch-capable hit area', () => {
    renderItemDetail();

    for (const name of ['Undo', 'Redo']) {
      const button = screen.getByRole('button', { name });
      expect(button.className).toContain('[@media(any-pointer:coarse)]:min-h-[44px]');
      expect(button.className).toContain('[@media(any-pointer:coarse)]:min-w-[44px]');
      expect(button.className).toContain('justify-center');
    }
  });

  it('gives the story-migration pills a >=44px tall touch hit area', () => {
    renderItemDetail();

    for (const name of ['Start fresh', 'Edit current', 'Keep AI text']) {
      const button = screen.getByRole('button', { name });
      expect(button.className).toContain('[@media(any-pointer:coarse)]:min-h-[44px]');
    }
  });
});
