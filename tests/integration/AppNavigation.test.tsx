import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppContent } from '@/App';
import { LanguageProvider } from '@/i18n';
import React, { act } from 'react';
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
    expect(await screen.findByTestId('collection-screen-skeleton')).toBeInTheDocument();
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

    expect(await screen.findByTestId('item-detail-skeleton')).toBeInTheDocument();
    expect(screen.queryByTestId('collections-grid')).not.toBeInTheDocument();

    resolveCloud([mockCollection]);
    // Once data lands, the item detail textarea (Title) replaces the skeleton.
    expect(await screen.findByRole('textbox', { name: 'Title' })).toBeInTheDocument();
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
    expect(await screen.findByTestId('item-detail-skeleton')).toBeInTheDocument();
    expect(screen.queryByTestId('items-grid')).not.toBeInTheDocument();

    // Cloud lands with the item attached — detail renders.
    resolveCloud([mockCollection]);
    expect(await screen.findByRole('textbox', { name: 'Title' })).toBeInTheDocument();
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
});
