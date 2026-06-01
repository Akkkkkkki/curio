import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
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

  const MockThemeProvider = ({ children }: { children: React.ReactNode }) => {
    const [theme, setTheme] = React.useState('gallery');
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

    // Wait for collections to load
    await waitFor(() => {
      expect(screen.getByText('Test Collection')).toBeInTheDocument();
    });

    // Check if items are rendered (lazy-loaded screen may render items on a later tick)
    await waitFor(() => {
      expect(screen.getAllByText('Test Item')[0]).toBeInTheDocument();
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

    // Gate explains what Curio is before asking for sign-in (CUR-63)
    expect(screen.getByText('Welcome to Curio')).toBeInTheDocument();
    expect(screen.getByText(/personal museum/i)).toBeInTheDocument();

    // Both first-run CTAs remain available
    expect(screen.getByTestId('cta-primary-add-first')).toBeInTheDocument();
    expect(screen.getByTestId('cta-secondary-explore-sample')).toBeInTheDocument();
  });
});
