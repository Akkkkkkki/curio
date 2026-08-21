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
