import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import type { UserCollection } from '@/types';
import { AppContent } from '@/App';
import { LanguageProvider } from '@/i18n';
import * as db from '@/services/db';
import * as supabaseService from '@/services/supabase';

// Keep the header lightweight so the load-state surfaces are the only thing
// under test.
vi.mock('@/components/Layout', async () => {
  const React = await import('react');
  return {
    Layout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  };
});

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
      getSession: vi.fn().mockResolvedValue({
        data: { session: { user: { id: 'user1', email: 'collector@example.com' } } },
      }),
      onAuthStateChange: vi
        .fn()
        .mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({ data: { is_admin: false }, error: null }),
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

vi.mock('@/theme', async () => {
  const React = await import('react');
  const actual = await vi.importActual<typeof import('@/theme')>('@/theme');

  const ThemeContext = React.createContext({
    theme: 'gallery',
    setTheme: () => {},
  });

  const ThemeProvider = ({ children }: { children: React.ReactNode }) => (
    <ThemeContext.Provider value={{ theme: 'gallery', setTheme: () => {} }}>
      {children}
    </ThemeContext.Provider>
  );

  return {
    ...actual,
    ThemeProvider,
    useTheme: () => React.useContext(ThemeContext),
  };
});

function TestNavigator() {
  const navigate = useNavigate();
  return (
    <div>
      <button type="button" data-testid="nav-home" onClick={() => navigate('/')}>
        home
      </button>
      <button type="button" data-testid="nav-explore" onClick={() => navigate('/explore')}>
        explore
      </button>
    </div>
  );
}

async function renderApp(initialPath = '/') {
  const { ThemeProvider } = await import('@/theme');
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <ThemeProvider>
        <LanguageProvider>
          <TestNavigator />
          <AppContent />
        </LanguageProvider>
      </ThemeProvider>
    </MemoryRouter>,
  );
}

describe('App sync-paused surface (#499)', () => {
  const cachedCollection: UserCollection = {
    id: 'private-col',
    name: 'Cached Collection',
    templateId: 'custom',
    icon: 'C',
    customFields: [],
    items: [],
    isPublic: false,
    updatedAt: new Date('2026-06-01T00:00:00.000Z').toISOString(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(supabaseService.isSupabaseConfigured).mockReturnValue(true);
    vi.mocked(supabaseService.supabase!.auth.getSession).mockResolvedValue({
      data: { session: { user: { id: 'user1', email: 'collector@example.com' } } },
    } as never);
    vi.mocked(db.mergeCollections).mockImplementation((local, cloud) =>
      cloud.length ? cloud : local,
    );
    vi.mocked(db.getPendingSyncIds).mockResolvedValue([]);
    vi.mocked(db.getPendingDeletes).mockResolvedValue([]);
    vi.mocked(db.hasLocalOnlyData).mockReturnValue(false);
    vi.mocked(db.getPendingAssetUploadSummary).mockResolvedValue({ total: 0, stalled: 0 });
    vi.mocked(db.syncPendingChanges).mockResolvedValue(0);
    vi.mocked(db.syncPendingAssetUploads).mockResolvedValue(0);
    vi.mocked(db.syncPendingDeletes).mockResolvedValue(0);
    vi.mocked(db.requestPersistence).mockResolvedValue(true);
    vi.mocked(db.saveAllCollections).mockResolvedValue(undefined);
    vi.mocked(db.initDB).mockResolvedValue({} as never);
  });

  it('signed-in with no cache + cloud fetch failure shows the full-screen card without a duplicate toast', async () => {
    vi.mocked(db.getLocalCollections).mockResolvedValue([]);
    vi.mocked(db.fetchCloudCollections).mockRejectedValue(new Error('Network down'));

    await renderApp();

    // The full-screen "Sync paused" card renders (heading + Retry now).
    await screen.findByRole('heading', { name: 'Sync paused' });
    expect(screen.getByRole('button', { name: 'Retry now' })).toBeInTheDocument();

    // The redundant global toast for the same failure is suppressed (#499).
    expect(screen.queryByTestId('status-toast-message')).toBeNull();
  });

  it('signed-in with cache + cloud fetch failure shows cached data and the toast (no full-screen card)', async () => {
    vi.mocked(db.getLocalCollections).mockResolvedValue([cachedCollection]);
    vi.mocked(db.fetchCloudCollections).mockRejectedValue(new Error('Network down'));

    await renderApp();

    // Cached collections render; the toast is the only sync-paused signal.
    await screen.findByRole('heading', { name: 'Cached Collection' });
    await waitFor(() => {
      expect(screen.getByTestId('status-toast-message')).toHaveTextContent('Sync paused');
    });
    // No full-screen error card in this path.
    expect(screen.queryByRole('button', { name: 'Retry now' })).toBeNull();
  });

  it('signed-in on a non-Home route with no cache + cloud fetch failure still shows the toast (no card mounts)', async () => {
    // The full-screen loadError card only renders inside HomeScreen ("/"). On
    // routes like /explore it never mounts, so the toast must remain the error
    // surface rather than being suppressed (#499 review follow-up).
    vi.mocked(db.getLocalCollections).mockResolvedValue([]);
    vi.mocked(db.fetchCloudCollections).mockRejectedValue(new Error('Network down'));

    await renderApp('/explore');

    await waitFor(() => {
      expect(screen.getByTestId('status-toast-message')).toHaveTextContent('Sync paused');
    });
    // The Home error card is not mounted on this route.
    expect(screen.queryByRole('button', { name: 'Retry now' })).toBeNull();
  });

  it('reconciles the surface across navigation: leaving Home after a failure re-surfaces the toast', async () => {
    // Regression for the snapshot-at-failure-time gap: a no-cache failure on
    // "/" shows the card (no toast), but navigating away unmounts the card, so
    // the failure must re-surface as a toast rather than vanish (#499 review).
    const user = userEvent.setup();
    vi.mocked(db.getLocalCollections).mockResolvedValue([]);
    vi.mocked(db.fetchCloudCollections).mockRejectedValue(new Error('Network down'));

    await renderApp('/');

    // Home: card shown, no toast.
    await screen.findByRole('heading', { name: 'Sync paused' });
    expect(screen.queryByTestId('status-toast-message')).toBeNull();

    // Navigate away from Home: the card unmounts, so the toast takes over.
    await user.click(screen.getByTestId('nav-explore'));
    await waitFor(() => {
      expect(screen.getByTestId('status-toast-message')).toHaveTextContent('Sync paused');
    });
    expect(screen.queryByRole('heading', { name: 'Sync paused' })).toBeNull();
  });

  it('reconciles the surface across navigation: returning to Home drops the duplicate toast', async () => {
    // The converse gap: a failure on a non-Home route shows the toast; arriving
    // on Home (where the card renders) must clear the toast so they never stack.
    const user = userEvent.setup();
    vi.mocked(db.getLocalCollections).mockResolvedValue([]);
    vi.mocked(db.fetchCloudCollections).mockRejectedValue(new Error('Network down'));

    await renderApp('/explore');

    // Non-Home: toast shown, no card.
    await waitFor(() => {
      expect(screen.getByTestId('status-toast-message')).toHaveTextContent('Sync paused');
    });

    // Navigate Home: the card takes over and the duplicate toast is cleared.
    await user.click(screen.getByTestId('nav-home'));
    await screen.findByRole('heading', { name: 'Sync paused' });
    await waitFor(() => {
      expect(screen.queryByTestId('status-toast-message')).toBeNull();
    });
  });

  it('signed-out on the access-gated Home still shows the toast (the card is replaced by the gate)', async () => {
    // On "/" the welcome gate can stand in for HomeScreen (signed out, no public
    // browse), so the error card never mounts. A load failure must therefore
    // surface as a toast rather than be cleared on pathname alone (#499 review).
    vi.mocked(supabaseService.supabase!.auth.getSession).mockResolvedValue({
      data: { session: null },
    } as never);
    vi.mocked(db.getLocalCollections).mockResolvedValue([]);
    vi.mocked(db.fetchCloudCollections).mockResolvedValue([]);
    // Force the post-fetch initialization block to throw with no cache to fall
    // back on, which sets loadError for the signed-out user.
    vi.mocked(db.getPendingDeletes).mockRejectedValue(new Error('IndexedDB read failed'));

    await renderApp('/');

    await waitFor(() => {
      expect(screen.getByTestId('status-toast-message')).toHaveTextContent('Sync paused');
    });
    // The full-screen error card is not mounted — the gate stands in for it.
    expect(screen.queryByRole('button', { name: 'Retry now' })).toBeNull();
  });
});
