import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppContent } from '@/App';
import { LanguageProvider } from '@/i18n';
import * as db from '@/services/db';
import * as supabaseService from '@/services/supabase';
import type { RecoveryEvent } from '@/services/db';

// Keep the header lightweight; only the recovery toast is under test.
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
  setRecoveryCallback: vi.fn(),
  setSyncStatusCallback: vi.fn(),
  syncPendingChanges: vi.fn(),
  syncPendingAssetUploads: vi.fn(),
  syncPendingDeletes: vi.fn(),
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
  const ThemeContext = React.createContext({ theme: 'gallery', setTheme: () => {} });
  const ThemeProvider = ({ children }: { children: React.ReactNode }) => (
    <ThemeContext.Provider value={{ theme: 'gallery', setTheme: () => {} }}>
      {children}
    </ThemeContext.Provider>
  );
  return { ...actual, ThemeProvider, useTheme: () => React.useContext(ThemeContext) };
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

async function getRecoveryHandler(): Promise<(event: RecoveryEvent) => void> {
  await waitFor(() => {
    expect(vi.mocked(db.setRecoveryCallback).mock.calls.length).toBeGreaterThan(0);
  });
  const handler = vi
    .mocked(db.setRecoveryCallback)
    .mock.calls.map((call) => call[0])
    .filter((cb): cb is (event: RecoveryEvent) => void => typeof cb === 'function')
    .at(-1);
  if (!handler) throw new Error('recovery callback was never registered');
  return handler;
}

// Before the collection loader was consolidated onto App.tsx, setRecoveryCallback
// was registered only by the unused useCollections hook, so db.ts recovery events
// were emitted with no live listener and the user was never told their local
// cache had been reset. App.tsx now owns the wiring (#504).
describe('App IndexedDB recovery notices (#504)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    try {
      localStorage.clear();
    } catch {
      // ignore — not all environments expose localStorage
    }
    vi.mocked(supabaseService.isSupabaseConfigured).mockReturnValue(true);
    vi.mocked(db.getLocalCollections).mockResolvedValue([]);
    vi.mocked(db.fetchCloudCollections).mockResolvedValue([]);
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

  it('registers a recovery callback and surfaces a warning toast when the cache is reset', async () => {
    await renderApp();
    const handleRecovery = await getRecoveryHandler();

    act(() => handleRecovery({ type: 'corruption_detected', lostData: true }));

    await waitFor(() => {
      expect(screen.getByTestId('status-toast-message')).toHaveTextContent(
        'Local cache was corrupted and has been reset. Your cloud data will reload.',
      );
    });
  });

  it('surfaces a confirmation toast when the cache is restored', async () => {
    await renderApp();
    const handleRecovery = await getRecoveryHandler();

    act(() => handleRecovery({ type: 'recovery_complete', lostData: true }));

    await waitFor(() => {
      expect(screen.getByTestId('status-toast-message')).toHaveTextContent(
        'Local cache restored from cloud.',
      );
    });
  });

  it('surfaces an error toast when recovery fails', async () => {
    await renderApp();
    const handleRecovery = await getRecoveryHandler();

    act(() => handleRecovery({ type: 'recovery_failed', lostData: true }));

    await waitFor(() => {
      expect(screen.getByTestId('status-toast-message')).toHaveTextContent(
        'Local cache recovery failed. Some data may be unavailable.',
      );
    });
  });
});
