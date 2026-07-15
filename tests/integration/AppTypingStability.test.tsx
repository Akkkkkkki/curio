import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import { AppContent } from '@/App';
import { LanguageProvider } from '@/i18n';
import React from 'react';
import * as db from '@/services/db';
import * as supabaseService from '@/services/supabase';

// CUR-149: CollectionScreen and ItemDetailScreen used to be declared inline
// inside AppContent, so every app-level state change (a keystroke's save
// state, a sync flip, a toast dismissing) remounted the active screen. That
// dropped focus after one character on Item Detail and wiped in-progress
// collection search input. These tests type character-by-character — the
// remount bug is invisible to single-event `fill`-style input.

// Mock services
vi.mock('@/services/db', () => ({
  getLocalCollections: vi.fn(),
  fetchCloudCollections: vi.fn(),
  getPendingAssetUploadSummary: vi.fn(),
  getPendingDeletes: vi.fn(),
  getPendingSyncIds: vi.fn(),
  hasLocalOnlyData: vi.fn(),
  importLocalCollectionsToCloud: vi.fn(),
  mergeCollections: vi.fn((local, cloud) => (cloud.length ? cloud : local)),
  saveCollection: vi.fn(),
  saveAllCollections: vi.fn(),
  saveAsset: vi.fn(),
  clearEnhancedReference: vi.fn(),
  deleteAsset: vi.fn(),
  deleteCloudItem: vi.fn(),
  deleteCollection: vi.fn(),
  requestPersistence: vi.fn(),
  getSeedVersion: vi.fn(),
  setSeedVersion: vi.fn(),
  initDB: vi.fn(),
  setAssetSyncStatusCallback: vi.fn(),
  setSyncStatusCallback: vi.fn(),
  syncPendingChanges: vi.fn(),
  syncPendingAssetUploads: vi.fn(),
  syncPendingDeletes: vi.fn(),
  extractCurioAssetPath: vi.fn(),
  compareTimestamps: vi.fn((a?: string, b?: string) => {
    if (!a && !b) return 0;
    if (!a) return -1;
    if (!b) return 1;
    return new Date(a).getTime() - new Date(b).getTime();
  }),
}));

vi.mock('@/services/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: 'user1' } } } }),
      onAuthStateChange: vi
        .fn()
        .mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        })),
      })),
    })),
  },
  isSupabaseConfigured: vi.fn().mockReturnValue(true),
  signOutUser: vi.fn(),
}));

vi.mock('@/services/geminiService', () => ({
  refreshAiImageEditEnabled: vi.fn().mockResolvedValue(false),
  fetchStoryPrompts: vi.fn().mockResolvedValue({ prompts: [] }),
}));

vi.mock('@vercel/speed-insights/react', () => ({
  SpeedInsights: () => null,
}));

vi.mock('@vercel/analytics/react', () => ({
  Analytics: () => null,
}));

// Mock useTheme hook
vi.mock('@/theme', async () => {
  const React = await import('react');
  const actual = await vi.importActual<typeof import('@/theme')>('@/theme');

  const ThemeContext = React.createContext({
    theme: 'gallery',
    setTheme: () => {},
  });

  const MockThemeProvider = ({
    children,
    initialTheme = 'gallery',
  }: {
    children: React.ReactNode;
    initialTheme?: 'gallery' | 'vault' | 'atelier';
  }) => {
    const [theme, setTheme] = React.useState(initialTheme);
    // @ts-ignore
    return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
  };

  return {
    ...actual,
    useTheme: () => React.useContext(ThemeContext),
    ThemeProvider: MockThemeProvider,
  };
});

describe('Typing stability across app re-renders (CUR-149)', () => {
  const mockCollection = {
    id: 'col1',
    name: 'Test Collection',
    templateId: 'custom',
    icon: '🧪',
    customFields: [{ id: 'origin', label: 'Origin', type: 'text', displayMode: 'primary' }],
    items: [
      {
        id: 'item1',
        collectionId: 'col1',
        title: 'Vintage Violin',
        rating: 5,
        data: {},
        photoUrl: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        notes: 'A keepsake from my grandfather.',
      },
    ],
    isPublic: false,
    updatedAt: new Date().toISOString(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(supabaseService.isSupabaseConfigured).mockReturnValue(true);
    vi.mocked(supabaseService.supabase!.auth.getSession).mockResolvedValue({
      data: { session: { user: { id: 'user1' } } },
    } as never);
    vi.mocked(supabaseService.supabase!.from).mockImplementation(
      () =>
        ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn().mockResolvedValue({ data: null, error: null }),
            })),
          })),
        }) as never,
    );
    vi.mocked(db.getLocalCollections).mockResolvedValue([mockCollection] as never);
    vi.mocked(db.fetchCloudCollections).mockResolvedValue([]);
    vi.mocked(db.getPendingSyncIds).mockResolvedValue([]);
    vi.mocked(db.getPendingDeletes).mockResolvedValue([]);
    vi.mocked(db.hasLocalOnlyData).mockReturnValue(false);
    vi.mocked(db.mergeCollections).mockImplementation((local, cloud) =>
      cloud.length ? cloud : local,
    );
    vi.mocked(db.getPendingAssetUploadSummary).mockResolvedValue({ total: 0, stalled: 0 });
    vi.mocked(db.syncPendingChanges).mockResolvedValue(0);
    vi.mocked(db.syncPendingAssetUploads).mockResolvedValue(0);
    vi.mocked(db.syncPendingDeletes).mockResolvedValue(0);
    vi.mocked(db.requestPersistence).mockResolvedValue(true);
    vi.mocked(db.saveCollection).mockResolvedValue(undefined);
    vi.mocked(db.saveAllCollections).mockResolvedValue(undefined);
    vi.mocked(db.deleteAsset).mockResolvedValue(undefined);
    vi.mocked(db.deleteCloudItem).mockResolvedValue(undefined);
    vi.mocked(db.deleteCollection).mockResolvedValue(undefined);
    vi.mocked(db.initDB).mockResolvedValue({} as never);
  });

  // Sibling inside the router so tests can change the route without
  // unmounting AppContent — mirrors an in-app collection→collection link.
  const NavigateTo = ({ to }: { to: string }) => {
    const navigate = useNavigate();
    return (
      <button type="button" onClick={() => navigate(to)}>
        test-navigate
      </button>
    );
  };

  const renderApp = async (initialEntry: string, navigateTarget?: string) => {
    const { ThemeProvider } = await import('@/theme');
    render(
      <MemoryRouter initialEntries={[initialEntry]}>
        <ThemeProvider>
          <LanguageProvider>
            <AppContent />
          </LanguageProvider>
        </ThemeProvider>
        {navigateTarget ? <NavigateTo to={navigateTarget} /> : null}
      </MemoryRouter>,
    );
  };

  it('commits continuous typing into the Item Detail title without losing focus', async () => {
    const user = userEvent.setup();
    await renderApp('/collection/col1/item/item1');

    const titleField = await screen.findByRole('textbox', { name: 'Title' });
    await user.click(titleField);
    // Each keystroke updates app-level state (save status, collections), so
    // per-character typing is what exposes a screen remount.
    await user.keyboard(' Deluxe');

    const titleAfter = screen.getByRole('textbox', { name: 'Title' });
    expect(titleAfter).toHaveValue('Vintage Violin Deluxe');
    expect(document.activeElement).toBe(titleAfter);
  });

  it('commits continuous typing into a Technical Spec field without losing focus', async () => {
    const user = userEvent.setup();
    await renderApp('/collection/col1/item/item1');

    // Spec inputs carry no aria-label (the visible <dt> labels them), so the
    // em-dash placeholder is the stable handle for the single custom field.
    const originField = await screen.findByPlaceholderText('—');
    await user.click(originField);
    await user.keyboard('Italy');

    const originAfter = screen.getByPlaceholderText('—');
    expect(originAfter).toHaveValue('Italy');
    expect(document.activeElement).toBe(originAfter);
  });

  it('keeps in-progress collection search text and focus when a background sync completes', async () => {
    const user = userEvent.setup();
    await renderApp('/collection/col1');

    const searchInput = await screen.findByRole('textbox', {
      name: /search this collection/i,
    });
    await user.click(searchInput);
    await user.keyboard('violin');

    // Simulate the background sync finishing mid-typing session — exactly
    // what wiped the search box when the screen was declared inline.
    const syncCallback = vi.mocked(db.setSyncStatusCallback).mock.calls.at(-1)?.[0];
    expect(syncCallback).toBeTruthy();
    act(() => {
      syncCallback?.('syncing');
      syncCallback?.('synced');
    });

    const searchAfter = screen.getByRole('textbox', { name: /search this collection/i });
    expect(searchAfter).toHaveValue('violin');
    expect(document.activeElement).toBe(searchAfter);
  });

  it('clears search and field filters when navigating to a different collection', async () => {
    const secondCollection = {
      ...mockCollection,
      id: 'col2',
      name: 'Second Collection',
      customFields: [],
      items: [
        {
          ...mockCollection.items[0],
          id: 'item2',
          collectionId: 'col2',
          title: 'Moon Bowl',
          notes: '',
        },
      ],
    };
    vi.mocked(db.getLocalCollections).mockResolvedValue([
      mockCollection,
      secondCollection,
    ] as never);

    const user = userEvent.setup();
    await renderApp('/collection/col1', '/collection/col2');

    const searchInput = await screen.findByRole('textbox', {
      name: /search this collection/i,
    });
    await user.click(searchInput);
    await user.keyboard('violin');

    // The screen stays mounted across /collection/:id param changes, so the
    // collection-specific query must be reset explicitly on arrival.
    await user.click(screen.getByRole('button', { name: 'test-navigate' }));

    expect(await screen.findByText('Second Collection')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /search this collection/i })).toHaveValue('');
    expect(screen.getAllByText('Moon Bowl')[0]).toBeInTheDocument();
  });

  it('preserves screen-local view mode when a background sync completes', async () => {
    const user = userEvent.setup();
    await renderApp('/collection/col1');

    const gridToggle = await screen.findByRole('button', { name: 'Grid view' });
    await user.click(gridToggle);
    expect(screen.getByTestId('items-grid').className).toContain('grid-cols-2');

    const syncCallback = vi.mocked(db.setSyncStatusCallback).mock.calls.at(-1)?.[0];
    act(() => {
      syncCallback?.('synced');
    });

    expect(screen.getByTestId('items-grid').className).toContain('grid-cols-2');
  });
});
