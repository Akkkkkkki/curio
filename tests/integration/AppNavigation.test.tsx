import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppContent } from '@/App';
import { LanguageProvider } from '@/i18n';
import React from 'react';
import * as db from '@/services/db';
import * as supabaseService from '@/services/supabase';

// Mock services
vi.mock('@/services/db', () => ({
  getLocalCollections: vi.fn(),
  fetchCloudCollections: vi.fn(),
  getPendingAssetUploadCount: vi.fn(),
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

describe('App Integration Tests', () => {
  const mockCollection = {
    id: 'col1',
    name: 'Test Collection',
    templateId: 'custom',
    icon: '🧪',
    customFields: [],
    items: [
      {
        id: 'item1',
        collectionId: 'col1',
        title: 'Test Item',
        rating: 5,
        data: {},
        photoUrl: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        notes: 'Test notes',
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
    vi.mocked(db.getLocalCollections).mockResolvedValue([mockCollection]);
    vi.mocked(db.fetchCloudCollections).mockResolvedValue([]);
    vi.mocked(db.getPendingSyncIds).mockResolvedValue([]);
    vi.mocked(db.getPendingDeletes).mockResolvedValue([]);
    vi.mocked(db.hasLocalOnlyData).mockReturnValue(false);
    vi.mocked(db.mergeCollections).mockImplementation((local, cloud) =>
      cloud.length ? cloud : local,
    );
    vi.mocked(db.getPendingAssetUploadCount).mockResolvedValue(0);
    vi.mocked(db.syncPendingChanges).mockResolvedValue(0);
    vi.mocked(db.syncPendingAssetUploads).mockResolvedValue(0);
    vi.mocked(db.syncPendingDeletes).mockResolvedValue(0);
    vi.mocked(db.requestPersistence).mockResolvedValue(true);
    vi.mocked(db.saveAllCollections).mockResolvedValue(undefined);
    vi.mocked(db.initDB).mockResolvedValue({} as never);
  });

  it('renders CollectionScreen without crashing', async () => {
    const { ThemeProvider } = await import('@/theme');

    render(
      <MemoryRouter initialEntries={['/collection/col1']}>
        <ThemeProvider>
          <LanguageProvider>
            <AppContent />
          </LanguageProvider>
        </ThemeProvider>
      </MemoryRouter>,
    );

    await waitFor(
      () => {
        expect(screen.getByText('Test Collection')).toBeInTheDocument();
      },
      { timeout: 3000 },
    );

    // Items are lazy-loaded and may render on a later tick.
    await waitFor(
      () => {
        expect(screen.getAllByText('Test Item')[0]).toBeInTheDocument();
      },
      { timeout: 5000 },
    );
  });

  it('keeps pending deletes in the production merge and retry path', async () => {
    const { ThemeProvider } = await import('@/theme');
    const pendingDeletes = [
      {
        type: 'item' as const,
        collectionId: 'col1',
        itemId: 'item1',
        createdAt: '2026-06-01T00:00:00.000Z',
      },
    ];
    vi.mocked(db.fetchCloudCollections).mockResolvedValue([mockCollection]);
    vi.mocked(db.getPendingDeletes).mockResolvedValue(pendingDeletes);
    vi.mocked(db.mergeCollections).mockReturnValue([{ ...mockCollection, items: [] }]);

    render(
      <MemoryRouter initialEntries={['/collection/col1']}>
        <ThemeProvider>
          <LanguageProvider>
            <AppContent />
          </LanguageProvider>
        </ThemeProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(db.mergeCollections).toHaveBeenCalledWith(
        [mockCollection],
        [mockCollection],
        expect.objectContaining({ pendingDeletes }),
      );
    });

    await waitFor(() => {
      expect(db.syncPendingDeletes).toHaveBeenCalled();
    });
  });

  it('shows the public sample gallery instead of a dead-end gate when cloud is not configured', async () => {
    const { ThemeProvider } = await import('@/theme');
    vi.mocked(supabaseService.isSupabaseConfigured).mockReturnValue(false);

    render(
      <MemoryRouter initialEntries={['/']}>
        <ThemeProvider>
          <LanguageProvider>
            <AppContent />
          </LanguageProvider>
        </ThemeProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('collections-grid')).toBeInTheDocument();
    });

    expect(screen.getAllByText('The Vinyl Vault')[0]).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.queryByTestId('access-gate')).not.toBeInTheDocument();
  });

  it('greets signed-out visitors with a product-explaining welcome gate', async () => {
    const { ThemeProvider } = await import('@/theme');
    vi.mocked(supabaseService.isSupabaseConfigured).mockReturnValue(true);
    vi.mocked(supabaseService.supabase!.auth.getSession).mockResolvedValue({
      data: { session: null },
    } as never);

    render(
      <MemoryRouter initialEntries={['/']}>
        <ThemeProvider>
          <LanguageProvider>
            <AppContent />
          </LanguageProvider>
        </ThemeProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('access-gate')).toBeInTheDocument();
    });

    // Gate explains what Curio is before asking for sign-in (CUR-63).
    // findByText (not getByText) so we wait through the brief
    // authReady=false → true transition where the gate first renders
    // the "Authenticating…" loading copy.
    expect(await screen.findByText('Welcome to Curio')).toBeInTheDocument();
    expect(await screen.findByText(/personal museum/i)).toBeInTheDocument();

    // Both first-run CTAs remain available
    expect(screen.getByTestId('cta-primary-add-first')).toBeInTheDocument();
    expect(screen.getByTestId('cta-secondary-explore-sample')).toBeInTheDocument();
  });

  it('hides the bottom-nav Explore tab when no sample collection is loaded (no dead link)', async () => {
    const { ThemeProvider } = await import('@/theme');
    // Authenticated user whose only collection is private and cloud returns no
    // public collection: the fallback sample id is not present in `collections`,
    // so the Explore tab must hide rather than link to a collection that
    // CollectionScreen cannot find (which would bounce back to Home).
    vi.mocked(supabaseService.isSupabaseConfigured).mockReturnValue(true);
    vi.mocked(db.getLocalCollections).mockResolvedValue([mockCollection]);
    vi.mocked(db.fetchCloudCollections).mockResolvedValue([]);

    render(
      <MemoryRouter initialEntries={['/']}>
        <ThemeProvider>
          <LanguageProvider>
            <AppContent />
          </LanguageProvider>
        </ThemeProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getAllByText('Test Collection')[0]).toBeInTheDocument();
    });

    expect(screen.queryByRole('link', { name: /explore/i })).not.toBeInTheDocument();
  });

  it('does not refetch cloud collections when following the bottom-nav Explore link', async () => {
    const { ThemeProvider } = await import('@/theme');
    // Signed-out visitor, Supabase configured, with a public sample collection
    // already loaded. The bottom-nav Explore tap must clear the access gate and
    // navigate to the loaded target WITHOUT a click-time cloud refetch — a
    // transient failure in that refetch would drop the loaded collection and
    // turn the one-tap link back into a dead link (Codex review on #241).
    const publicSample = {
      id: 'sample-vinyl',
      name: 'The Vinyl Vault',
      templateId: 'vinyl',
      icon: '🎵',
      customFields: [],
      items: [],
      isPublic: true,
      updatedAt: new Date().toISOString(),
    };
    vi.mocked(supabaseService.isSupabaseConfigured).mockReturnValue(true);
    vi.mocked(supabaseService.supabase!.auth.getSession).mockResolvedValue({
      data: { session: null },
    } as never);
    vi.mocked(db.getLocalCollections).mockResolvedValue([]);
    vi.mocked(db.fetchCloudCollections).mockResolvedValue([publicSample]);
    vi.mocked(db.mergeCollections).mockImplementation((local, cloud) =>
      cloud.length ? cloud : local,
    );

    render(
      <MemoryRouter initialEntries={['/']}>
        <ThemeProvider>
          <LanguageProvider>
            <AppContent />
          </LanguageProvider>
        </ThemeProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('access-gate')).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(vi.mocked(db.fetchCloudCollections)).toHaveBeenCalled();
    });
    const fetchCallsAfterLoad = vi.mocked(db.fetchCloudCollections).mock.calls.length;

    const bottomNav = screen.getByRole('navigation', { name: 'Primary' });
    fireEvent.click(within(bottomNav).getByRole('link', { name: /explore/i }));

    // Gate clears (public browsing enabled) and no extra cloud fetch fires.
    await waitFor(() => {
      expect(screen.queryByTestId('access-gate')).not.toBeInTheDocument();
    });
    expect(vi.mocked(db.fetchCloudCollections).mock.calls.length).toBe(fetchCallsAfterLoad);
  });

  it('shows cached collections instead of a blocking error when the cloud fetch fails (signed in)', async () => {
    const { ThemeProvider } = await import('@/theme');
    // Signed-in user with a cached collection. A transient cloud-fetch failure
    // must not strand the user on the "Sync paused" screen — the cached
    // collection should still render (regression guard for the launch-stuck fix).
    vi.mocked(supabaseService.supabase!.auth.getSession).mockResolvedValue({
      data: { session: { user: { id: 'user1' } } },
    } as never);
    vi.mocked(db.getLocalCollections).mockResolvedValue([mockCollection]);
    vi.mocked(db.fetchCloudCollections).mockRejectedValue(new Error('Network down'));

    render(
      <MemoryRouter initialEntries={['/']}>
        <ThemeProvider>
          <LanguageProvider>
            <AppContent />
          </LanguageProvider>
        </ThemeProvider>
      </MemoryRouter>,
    );

    // Cached collection renders rather than the full-screen sync-paused error.
    // (A non-blocking "Sync paused" status toast may still appear, so we assert
    // on the blocking error screen's Retry button rather than its text.)
    await waitFor(() => {
      expect(screen.getAllByText('Test Collection')[0]).toBeInTheDocument();
    });
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();
  });

  it('renders Item Detail field labels and placeholders with theme-aware contrast (CUR-85)', async () => {
    const { ThemeProvider } = await import('@/theme');
    const collectionWithField = {
      ...mockCollection,
      customFields: [
        {
          id: 'format',
          label: 'Format',
          type: 'text' as const,
          displayMode: 'detail' as const,
        },
      ],
    };
    vi.mocked(db.getLocalCollections).mockResolvedValue([collectionWithField]);

    render(
      <MemoryRouter initialEntries={['/collection/col1/item/item1']}>
        <ThemeProvider>
          <LanguageProvider>
            <AppContent />
          </LanguageProvider>
        </ThemeProvider>
      </MemoryRouter>,
    );

    const fieldLabel = await screen.findByText('Format');
    // Label must use the theme-aware muted token (gallery: text-stone-500),
    // not the hardcoded text-stone-300 that was invisible on white/cream cards.
    expect(fieldLabel.className).toContain('text-stone-500');
    expect(fieldLabel.className).not.toContain('text-stone-300');

    const fieldInput = fieldLabel.parentElement?.querySelector('input[placeholder="—"]');
    expect(fieldInput).toBeTruthy();
    // The "—" placeholder must be visible enough to read as "empty, click to edit".
    expect(fieldInput?.className).not.toContain('placeholder:text-stone-100');
    expect(fieldInput?.className).toContain('placeholder:text-stone-500');

    const registryCaption = screen.getByText(/registry quality/i);
    expect(registryCaption.className).toContain('text-stone-500');
    expect(registryCaption.className).not.toContain('text-stone-300');
  });

  it('keeps Item Detail field placeholder visible on the Vault dark theme (CUR-85)', async () => {
    // Regression: an earlier pass set vault placeholder to text-stone-500
    // (~4.2:1 on bg-stone-950), a meaningful drop from the original
    // text-stone-100 (~18.5:1). The light-theme fix should not regress
    // the dark theme — vault placeholder must stay clearly visible.
    const { ThemeProvider } = await import('@/theme');
    const collectionWithField = {
      ...mockCollection,
      customFields: [
        {
          id: 'format',
          label: 'Format',
          type: 'text' as const,
          displayMode: 'detail' as const,
        },
      ],
    };
    vi.mocked(db.getLocalCollections).mockResolvedValue([collectionWithField]);

    render(
      <MemoryRouter initialEntries={['/collection/col1/item/item1']}>
        {/* @ts-ignore - mocked ThemeProvider accepts initialTheme */}
        <ThemeProvider initialTheme="vault">
          <LanguageProvider>
            <AppContent />
          </LanguageProvider>
        </ThemeProvider>
      </MemoryRouter>,
    );

    const fieldLabel = await screen.findByText('Format');
    const fieldInput = fieldLabel.parentElement?.querySelector('input[placeholder="—"]');
    expect(fieldInput).toBeTruthy();
    expect(fieldInput?.className).toContain('placeholder:text-stone-400');
    expect(fieldInput?.className).not.toContain('placeholder:text-stone-500');
    expect(fieldInput?.className).not.toContain('placeholder:text-stone-100');
  });

  it('has i18n keys for collection search empty state', async () => {
    const { translations } = await import('@/i18n');

    expect(translations.en.collectionSearchNoResults).toContain('{query}');
    expect(translations.en.collectionFilterNoResults).toBeTruthy();
    expect(translations.en.clearSearch).toBeTruthy();

    expect(translations.zh.collectionSearchNoResults).toContain('{query}');
    expect(translations.zh.collectionFilterNoResults).toBeTruthy();
    expect(translations.zh.clearSearch).toBeTruthy();
  });
});
