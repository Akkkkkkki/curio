import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
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

async function renderApp() {
  const { ThemeProvider } = await import('@/theme');
  render(
    <MemoryRouter initialEntries={['/']}>
      <ThemeProvider>
        <LanguageProvider>
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
});
