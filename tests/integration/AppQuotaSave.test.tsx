import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import type { CollectionItem, UserCollection } from '@/types';
import { AppContent } from '@/App';
import { LanguageProvider } from '@/i18n';
import * as db from '@/services/db';
import * as supabaseService from '@/services/supabase';
import * as imageProcessor from '@/services/imageProcessor';

// CUR-38: when the device disk is full, the IndexedDB write inside saveAsset
// rejects with a QuotaExceededError. Adding an item with a photo must then show
// an honest "free up space" message — not the generic "please try again", which
// implies a transient failure that a retry would clear.

vi.mock('@/components/Layout', async () => {
  const React = await import('react');

  return {
    Layout: ({ children, onAddItem }: { children: React.ReactNode; onAddItem?: () => void }) => (
      <div>
        <button type="button" data-testid="mock-layout-add-item" onClick={onAddItem}>
          Add Item
        </button>
        {children}
      </div>
    ),
  };
});

vi.mock('@/components/AddItemModal', async () => {
  const React = await import('react');
  type AddItemPayload = Omit<CollectionItem, 'id' | 'createdAt' | 'updatedAt'>;

  return {
    AddItemModal: ({
      isOpen,
      onSave,
    }: {
      isOpen: boolean;
      onSave: (collectionId: string, item: AddItemPayload) => Promise<void>;
    }) => {
      const [error, setError] = React.useState<string | null>(null);
      if (!isOpen) return null;

      const attemptPhotoSave = async () => {
        try {
          await onSave('private-col', {
            collectionId: 'private-col',
            photoUrl: 'data:image/jpeg;base64,AAAA',
            title: 'A photographed piece',
            rating: 0,
            data: {},
            notes: '',
          });
        } catch (err) {
          setError(err instanceof Error ? err.message : String(err));
        }
      };

      return (
        <div role="dialog" aria-label="Mock add item modal">
          <button type="button" onClick={attemptPhotoSave}>
            Attempt photo save
          </button>
          {error && <p data-testid="mock-add-error">{error}</p>}
        </div>
      );
    },
  };
});

vi.mock('@/services/db', async () => {
  // Faithful re-implementation of the real predicate so the App branch is
  // exercised end to end; everything else is a stub.
  const isQuotaExceededError = (error: unknown): boolean => {
    if (!error || typeof error !== 'object') return false;
    const err = error as { name?: string; code?: number };
    return (
      err.name === 'QuotaExceededError' ||
      err.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
      err.code === 22 ||
      err.code === 1014
    );
  };
  return {
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
    isQuotaExceededError,
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
  };
});

vi.mock('@/services/imageProcessor', () => ({
  processImage: vi.fn(),
}));

vi.mock('@/services/analytics', () => ({
  trackEvent: vi.fn(),
  storyLengthBucket: vi.fn(() => 'none'),
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

describe('App quota-exhaustion save handling', () => {
  const editableCollection: UserCollection = {
    id: 'private-col',
    name: 'Editable Collection',
    templateId: 'custom',
    icon: 'E',
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
    vi.mocked(db.getLocalCollections).mockResolvedValue([editableCollection]);
    vi.mocked(db.fetchCloudCollections).mockResolvedValue([]);
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
    vi.mocked(db.saveCollection).mockResolvedValue(undefined);
    vi.mocked(db.initDB).mockResolvedValue({} as never);
    vi.mocked(imageProcessor.processImage).mockResolvedValue({
      original: new Blob(['orig'], { type: 'image/jpeg' }),
      display: new Blob(['disp'], { type: 'image/jpeg' }),
    } as never);
    // The device disk is full: the IndexedDB blob write rejects.
    vi.mocked(db.saveAsset).mockRejectedValue(new DOMException('full', 'QuotaExceededError'));
  });

  it('surfaces an honest storage-full message when saving a photo hits the quota', async () => {
    const user = userEvent.setup();
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

    await screen.findByRole('heading', { name: 'Editable Collection' });

    await user.click(screen.getByTestId('mock-layout-add-item'));
    await user.click(await screen.findByRole('button', { name: 'Attempt photo save' }));

    const storageFullMessage =
      'Your device storage is full, so this photo could not be saved. Remove some items or free up space, then try again.';

    expect(await screen.findByTestId('mock-add-error')).toHaveTextContent(storageFullMessage);
    expect(await screen.findByTestId('status-toast-message')).toHaveTextContent(storageFullMessage);
    // The generic, retry-implying copy must not be what the user sees.
    expect(screen.queryByText('Could not save image. Please try again.')).toBeNull();
  });
});
