import type { ComponentProps } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import { LanguageProvider } from '@/i18n';
import { ThemeProvider } from '@/theme';
import { CollectionScreen } from '@/components/CollectionScreen';
import { UserCollection } from '@/types';

// Mock the debounce so search state settles synchronously in tests.
vi.mock('@/hooks/useDebouncedValue', () => ({
  useDebouncedValue: (value: unknown) => value,
}));

function makeCollection(overrides: Partial<UserCollection> = {}): UserCollection {
  return {
    id: 'col1',
    name: 'Supplements',
    items: [],
    templateId: 'general',
    icon: '💊',
    customFields: [],
    isPublic: false,
    ownerId: 'user1',
    updatedAt: '',
    createdAt: '',
    ...overrides,
  };
}

function makeItem(id: string) {
  return {
    id,
    title: `Item ${id}`,
    data: {},
    rating: 0,
    notes: '',
    photoUrl: '',
    createdAt: '',
    updatedAt: '',
    collectionId: 'col1',
    userId: 'user1',
  };
}

function renderScreen(
  collection: UserCollection,
  overrides: Partial<ComponentProps<typeof CollectionScreen>> = {},
) {
  const props = {
    collections: [collection],
    isAdmin: false,
    isLoading: false,
    isAuthenticated: true,
    isSupabaseReady: true,
    sampleCollectionId: undefined,
    openAuthModal: vi.fn(),
    openAddItemModal: vi.fn(),
    deleteItem: vi.fn(() => true),
    removeCollection: vi.fn(async () => {}),
    showStatus: vi.fn(),
    ...overrides,
  };
  return render(
    <MemoryRouter initialEntries={[`/collection/${collection.id}`]}>
      <LanguageProvider>
        <ThemeProvider>
          <Routes>
            <Route path="/collection/:id" element={<CollectionScreen {...props} />} />
            <Route path="/" element={<div>home</div>} />
          </Routes>
        </ThemeProvider>
      </LanguageProvider>
    </MemoryRouter>,
  );
}

describe('CollectionScreen action bar (CUR-160)', () => {
  it('hides Exhibition/Select/Sort/Search/Filter on an empty collection', () => {
    renderScreen(makeCollection({ items: [] }));

    // Add Item stays — it is the empty collection's single primary action.
    expect(screen.getByRole('button', { name: /add item/i })).toBeInTheDocument();
    // Delete Collection stays so an empty collection can still be removed.
    expect(screen.getByRole('button', { name: /delete collection/i })).toBeInTheDocument();

    // Item-oriented controls have nothing to act on and are not rendered.
    expect(screen.queryByRole('button', { name: /enter exhibition/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^select$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: /sort items/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /filter collection/i })).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/search this collection/i)).not.toBeInTheDocument();
  });

  it('keeps every control available once the collection has items', () => {
    renderScreen(makeCollection({ items: [makeItem('a'), makeItem('b')] }));

    expect(screen.getByRole('button', { name: /add item/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /enter exhibition/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^select$/i })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /sort items/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /filter collection/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/search this collection/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /delete collection/i })).toBeInTheDocument();
  });
});

describe('CollectionScreen read-only notice consolidation (#411)', () => {
  it('shows a single read-only notice with a sign-in next step when signed out', () => {
    renderScreen(makeCollection({ isPublic: true, items: [makeItem('a')] }), {
      isAuthenticated: false,
    });

    // One consolidated notice: the boxed banner, carrying both the read-only
    // explanation and the actionable sign-in hint.
    const banner = screen.getByTestId('read-only-banner');
    expect(banner).toHaveTextContent(/can be viewed but not edited/i);
    expect(banner).toHaveTextContent(/sign in to duplicate or edit/i);

    // The old redundant amber line must be gone (no second notice).
    expect(screen.queryByText(/public samples are read-only/i)).not.toBeInTheDocument();
    expect(screen.getAllByTestId('read-only-banner')).toHaveLength(1);
  });

  it('omits the sign-in hint for an already signed-in non-admin viewer', () => {
    renderScreen(makeCollection({ isPublic: true, items: [makeItem('a')] }), {
      isAuthenticated: true,
    });

    const banner = screen.getByTestId('read-only-banner');
    expect(banner).toHaveTextContent(/can be viewed but not edited/i);
    // Telling a signed-in user to "sign in" would be inaccurate, so the hint
    // is withheld — but the collection is still clearly labelled read-only.
    expect(banner).not.toHaveTextContent(/sign in to duplicate or edit/i);
  });

  it('shows no read-only notice on an editable own collection', () => {
    renderScreen(makeCollection({ isPublic: false, items: [makeItem('a')] }));

    expect(screen.queryByTestId('read-only-banner')).not.toBeInTheDocument();
    expect(screen.queryByText(/sign in to duplicate or edit/i)).not.toBeInTheDocument();
  });
});
