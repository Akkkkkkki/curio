import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within, fireEvent, act } from '@testing-library/react';
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
    // Re-assert the default profiles-lookup shape every test so a test that
    // overrides `from` (e.g. to defer the admin lookup) cannot leak into the
    // next one — clearAllMocks does not restore implementations.
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
    vi.mocked(db.getLocalCollections).mockResolvedValue([mockCollection]);
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

  it('filters collection items and resets the query from the inline clear button', async () => {
    const { ThemeProvider } = await import('@/theme');
    const collectionWithSearchableItems = {
      ...mockCollection,
      items: [
        mockCollection.items[0],
        {
          ...mockCollection.items[0],
          id: 'item2',
          title: 'Moon Bowl',
          notes: 'Ceramic with a blue glaze',
          data: { maker: 'North Kiln' },
        },
      ],
    };
    vi.mocked(db.getLocalCollections).mockResolvedValue([collectionWithSearchableItems]);

    render(
      <MemoryRouter initialEntries={['/collection/col1']}>
        <ThemeProvider>
          <LanguageProvider>
            <AppContent />
          </LanguageProvider>
        </ThemeProvider>
      </MemoryRouter>,
    );

    const searchInput = (await screen.findByRole('textbox', {
      name: /search this collection/i,
    })) as HTMLInputElement;

    fireEvent.change(searchInput, { target: { value: 'Moon' } });

    await waitFor(() => {
      expect(screen.getAllByText('Moon Bowl')[0]).toBeInTheDocument();
      expect(screen.queryByText('Test Item')).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('collection-search-clear'));

    await waitFor(() => {
      expect(searchInput.value).toBe('');
      expect(screen.getAllByText('Test Item')[0]).toBeInTheDocument();
      expect(screen.getAllByText('Moon Bowl')[0]).toBeInTheDocument();
      expect(screen.queryByTestId('collection-search-clear')).not.toBeInTheDocument();
    });
  });

  it('shows collection search empty copy and clears it from the empty state action', async () => {
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

    const searchInput = (await screen.findByRole('textbox', {
      name: /search this collection/i,
    })) as HTMLInputElement;

    fireEvent.change(searchInput, { target: { value: 'zzzzz' } });

    await waitFor(() => {
      expect(screen.getByText('No matches found')).toBeInTheDocument();
      expect(
        screen.getByText('No items match “zzzzz”. Try a different search.'),
      ).toBeInTheDocument();
      expect(screen.queryByText('Test Item')).not.toBeInTheDocument();
    });

    const clearButtons = screen.getAllByRole('button', { name: /clear search/i });
    fireEvent.click(clearButtons[clearButtons.length - 1]);

    await waitFor(() => {
      expect(searchInput.value).toBe('');
      expect(screen.getAllByText('Test Item')[0]).toBeInTheDocument();
      expect(screen.queryByText('No matches found')).not.toBeInTheDocument();
    });
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

  // #149: photo uploads that keep failing must escalate from the calm
  // "pending" notice to an explicit error state — an eternal "will retry"
  // is fake certainty about photos that are not backed up.
  it('escalates the pending-uploads banner to an error once uploads have repeatedly failed (#149)', async () => {
    const { ThemeProvider } = await import('@/theme');
    vi.mocked(db.getPendingAssetUploadSummary).mockResolvedValue({ total: 3, stalled: 2 });

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
      expect(screen.getByText('2 photo(s) could not be backed up')).toBeInTheDocument();
    });
    expect(screen.getByText(/photos are safe on this device/i)).toBeInTheDocument();
    // The stalled state outranks the calm pending copy.
    expect(screen.queryByText('3 upload(s) pending')).not.toBeInTheDocument();

    // The banner's Retry must force an immediate attempt — stalled entries
    // sit behind a backoff window that a scheduled pass would skip.
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => {
      expect(db.syncPendingAssetUploads).toHaveBeenCalledWith({ force: true });
    });
  });

  it('keeps the calm pending-uploads notice while uploads are only queued (#149)', async () => {
    const { ThemeProvider } = await import('@/theme');
    vi.mocked(db.getPendingAssetUploadSummary).mockResolvedValue({ total: 2, stalled: 0 });

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
      expect(screen.getByText('2 upload(s) pending')).toBeInTheDocument();
    });
    expect(screen.queryByText(/could not be backed up/)).not.toBeInTheDocument();
  });

  it('shows the first-run Home with a sample path instead of a dead-end gate when cloud is not configured', async () => {
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
      expect(
        screen.getByRole('heading', { name: /start your museum with one thing you love/i }),
      ).toBeInTheDocument();
    });

    expect(screen.getByRole('link', { name: /wander a sample museum/i })).toHaveAttribute(
      'href',
      '/collection/sample-vinyl',
    );
    expect(screen.queryByTestId('collections-grid')).not.toBeInTheDocument();
    expect(screen.queryByTestId('access-gate')).not.toBeInTheDocument();
  });

  it('marks the app shell ready when the first-run fallback is rendered', async () => {
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
      expect(
        screen.getByRole('heading', { name: /start your museum with one thing you love/i }),
      ).toBeInTheDocument();
    });

    expect(screen.getByTestId('app-shell')).toHaveAttribute('data-ready', 'true');
  });

  it('holds app-shell readiness until the admin lookup settles and the admin re-refresh completes', async () => {
    const { ThemeProvider } = await import('@/theme');
    let resolveProfile!: (value: { data: { is_admin: boolean } | null; error: null }) => void;
    const profilePromise = new Promise<{ data: { is_admin: boolean } | null; error: null }>(
      (resolve) => {
        resolveProfile = resolve;
      },
    );
    vi.mocked(supabaseService.supabase!.from).mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({ single: vi.fn(() => profilePromise) })),
      })),
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

    // The signed-in member refresh completes, but readiness must hold while
    // the admin-profile lookup is still pending — seeding depends on it.
    await waitFor(() => {
      expect(db.fetchCloudCollections).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByTestId('app-shell')).toHaveAttribute('data-ready', 'false');

    await act(async () => {
      resolveProfile({ data: { is_admin: true }, error: null });
    });

    // The admin identity triggers a second (seeding) refresh; readiness only
    // arrives once that refresh has completed for the admin identity.
    await waitFor(() => {
      expect(db.fetchCloudCollections).toHaveBeenCalledTimes(2);
      expect(screen.getByTestId('app-shell')).toHaveAttribute('data-ready', 'true');
    });
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

    // The reassurance promise line must use the AA-compliant Gallery muted
    // token (stone-500, per DESIGN.md), not the too-faint stone-400 that
    // failed WCAG AA at 2.5:1 on the light surface (CUR-159).
    const promise = await screen.findByText(/Guided capture in under 5 minutes/i);
    expect(promise.className).toContain('text-stone-500');
    expect(promise.className).not.toContain('text-stone-400');
  });

  it('opens the auth modal in sign-up mode from the first-run "Add your first item" CTA (CUR-152)', async () => {
    const { ThemeProvider } = await import('@/theme');
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

    fireEvent.click(screen.getByTestId('cta-primary-add-first'));

    // The likeliest person clicking a first-run CTA has no account yet, so
    // the modal greets them with sign-up, not "Welcome Back".
    const modal = await screen.findByTestId('auth-modal');
    expect(within(modal).getByRole('heading', { name: /join the museum/i })).toBeInTheDocument();
    expect(within(modal).getByRole('button', { name: /create account/i })).toBeInTheDocument();

    // The manual escape hatch to sign-in stays available.
    fireEvent.click(within(modal).getByText(/Already have an account/i));
    expect(within(modal).getByRole('heading', { name: /welcome back/i })).toBeInTheDocument();
  });

  it('shows one desktop sign-in control that opens sign-in mode (CUR-157, CUR-152)', async () => {
    const { ThemeProvider } = await import('@/theme');
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

    // CUR-157: the header no longer carries a standalone ghost "Sign In" button
    // beside the account pill — the pill (aria-label "Account") is the single
    // desktop sign-in entry point.
    const header = screen.getByRole('banner');
    expect(within(header).queryByRole('button', { name: 'Sign In' })).not.toBeInTheDocument();

    // CUR-152: that single control opens the auth modal in sign-in mode.
    fireEvent.click(within(header).getByRole('button', { name: 'Account' }));
    const dropdown = await screen.findByTestId('profile-dropdown');
    fireEvent.click(within(dropdown).getByRole('button', { name: 'Sign In' }));

    const modal = await screen.findByTestId('auth-modal');
    expect(within(modal).getByRole('heading', { name: /welcome back/i })).toBeInTheDocument();
    expect(
      within(modal).queryByRole('heading', { name: /join the museum/i }),
    ).not.toBeInTheDocument();
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

    // Gate clears (public browsing enabled), sample content loads, and no extra cloud fetch fires.
    await waitFor(() => {
      expect(screen.queryByTestId('access-gate')).not.toBeInTheDocument();
    });
    await waitFor(
      () => {
        expect(screen.getByRole('heading', { name: 'The Vinyl Vault' })).toBeInTheDocument();
      },
      { timeout: 5000 },
    );
    expect(vi.mocked(db.fetchCloudCollections).mock.calls.length).toBe(fetchCallsAfterLoad);
  });

  it('keeps visible focus indicators on the item detail title and story fields', async () => {
    const { ThemeProvider } = await import('@/theme');

    render(
      <MemoryRouter initialEntries={['/collection/col1/item/item1']}>
        <ThemeProvider>
          <LanguageProvider>
            <AppContent />
          </LanguageProvider>
        </ThemeProvider>
      </MemoryRouter>,
    );

    const titleField = await screen.findByDisplayValue('Test Item', undefined, { timeout: 5000 });
    const storyField = await screen.findByDisplayValue('Test notes', undefined, { timeout: 5000 });

    expect(titleField.className).toContain('focus:border-amber-500');
    expect(storyField.className).toContain('focus:border-amber-500');
    expect(storyField.className).toContain('focus:ring-amber-500/30');
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

    const fieldInput = fieldLabel.parentElement?.querySelector('textarea[placeholder="—"]');
    expect(fieldInput).toBeTruthy();
    // The "—" placeholder must be visible enough to read as "empty, click to edit".
    expect(fieldInput?.className).not.toContain('placeholder:text-stone-100');
    expect(fieldInput?.className).toContain('placeholder:text-stone-500');

    const ratingCaption = screen.getByText(/your rating/i);
    expect(ratingCaption.className).toContain('text-stone-500');
    expect(ratingCaption.className).not.toContain('text-stone-300');
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
    const fieldInput = fieldLabel.parentElement?.querySelector('textarea[placeholder="—"]');
    expect(fieldInput).toBeTruthy();
    expect(fieldInput?.className).toContain('placeholder:text-stone-400');
    expect(fieldInput?.className).not.toContain('placeholder:text-stone-500');
    expect(fieldInput?.className).not.toContain('placeholder:text-stone-100');
  });

  it('renders long Item Detail text fields as wrapping textareas and keeps other field types one-line (CUR-145)', async () => {
    const { ThemeProvider } = await import('@/theme');
    const longFlavorNotes =
      'Rich, intense cocoa flavors with slight bitterness and a lingering cherry finish after the snap.';
    const collectionWithMixedFields = {
      ...mockCollection,
      customFields: [
        {
          id: 'flavor_notes',
          label: 'Flavor Notes',
          type: 'text' as const,
          displayMode: 'detail' as const,
        },
        {
          id: 'abv',
          label: 'ABV %',
          type: 'number' as const,
          displayMode: 'detail' as const,
        },
        {
          id: 'opened_on',
          label: 'Opened On',
          type: 'date' as const,
          displayMode: 'detail' as const,
        },
        {
          id: 'condition',
          label: 'Condition',
          type: 'select' as const,
          displayMode: 'detail' as const,
          options: ['New', 'Opened'],
        },
      ],
      items: [
        {
          ...mockCollection.items[0],
          data: {
            flavor_notes: longFlavorNotes,
            abv: '46',
            opened_on: '2026-07-06',
            condition: 'Opened',
          },
        },
      ],
    };
    vi.mocked(db.getLocalCollections).mockResolvedValue([collectionWithMixedFields]);

    render(
      <MemoryRouter initialEntries={['/collection/col1/item/item1']}>
        <ThemeProvider>
          <LanguageProvider>
            <AppContent />
          </LanguageProvider>
        </ThemeProvider>
      </MemoryRouter>,
    );

    const flavorLabel = await screen.findByText('Flavor Notes');
    const flavorTextarea = flavorLabel.parentElement?.querySelector('textarea');
    expect(flavorTextarea).toBeInstanceOf(HTMLTextAreaElement);
    expect(flavorTextarea).toHaveValue(longFlavorNotes);
    expect(flavorTextarea?.className).toContain('whitespace-pre-wrap');
    expect(flavorTextarea?.className).toContain('overflow-hidden');
    expect(flavorLabel.parentElement?.querySelector('input')).toBeNull();

    for (const labelText of ['ABV %', 'Opened On', 'Condition']) {
      const label = screen.getByText(labelText);
      expect(label.parentElement?.querySelector('input')).toBeInstanceOf(HTMLInputElement);
      expect(label.parentElement?.querySelector('textarea')).toBeNull();
    }
  });

  it('renders Item Detail rating stars with Vault filled and empty contrast tokens (CUR-98)', async () => {
    const { ThemeProvider } = await import('@/theme');
    const collectionWithLowRating = {
      ...mockCollection,
      items: [
        {
          ...mockCollection.items[0],
          rating: 2,
        },
      ],
    };
    vi.mocked(db.getLocalCollections).mockResolvedValue([collectionWithLowRating]);

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

    const filledButton = await screen.findByRole('button', { name: 'Rate 2 stars' });
    const emptyButton = await screen.findByRole('button', { name: 'Rate 3 stars' });
    const filledStar = filledButton.querySelector('svg');
    const emptyStar = emptyButton.querySelector('svg');

    expect(filledButton).toHaveAttribute('aria-pressed', 'true');
    expect(filledStar).toHaveClass('text-[#D4A574]');
    expect(filledStar).toHaveClass('fill-current');
    expect(emptyStar).toHaveClass('text-[#D4A574]/30');
    expect(emptyStar).not.toHaveClass('fill-current');
    expect(emptyStar?.getAttribute('class')).not.toContain('text-amber-500/20');
  });

  it('shows the numeric rating value next to the Item Detail stars (CUR-47)', async () => {
    const { ThemeProvider } = await import('@/theme');
    const collectionWithRating = {
      ...mockCollection,
      items: [
        {
          ...mockCollection.items[0],
          rating: 3,
        },
      ],
    };
    vi.mocked(db.getLocalCollections).mockResolvedValue([collectionWithRating]);

    render(
      <MemoryRouter initialEntries={['/collection/col1/item/item1']}>
        <ThemeProvider>
          <LanguageProvider>
            <AppContent />
          </LanguageProvider>
        </ThemeProvider>
      </MemoryRouter>,
    );

    await screen.findByRole('button', { name: 'Rate 3 stars' });
    const value = screen.getByText('3/5');
    expect(value).toBeInTheDocument();
    expect(value.className).toContain('font-mono');
    expect(value.className).toContain('tabular-nums');
  });

  it('hides the numeric rating value while an item is unrated (CUR-47)', async () => {
    const { ThemeProvider } = await import('@/theme');
    const unratedCollection = {
      ...mockCollection,
      items: [
        {
          ...mockCollection.items[0],
          rating: 0,
        },
      ],
    };
    vi.mocked(db.getLocalCollections).mockResolvedValue([unratedCollection]);

    render(
      <MemoryRouter initialEntries={['/collection/col1/item/item1']}>
        <ThemeProvider>
          <LanguageProvider>
            <AppContent />
          </LanguageProvider>
        </ThemeProvider>
      </MemoryRouter>,
    );

    await screen.findByRole('button', { name: 'Rate 1 stars' });
    expect(screen.queryByText(/^\d\/5$/)).not.toBeInTheDocument();
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

  // Foundation for timeline browsing: a small "Added on" accession plate at
  // the bottom of Item Detail surfaces the existing createdAt so the archive
  // feels like it grows over time. Tests cover EN + ZH locales and the
  // accession typography per DESIGN.md.
  it('shows item created date as an accession plate on Item Detail in English', async () => {
    const { ThemeProvider } = await import('@/theme');
    const collectionWithDatedItem = {
      ...mockCollection,
      items: [
        {
          ...mockCollection.items[0],
          createdAt: '2026-03-15T12:00:00.000Z',
        },
      ],
    };
    vi.mocked(db.getLocalCollections).mockResolvedValue([collectionWithDatedItem]);

    render(
      <MemoryRouter initialEntries={['/collection/col1/item/item1']}>
        <ThemeProvider>
          <LanguageProvider>
            <AppContent />
          </LanguageProvider>
        </ThemeProvider>
      </MemoryRouter>,
    );

    const plate = await screen.findByTestId('item-added-on');
    expect(plate.textContent).toBe('Added on March 15, 2026');
    // Accession styling per DESIGN.md: 10px mono, wide tracking, low opacity.
    expect(plate.className).toContain('font-mono');
    expect(plate.className).toContain('text-[10px]');
    expect(plate.className).toContain('opacity-30');
    expect(plate.className).toContain('uppercase');
  });

  it('formats the Added on plate per locale when language switches to ZH', async () => {
    const { ThemeProvider } = await import('@/theme');
    const collectionWithDatedItem = {
      ...mockCollection,
      items: [
        {
          ...mockCollection.items[0],
          createdAt: '2026-03-15T12:00:00.000Z',
        },
      ],
    };
    vi.mocked(db.getLocalCollections).mockResolvedValue([collectionWithDatedItem]);

    window.localStorage.setItem('curio_language', 'zh');
    try {
      render(
        <MemoryRouter initialEntries={['/collection/col1/item/item1']}>
          <ThemeProvider>
            <LanguageProvider>
              <AppContent />
            </LanguageProvider>
          </ThemeProvider>
        </MemoryRouter>,
      );

      const plate = await screen.findByTestId('item-added-on');
      expect(plate.textContent).toBe('添加于 2026年3月15日');
    } finally {
      window.localStorage.removeItem('curio_language');
    }
  });

  // CUR-115: Item Detail title textarea must announce its accessible name,
  // required state, and validation error to assistive tech. The visual red
  // border alone leaves SR users with no signal that the field is invalid.
  it('exposes the Item Detail title textarea with aria-label and aria-required (CUR-115)', async () => {
    const { ThemeProvider } = await import('@/theme');

    render(
      <MemoryRouter initialEntries={['/collection/col1/item/item1']}>
        <ThemeProvider>
          <LanguageProvider>
            <AppContent />
          </LanguageProvider>
        </ThemeProvider>
      </MemoryRouter>,
    );

    const titleInput = await screen.findByRole('textbox', { name: 'Title' });
    expect(titleInput).toBeInstanceOf(HTMLTextAreaElement);
    expect(titleInput).toHaveAttribute('aria-required', 'true');
    // A filled title is not invalid and must not be linked to an error.
    expect(titleInput).not.toHaveAttribute('aria-invalid', 'true');
    expect(titleInput).not.toHaveAttribute('aria-describedby');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('flags the Item Detail title as invalid and links the error when empty (CUR-115)', async () => {
    const { ThemeProvider } = await import('@/theme');
    const collectionWithUntitled = {
      ...mockCollection,
      items: [{ ...mockCollection.items[0], title: '' }],
    };
    vi.mocked(db.getLocalCollections).mockResolvedValue([collectionWithUntitled]);

    render(
      <MemoryRouter initialEntries={['/collection/col1/item/item1']}>
        <ThemeProvider>
          <LanguageProvider>
            <AppContent />
          </LanguageProvider>
        </ThemeProvider>
      </MemoryRouter>,
    );

    const titleInput = await screen.findByRole('textbox', { name: 'Title' });
    expect(titleInput).toHaveAttribute('aria-invalid', 'true');
    expect(titleInput).toHaveAttribute('aria-describedby', 'item-detail-title-error');

    const errorMessage = screen.getByRole('alert');
    expect(errorMessage).toHaveAttribute('id', 'item-detail-title-error');
    expect(errorMessage.textContent).toBe('Title is required');
  });

  it('cancels a queued item edit save before deleting that item', async () => {
    const { ThemeProvider } = await import('@/theme');

    render(
      <MemoryRouter initialEntries={['/collection/col1/item/item1']}>
        <ThemeProvider>
          <LanguageProvider>
            <AppContent />
          </LanguageProvider>
        </ThemeProvider>
      </MemoryRouter>,
    );

    const titleInput = await screen.findByRole('textbox', { name: 'Title' });

    vi.useFakeTimers();
    try {
      fireEvent.change(titleInput, { target: { value: 'Edited before delete' } });
      expect(db.saveCollection).not.toHaveBeenCalled();

      fireEvent.click(screen.getByRole('button', { name: 'Delete Item' }));
      const dialog = screen.getByRole('dialog', { name: 'Delete Item' });
      fireEvent.click(within(dialog).getByRole('button', { name: 'Delete Item' }));

      expect(db.deleteCloudItem).toHaveBeenCalledWith('col1', 'item1');
      expect(db.saveCollection).toHaveBeenCalledTimes(1);
      expect(vi.mocked(db.saveCollection).mock.calls[0][0].items).toEqual([]);

      await act(async () => {
        vi.advanceTimersByTime(1600);
      });

      expect(db.saveCollection).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('deep-links the access-gate "Explore sample" CTA into the sample collection (#287)', async () => {
    const { ThemeProvider } = await import('@/theme');
    // Signed-out visitor, Supabase configured, with a public sample loaded.
    // Clicking "Explore sample" on the access gate must land the user *on*
    // the sample collection, not on an intermediate home grid — the
    // single-path first-run contract calls for one tap from the gate into
    // the gallery preview.
    const publicSample = {
      id: 'sample-vinyl',
      name: 'The Vinyl Vault',
      templateId: 'vinyl',
      icon: '🎵',
      customFields: [],
      items: [
        {
          id: 'sample-item-1',
          collectionId: 'sample-vinyl',
          title: 'Kind of Blue',
          rating: 5,
          data: {},
          photoUrl: '',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          notes: '',
        },
      ],
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
    // Wait for the initial cloud load so sampleCollectionId is resolvable
    // by the time the CTA fires (matches the real-world timing — by the
    // time a visitor reads the gate and clicks, the load has finished).
    await waitFor(() => {
      expect(vi.mocked(db.fetchCloudCollections)).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByTestId('cta-secondary-explore-sample'));

    // Access gate clears AND we land on the sample collection itself —
    // items-grid is unique to CollectionScreen, so its presence (plus the
    // absence of collections-grid) is positive proof of the deep-link.
    await waitFor(() => {
      expect(screen.queryByTestId('access-gate')).not.toBeInTheDocument();
    });
    expect(await screen.findByTestId('items-grid')).toBeInTheDocument();
    expect(screen.queryByTestId('collections-grid')).not.toBeInTheDocument();
  });

  // CUR-118: a hard reload on a deep link must not bounce back to Home while
  // the initial cloud fetch is still in flight. The route should hold its URL
  // and render a loading affordance until data resolves, then render the
  // target collection / item.
  it('shows a loading skeleton on /collection/:id while cloud fetch is in flight (CUR-118)', async () => {
    const { ThemeProvider } = await import('@/theme');
    let resolveCloud: (value: (typeof mockCollection)[]) => void = () => {};
    vi.mocked(db.getLocalCollections).mockResolvedValue([]);
    vi.mocked(db.fetchCloudCollections).mockReturnValue(
      new Promise((resolve) => {
        resolveCloud = resolve;
      }) as never,
    );

    render(
      <MemoryRouter initialEntries={['/collection/col1']}>
        <ThemeProvider>
          <LanguageProvider>
            <AppContent />
          </LanguageProvider>
        </ThemeProvider>
      </MemoryRouter>,
    );

    // While loading, the deep-link route renders its own skeleton — not
    // HomeScreen's collections-grid. Bouncing back to Home would surface
    // the grid (or the home loader) instead, so this asserts both halves.
    // Re-query inside waitFor: the route screens remount on app re-renders,
    // so a node captured by findBy can detach before the assertion runs.
    await waitFor(() => {
      expect(screen.getByTestId('collection-screen-skeleton')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('collections-grid')).not.toBeInTheDocument();

    // Once the cloud fetch resolves, the actual collection takes over.
    resolveCloud([mockCollection]);
    await waitFor(() => {
      expect(screen.getAllByText('Test Collection')[0]).toBeInTheDocument();
    });
    expect(screen.queryByTestId('collection-screen-skeleton')).not.toBeInTheDocument();
  });

  it('shows a loading skeleton on /collection/:id/item/:itemId while cloud fetch is in flight (CUR-118)', async () => {
    const { ThemeProvider } = await import('@/theme');
    let resolveCloud: (value: (typeof mockCollection)[]) => void = () => {};
    vi.mocked(db.getLocalCollections).mockResolvedValue([]);
    vi.mocked(db.fetchCloudCollections).mockReturnValue(
      new Promise((resolve) => {
        resolveCloud = resolve;
      }) as never,
    );

    render(
      <MemoryRouter initialEntries={['/collection/col1/item/item1']}>
        <ThemeProvider>
          <LanguageProvider>
            <AppContent />
          </LanguageProvider>
        </ThemeProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('item-detail-skeleton')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('collections-grid')).not.toBeInTheDocument();

    resolveCloud([mockCollection]);
    // Once data lands, the item detail textarea (Title) replaces the skeleton.
    await waitFor(() => {
      expect(screen.getByRole('textbox', { name: 'Title' })).toBeInTheDocument();
    });
    expect(screen.queryByTestId('item-detail-skeleton')).not.toBeInTheDocument();
  });

  it('falls back to Home when /collection/:id is genuinely missing after load (CUR-118)', async () => {
    const { ThemeProvider } = await import('@/theme');
    vi.mocked(db.getLocalCollections).mockResolvedValue([mockCollection]);
    vi.mocked(db.fetchCloudCollections).mockResolvedValue([mockCollection]);

    render(
      <MemoryRouter initialEntries={['/collection/does-not-exist']}>
        <ThemeProvider>
          <LanguageProvider>
            <AppContent />
          </LanguageProvider>
        </ThemeProvider>
      </MemoryRouter>,
    );

    // Once loading completes and the id is still unknown, Navigate fires
    // and HomeScreen's grid takes over — the loading skeleton disappears.
    await waitFor(() => {
      expect(screen.getByTestId('collections-grid')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('collection-screen-skeleton')).not.toBeInTheDocument();
  });

  // CUR-144: shared collection links are the sharing pillar. A signed-out
  // visitor opening /collection/:id must reach the content — not the generic
  // welcome gate rendered forever under the collection URL.
  describe('anonymous collection deep links (CUR-144)', () => {
    const publicSample = {
      id: 'sample-vinyl',
      name: 'The Vinyl Vault',
      templateId: 'vinyl',
      icon: '🎵',
      customFields: [],
      items: [
        {
          id: 'sample-item-1',
          collectionId: 'sample-vinyl',
          title: 'Kind of Blue',
          rating: 5,
          data: {},
          photoUrl: '',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          notes: '',
        },
      ],
      isPublic: true,
      updatedAt: new Date().toISOString(),
    };

    beforeEach(() => {
      vi.mocked(supabaseService.isSupabaseConfigured).mockReturnValue(true);
      vi.mocked(supabaseService.supabase!.auth.getSession).mockResolvedValue({
        data: { session: null },
      } as never);
      vi.mocked(db.getLocalCollections).mockResolvedValue([]);
      vi.mocked(db.fetchCloudCollections).mockResolvedValue([publicSample]);
    });

    it('renders the public sample collection instead of the access gate', async () => {
      const { ThemeProvider } = await import('@/theme');

      render(
        <MemoryRouter initialEntries={['/collection/sample-vinyl']}>
          <ThemeProvider>
            <LanguageProvider>
              <AppContent />
            </LanguageProvider>
          </ThemeProvider>
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'The Vinyl Vault' })).toBeInTheDocument();
      });
      expect(screen.getByTestId('items-grid')).toBeInTheDocument();
      expect(screen.queryByTestId('access-gate')).not.toBeInTheDocument();
    });

    it('shows an explanatory not-available state (not the welcome card) for a private or unknown id', async () => {
      const { ThemeProvider } = await import('@/theme');

      render(
        <MemoryRouter initialEntries={['/collection/someone-elses-archive']}>
          <ThemeProvider>
            <LanguageProvider>
              <AppContent />
            </LanguageProvider>
          </ThemeProvider>
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(screen.getByTestId('collection-unavailable')).toBeInTheDocument();
      });
      expect(screen.queryByTestId('access-gate')).not.toBeInTheDocument();
      expect(screen.getByTestId('collection-unavailable-sign-in')).toBeInTheDocument();

      // The Explore path routes onward to the resolvable public sample.
      fireEvent.click(screen.getByTestId('collection-unavailable-explore'));
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'The Vinyl Vault' })).toBeInTheDocument();
      });
    });

    it('routes an anonymous item link with an unknown collection to the not-available state', async () => {
      const { ThemeProvider } = await import('@/theme');

      render(
        <MemoryRouter initialEntries={['/collection/someone-elses-archive/item/some-item']}>
          <ThemeProvider>
            <LanguageProvider>
              <AppContent />
            </LanguageProvider>
          </ThemeProvider>
        </MemoryRouter>,
      );

      // The item route falls through to /collection/:id, where the anon
      // not-available explanation renders — the visitor never silently loses
      // the link to a bare Home (Codex review on #340).
      await waitFor(() => {
        expect(screen.getByTestId('collection-unavailable')).toBeInTheDocument();
      });
      expect(screen.queryByTestId('access-gate')).not.toBeInTheDocument();
    });

    it('does not latch public browsing for a signed-in collection visit (gate survives sign-out)', async () => {
      const { ThemeProvider } = await import('@/theme');
      // Signed-in session viewing a private collection; capture the auth
      // listener so the test can emit SIGNED_OUT later.
      vi.mocked(supabaseService.supabase!.auth.getSession).mockResolvedValue({
        data: { session: { user: { id: 'user1' } } },
      } as never);
      vi.mocked(db.getLocalCollections).mockResolvedValue([mockCollection]);
      vi.mocked(db.fetchCloudCollections).mockResolvedValue([mockCollection]);
      let authCallback: ((event: string, session: unknown) => void) | null = null;
      vi.mocked(supabaseService.supabase!.auth.onAuthStateChange).mockImplementation(((
        cb: (event: string, session: unknown) => void,
      ) => {
        authCallback = cb;
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      }) as never);

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
        expect(screen.getAllByText('Test Collection')[0]).toBeInTheDocument();
      });

      // Leave the collection while still signed in, then sign out from Home.
      const bottomNav = screen.getByRole('navigation', { name: 'Primary' });
      fireEvent.click(within(bottomNav).getByRole('link', { name: /home/i }));
      await waitFor(() => {
        expect(screen.getByTestId('collections-grid')).toBeInTheDocument();
      });

      await act(async () => {
        authCallback?.('SIGNED_OUT', null);
      });

      // The authed collection visit must not have latched public browsing —
      // a signed-out Home still greets with the welcome gate (Codex review
      // on #340).
      await waitFor(() => {
        expect(screen.getByTestId('access-gate')).toBeInTheDocument();
      });
    });

    it('latches public browsing so navigating Home afterwards is not re-gated', async () => {
      const { ThemeProvider } = await import('@/theme');

      render(
        <MemoryRouter initialEntries={['/collection/sample-vinyl']}>
          <ThemeProvider>
            <LanguageProvider>
              <AppContent />
            </LanguageProvider>
          </ThemeProvider>
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'The Vinyl Vault' })).toBeInTheDocument();
      });

      // Same contract as the Explore CTAs: once the visitor is browsing
      // shared content, Home shows the sample-aware first-run Home, not the
      // access gate again.
      const bottomNav = screen.getByRole('navigation', { name: 'Primary' });
      fireEvent.click(within(bottomNav).getByRole('link', { name: /home/i }));

      await waitFor(() => {
        expect(
          screen.getByRole('heading', { name: /start your museum with one thing you love/i }),
        ).toBeInTheDocument();
      });
      expect(screen.queryByTestId('access-gate')).not.toBeInTheDocument();
    });
  });

  // CUR-118 follow-up (Codex review on #299): when the parent collection
  // is already cached but the item is only in the pending cloud response,
  // the missing-item branch must also wait for `isLoading` to settle —
  // otherwise a refresh-mid-deep-link drops the user on the parent route.
  it('holds /collection/:id/item/:itemId on the skeleton when the item is still pending while the collection is cached (CUR-118)', async () => {
    const { ThemeProvider } = await import('@/theme');
    // Local cache has the collection but no item; cloud will eventually
    // deliver the same collection with the item attached.
    const cachedCollectionWithoutItem = { ...mockCollection, items: [] };
    let resolveCloud: (value: (typeof mockCollection)[]) => void = () => {};
    vi.mocked(db.getLocalCollections).mockResolvedValue([cachedCollectionWithoutItem]);
    vi.mocked(db.fetchCloudCollections).mockReturnValue(
      new Promise((resolve) => {
        resolveCloud = resolve;
      }) as never,
    );

    render(
      <MemoryRouter initialEntries={['/collection/col1/item/item1']}>
        <ThemeProvider>
          <LanguageProvider>
            <AppContent />
          </LanguageProvider>
        </ThemeProvider>
      </MemoryRouter>,
    );

    // While `isLoading` is true and only the cached collection (no item) is
    // visible, the route must stay on the skeleton instead of redirecting
    // to the parent collection.
    await waitFor(() => {
      expect(screen.getByTestId('item-detail-skeleton')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('items-grid')).not.toBeInTheDocument();

    // Cloud lands with the item attached — detail renders.
    resolveCloud([mockCollection]);
    await waitFor(() => {
      expect(screen.getByRole('textbox', { name: 'Title' })).toBeInTheDocument();
    });
    expect(screen.queryByTestId('item-detail-skeleton')).not.toBeInTheDocument();
  });

  // CUR-117: the bottom-nav Add is the most-touched primary action on mobile.
  // When the user is already inside a collection (or one of its items), it
  // must inherit that collection and open the modal on the upload step, the
  // same as the in-screen "Add Item" button — otherwise the user is forced to
  // re-pick a collection they just had open.
  it('bottom-nav Add inherits the current collection from /collection/:id (CUR-117)', async () => {
    const { ThemeProvider } = await import('@/theme');
    // Two editable collections are required to prove the fix — with a single
    // collection, the modal auto-picks it regardless, so the regression
    // (forcing the picker) would only surface with multiple targets.
    const secondCollection = {
      ...mockCollection,
      id: 'col2',
      name: 'Second Collection',
      items: [],
    };
    vi.mocked(db.getLocalCollections).mockResolvedValue([mockCollection, secondCollection]);

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
      expect(screen.getByText('Test Collection')).toBeInTheDocument();
    });

    const bottomNav = screen.getByRole('navigation', { name: 'Primary' });
    fireEvent.click(within(bottomNav).getByTestId('bottom-nav-add-pill'));

    // Upload step renders the "Take Photo" CTA; the collection picker would
    // show the "Start a collection" heading instead. Asserting the upload
    // affordance proves the modal skipped the redundant pick step.
    expect(await screen.findByRole('button', { name: /take photo/i })).toBeInTheDocument();
    expect(screen.queryByText('Start a collection')).not.toBeInTheDocument();
  });

  it('bottom-nav Add inherits the current collection from /collection/:id/item/:itemId (CUR-117)', async () => {
    const { ThemeProvider } = await import('@/theme');
    // Two editable collections so the modal would otherwise force a picker
    // pass. The bottom-nav Add must still inherit col1 from the URL.
    const secondCollection = {
      ...mockCollection,
      id: 'col2',
      name: 'Second Collection',
      items: [],
    };
    vi.mocked(db.getLocalCollections).mockResolvedValue([mockCollection, secondCollection]);

    render(
      <MemoryRouter initialEntries={['/collection/col1/item/item1']}>
        <ThemeProvider>
          <LanguageProvider>
            <AppContent />
          </LanguageProvider>
        </ThemeProvider>
      </MemoryRouter>,
    );

    expect(await screen.findByRole('textbox', { name: 'Title' })).toBeInTheDocument();

    const bottomNav = screen.getByRole('navigation', { name: 'Primary' });
    fireEvent.click(within(bottomNav).getByTestId('bottom-nav-add-pill'));

    expect(await screen.findByRole('button', { name: /take photo/i })).toBeInTheDocument();
    expect(screen.queryByText('Start a collection')).not.toBeInTheDocument();
  });

  it('bottom-nav Add still shows the picker from inside a read-only sample collection (CUR-117)', async () => {
    const { ThemeProvider } = await import('@/theme');
    // Public sample (read-only for non-admin) plus two editable private
    // collections. The user is browsing the sample, so the modal must NOT
    // preset the sample (they can't save into it). With more than one
    // editable target available, the picker must render so the user can
    // route the new item to their own collection.
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
    const secondCollection = {
      ...mockCollection,
      id: 'col2',
      name: 'Second Collection',
      items: [],
    };
    vi.mocked(db.getLocalCollections).mockResolvedValue([
      publicSample,
      mockCollection,
      secondCollection,
    ]);

    render(
      <MemoryRouter initialEntries={['/collection/sample-vinyl']}>
        <ThemeProvider>
          <LanguageProvider>
            <AppContent />
          </LanguageProvider>
        </ThemeProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('The Vinyl Vault')).toBeInTheDocument();
    });

    const bottomNav = screen.getByRole('navigation', { name: 'Primary' });
    fireEvent.click(within(bottomNav).getByTestId('bottom-nav-add-pill'));

    // Picker step shows the "Start a collection" heading and the user's own
    // collection cards — proving the modal refused to default to the sample
    // and instead let the user choose where the item belongs.
    expect(await screen.findByText('Start a collection')).toBeInTheDocument();
    expect(screen.getByText('Test Collection')).toBeInTheDocument();
    expect(screen.getByText('Second Collection')).toBeInTheDocument();
  });

  // CUR-93: Active filter chips and the "Clear all" link hardcoded amber-50
  // and stone-500 tokens. On Vault the chips punched through the dark page as
  // pale yellow blocks and the muted link collapsed against the surface. The
  // fix mirrors the warning tone in StatusBanner (CUR-81) so the chips read
  // as one system across all three themes.
  const applyRatingFilter = async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Filter Collection' }));
    const dialog = await screen.findByRole('dialog', { name: 'Filter Collection' });
    const ratingSelect = within(dialog).getByRole('combobox');
    fireEvent.change(ratingSelect, { target: { value: '5' } });
    fireEvent.click(within(dialog).getByRole('button', { name: /apply/i }));
  };

  it('renders active filter chips with theme-aware tokens on Vault (CUR-93)', async () => {
    const { ThemeProvider } = await import('@/theme');

    render(
      <MemoryRouter initialEntries={['/collection/col1']}>
        {/* @ts-ignore - mocked ThemeProvider accepts initialTheme */}
        <ThemeProvider initialTheme="vault">
          <LanguageProvider>
            <AppContent />
          </LanguageProvider>
        </ThemeProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Test Collection')).toBeInTheDocument();
    });

    await applyRatingFilter();

    const chip = await screen.findByTestId('active-filter-chip');
    // Vault uses amber-tinted dark tokens instead of the pale amber-50 pill.
    expect(chip.classList).toContain('bg-amber-500/10');
    expect(chip.classList).toContain('text-amber-200');
    expect(chip.classList).toContain('border-amber-400/20');
    expect(chip.classList).not.toContain('bg-amber-50');

    const clearAll = screen.getByTestId('active-filter-clear-all');
    expect(clearAll.classList).toContain('text-stone-300');
    expect(clearAll.classList).not.toContain('text-stone-500');
  });

  it('preserves Gallery tokens for active filter chips on the default theme (CUR-93)', async () => {
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

    await waitFor(() => {
      expect(screen.getByText('Test Collection')).toBeInTheDocument();
    });

    await applyRatingFilter();

    const chip = await screen.findByTestId('active-filter-chip');
    expect(chip.classList).toContain('bg-amber-50');
    expect(chip.classList).toContain('text-amber-800');
    expect(chip.classList).toContain('border-amber-100');

    const clearAll = screen.getByTestId('active-filter-clear-all');
    expect(clearAll.classList).toContain('text-stone-500');
  });

  it('uses Atelier warm-brown tokens for active filter chips (CUR-93)', async () => {
    const { ThemeProvider } = await import('@/theme');

    render(
      <MemoryRouter initialEntries={['/collection/col1']}>
        {/* @ts-ignore - mocked ThemeProvider accepts initialTheme */}
        <ThemeProvider initialTheme="atelier">
          <LanguageProvider>
            <AppContent />
          </LanguageProvider>
        </ThemeProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Test Collection')).toBeInTheDocument();
    });

    await applyRatingFilter();

    const chip = await screen.findByTestId('active-filter-chip');
    expect(chip.classList).toContain('bg-amber-100/70');
    expect(chip.classList).toContain('text-amber-900');

    const clearAll = screen.getByTestId('active-filter-clear-all');
    expect(clearAll.classList).toContain('text-[#8C7B6B]');
  });

  // CUR-135: Item Detail undo/redo can be reached from the keyboard so power
  // editors don't have to leave their editing context to step back a change.
  describe('Item Detail persistent save status (CUR-60)', () => {
    const renderItemDetail = async () => {
      const { ThemeProvider } = await import('@/theme');
      render(
        <MemoryRouter initialEntries={['/collection/col1/item/item1']}>
          <ThemeProvider>
            <LanguageProvider>
              <AppContent />
            </LanguageProvider>
          </ThemeProvider>
        </MemoryRouter>,
      );
    };

    const getSyncStatusCallback = () => {
      const callback = vi
        .mocked(db.setSyncStatusCallback)
        .mock.calls.map(([candidate]) => candidate)
        .findLast((candidate) => typeof candidate === 'function');
      expect(callback).toBeTypeOf('function');
      return callback as (status: db.SyncStatus, error?: string) => void;
    };

    it('shows Saving during the debounce and Saved after sync confirms backup', async () => {
      await renderItemDetail();
      const titleField = (await screen.findByRole('textbox', {
        name: 'Title',
      })) as HTMLTextAreaElement;

      vi.useFakeTimers();
      try {
        act(() => {
          fireEvent.change(titleField, { target: { value: 'Edited Item' } });
        });

        expect(screen.getByTestId('item-save-status')).toHaveTextContent('Saving…');
        expect(db.saveCollection).not.toHaveBeenCalled();

        await act(async () => {
          vi.advanceTimersByTime(1500);
          await Promise.resolve();
        });

        expect(db.saveCollection).toHaveBeenCalledTimes(1);

        act(() => {
          getSyncStatusCallback()('synced');
        });

        expect(screen.getByTestId('item-save-status')).toHaveTextContent('Saved & backed up');
      } finally {
        vi.useRealTimers();
      }
    });

    it('keeps Saving when a sync completes for an older save while a newer edit is pending', async () => {
      await renderItemDetail();
      const titleField = (await screen.findByRole('textbox', {
        name: 'Title',
      })) as HTMLTextAreaElement;

      vi.useFakeTimers();
      try {
        // First edit's debounce fires and its save starts.
        act(() => {
          fireEvent.change(titleField, { target: { value: 'Edited Item' } });
        });
        await act(async () => {
          vi.advanceTimersByTime(1500);
          await Promise.resolve();
        });
        expect(db.saveCollection).toHaveBeenCalledTimes(1);

        // A second edit lands before the first save's sync confirmation.
        // Re-query the field: the detail screen re-renders between edits.
        act(() => {
          fireEvent.change(screen.getByRole('textbox', { name: 'Title' }), {
            target: { value: 'Edited Item Again' },
          });
        });
        expect(screen.getByTestId('item-save-status')).toHaveTextContent('Saving…');

        // The first save's sync event must not mark the newer edit as backed up.
        act(() => {
          getSyncStatusCallback()('synced');
        });
        expect(screen.getByTestId('item-save-status')).toHaveTextContent('Saving…');

        // Once the second save runs and its sync confirms, the badge resolves.
        await act(async () => {
          vi.advanceTimersByTime(1500);
          await Promise.resolve();
        });
        expect(db.saveCollection).toHaveBeenCalledTimes(2);
        act(() => {
          getSyncStatusCallback()('synced');
        });
        expect(screen.getByTestId('item-save-status')).toHaveTextContent('Saved & backed up');
      } finally {
        vi.useRealTimers();
      }
    });

    it('keeps a retryable error state when sync fails', async () => {
      await renderItemDetail();
      const titleField = (await screen.findByRole('textbox', {
        name: 'Title',
      })) as HTMLTextAreaElement;

      vi.useFakeTimers();
      try {
        act(() => {
          fireEvent.change(titleField, { target: { value: 'Edited Item' } });
        });
        await act(async () => {
          vi.advanceTimersByTime(1500);
          await Promise.resolve();
        });

        act(() => {
          getSyncStatusCallback()('error', 'network unavailable');
        });

        const status = screen.getByTestId('item-save-status');
        expect(status).toHaveTextContent('Save failed');

        await act(async () => {
          fireEvent.click(within(status).getByRole('button', { name: 'Retry' }));
          await Promise.resolve();
        });

        expect(db.saveCollection).toHaveBeenCalledTimes(2);
        expect(screen.getByTestId('item-save-status')).toHaveTextContent('Saving…');
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe('Item Detail undo/redo keyboard shortcut (CUR-135)', () => {
    const renderItemDetail = async () => {
      const { ThemeProvider } = await import('@/theme');
      render(
        <MemoryRouter initialEntries={['/collection/col1/item/item1']}>
          <ThemeProvider>
            <LanguageProvider>
              <AppContent />
            </LanguageProvider>
          </ThemeProvider>
        </MemoryRouter>,
      );
    };

    it('reveals the shortcut hint on the Undo / Redo button titles', async () => {
      await renderItemDetail();
      const undoButton = await screen.findByRole('button', { name: 'Undo' });
      const redoButton = screen.getByRole('button', { name: 'Redo' });
      // jsdom reports navigator.platform as an empty string, so tests exercise
      // the non-Mac shortcut labels. The Mac branch is a swap of the display
      // string only — no separate code path.
      expect(undoButton.getAttribute('title')).toBe('Undo (Ctrl+Z)');
      expect(redoButton.getAttribute('title')).toBe('Redo (Ctrl+Shift+Z)');
      // aria-label stays the plain action so screen readers keep announcing
      // "Undo" / "Redo" cleanly without spelling out the shortcut.
      expect(undoButton.getAttribute('aria-label')).toBe('Undo');
      expect(redoButton.getAttribute('aria-label')).toBe('Redo');
    });

    it('defers to the browser when Ctrl+Z fires inside the title textarea', async () => {
      await renderItemDetail();
      const titleField = (await screen.findByRole('textbox', {
        name: 'Title',
      })) as HTMLTextAreaElement;

      // Native undo inside a text field is the browser's job — the handler
      // must not preventDefault, so per-field typing history stays reachable.
      const event = new KeyboardEvent('keydown', {
        key: 'z',
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      });
      titleField.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(false);
    });

    it('hides the Undo button on read-only public sample collections', async () => {
      vi.mocked(db.getLocalCollections).mockResolvedValue([{ ...mockCollection, isPublic: true }]);
      await renderItemDetail();

      // Read-only detail hides the whole action row, so the shortcut has no
      // buttons to expose and no history to step through.
      await screen.findByRole('textbox', { name: 'Title' });
      expect(screen.queryByRole('button', { name: 'Undo' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Redo' })).not.toBeInTheDocument();
    });

    it('lets the browser handle Ctrl+Z when focus is inside a modal dialog', async () => {
      await renderItemDetail();
      await screen.findByRole('textbox', { name: 'Title' });

      // Item modals (Export, Delete, Enhance, ImageEdit, …) mount above the
      // detail while it stays in the DOM. Pressing the shortcut from a modal
      // button must not mutate the item behind the dialog. Simulate a modal
      // subtree to prove the closest([aria-modal]) gate short-circuits.
      const modal = document.createElement('div');
      modal.setAttribute('role', 'dialog');
      modal.setAttribute('aria-modal', 'true');
      const modalButton = document.createElement('button');
      modal.appendChild(modalButton);
      document.body.appendChild(modal);

      try {
        const event = new KeyboardEvent('keydown', {
          key: 'z',
          ctrlKey: true,
          bubbles: true,
          cancelable: true,
        });
        modalButton.dispatchEvent(event);
        expect(event.defaultPrevented).toBe(false);
      } finally {
        modal.remove();
      }
    });
  });
});
