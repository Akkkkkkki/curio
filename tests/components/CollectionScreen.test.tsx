import type { ComponentProps } from 'react';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { LanguageProvider } from '@/i18n';
import { ThemeProvider } from '@/theme';
import { CollectionScreen } from '@/components/CollectionScreen';
import { UserCollection } from '@/types';
import { setMockTheme } from '../utils/test-utils';

// Route the component's useTheme through the configurable mock so read-only
// banner styling can be asserted per theme (CUR-94). Real class maps are kept
// via `...actual`; only the active theme is overridden. Defaults to Gallery, so
// every existing test in this suite is unaffected.
vi.mock('@/theme', async () => {
  const { createThemeMock } = await import('../utils/test-utils');
  return createThemeMock();
});

// Mock the debounce so search state settles synchronously in tests.
vi.mock('@/hooks/useDebouncedValue', () => ({
  useDebouncedValue: (value: unknown) => value,
}));

// ItemCard has its own rendering suite. Keep the 500-item pagination fixture
// focused on how many cards CollectionScreen mounts rather than image loading.
vi.mock('@/components/ItemCard', () => ({
  ItemCard: ({ item }: { item: { id: string; title: string } }) => (
    <div data-testid="item-card" data-item-id={item.id}>
      {item.title}
    </div>
  ),
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

  it('gives the icon-only Back link an accessible name and hides the decorative icon', () => {
    renderScreen(makeCollection({ items: [makeItem('a')] }));

    const backLink = screen.getByRole('link', { name: /^back$/i });
    expect(backLink).toHaveAttribute('href', '/');
    expect(backLink).toHaveAttribute('title', 'Back');
    expect(backLink.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });
});

describe('CollectionScreen large collections (CUR-19)', () => {
  it('renders collections of 100 items without pagination', () => {
    const items = Array.from({ length: 100 }, (_, index) => makeItem(String(index)));

    renderScreen(makeCollection({ items }));

    expect(screen.getAllByTestId('item-card')).toHaveLength(100);
    expect(screen.queryByRole('button', { name: /load more/i })).not.toBeInTheDocument();
  });

  it('bounds initial DOM work and exposes every item in a 500-item collection', () => {
    const items = Array.from({ length: 500 }, (_, index) => makeItem(String(index)));

    renderScreen(makeCollection({ items }));

    expect(screen.getAllByTestId('item-card')).toHaveLength(50);
    expect(screen.getByText('Showing 50 of 500 items')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /load more/i }));
    expect(screen.getAllByTestId('item-card')).toHaveLength(100);
    expect(screen.getByText('Showing 100 of 500 items')).toBeInTheDocument();

    for (let page = 0; page < 8; page += 1) {
      fireEvent.click(screen.getByRole('button', { name: /load more/i }));
    }

    expect(screen.getAllByTestId('item-card')).toHaveLength(500);
    expect(screen.getByText('Showing 500 of 500 items')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /all items loaded/i })).toBeDisabled();
  });
});

describe('CollectionScreen read-only notice consolidation (#411)', () => {
  it('shows a single read-only notice with an inviting sign-up next step when signed out', () => {
    const openAuthModal = vi.fn();
    renderScreen(makeCollection({ isPublic: true, items: [makeItem('a')] }), {
      isAuthenticated: false,
      openAuthModal,
    });

    // One consolidated notice: the boxed banner, carrying the read-only
    // explanation and an inline, clickable "start your own museum" control.
    const banner = screen.getByTestId('read-only-banner');
    expect(banner).toHaveTextContent(/can be viewed but not edited/i);

    const cta = screen.getByTestId('read-only-start-museum');
    expect(banner).toContainElement(cta);
    expect(cta).toHaveTextContent(/start your own museum/i);

    // The CTA opens the existing auth modal in sign-up mode (#520).
    fireEvent.click(cta);
    expect(openAuthModal).toHaveBeenCalledWith('signup');

    // The old redundant amber line must be gone (no second notice).
    expect(screen.queryByText(/public samples are read-only/i)).not.toBeInTheDocument();
    expect(screen.getAllByTestId('read-only-banner')).toHaveLength(1);
  });

  it('omits the sign-up CTA for an already signed-in non-admin viewer', () => {
    renderScreen(makeCollection({ isPublic: true, items: [makeItem('a')] }), {
      isAuthenticated: true,
    });

    const banner = screen.getByTestId('read-only-banner');
    expect(banner).toHaveTextContent(/can be viewed but not edited/i);
    // Inviting an already-signed-in user to "start your own museum" by signing
    // up would be inaccurate, so the CTA is withheld — the collection is still
    // clearly labelled read-only.
    expect(screen.queryByTestId('read-only-start-museum')).not.toBeInTheDocument();
  });

  it('shows no read-only notice on an editable own collection', () => {
    renderScreen(makeCollection({ isPublic: false, items: [makeItem('a')] }));

    expect(screen.queryByTestId('read-only-banner')).not.toBeInTheDocument();
    expect(screen.queryByTestId('read-only-start-museum')).not.toBeInTheDocument();
  });
});

describe('CollectionScreen read-only banner theming (CUR-94)', () => {
  afterEach(() => setMockTheme('gallery'));

  // The lock tile is the element wrapping the Lock icon inside the banner.
  const lockTile = () =>
    screen.getByTestId('read-only-banner').querySelector('svg')?.parentElement as HTMLElement;

  it('gives the Vault lock tile a theme-aware amber accent, not raw Gallery amber', () => {
    setMockTheme('vault');
    renderScreen(makeCollection({ isPublic: true, items: [makeItem('a')] }), {
      isAuthenticated: false,
    });

    const tile = lockTile();
    // bg-amber-50 punched a bright square through the dark Vault surface.
    // classList matches exact tokens (bg-amber-500/20 must not count as bg-amber-50).
    expect(tile.classList.contains('bg-amber-50')).toBe(false);
    expect(tile.classList.contains('bg-amber-500/20')).toBe(true);
  });

  it('leaves the Gallery lock tile unchanged', () => {
    setMockTheme('gallery');
    renderScreen(makeCollection({ isPublic: true, items: [makeItem('a')] }), {
      isAuthenticated: false,
    });

    const tile = lockTile();
    expect(tile.classList.contains('bg-amber-50')).toBe(true);
    expect(tile.classList.contains('text-amber-700')).toBe(true);
  });
});

describe('CollectionScreen SAMPLE badge theming', () => {
  afterEach(() => setMockTheme('gallery'));

  const sampleBadge = () => screen.getByTestId('sample-badge');

  it('gives the Vault SAMPLE chip a readable light-on-dark treatment, not hardcoded Gallery colors', () => {
    setMockTheme('vault');
    renderScreen(makeCollection({ isPublic: true, items: [makeItem('a')] }), {
      isAuthenticated: false,
    });

    const badge = sampleBadge();
    // The chip used to hardcode bg-white/40 + text-stone-500, which vanishes on
    // the near-black Vault surface. In Vault it must use readable light text.
    expect(badge.classList.contains('text-stone-500')).toBe(false);
    expect(badge.classList.contains('text-white/80')).toBe(true);
    expect(badge.classList.contains('bg-white/10')).toBe(true);
  });

  it('leaves the Gallery SAMPLE chip styling unchanged', () => {
    setMockTheme('gallery');
    renderScreen(makeCollection({ isPublic: true, items: [makeItem('a')] }), {
      isAuthenticated: false,
    });

    const badge = sampleBadge();
    expect(badge.classList.contains('bg-white/40')).toBe(true);
    expect(badge.classList.contains('text-stone-500')).toBe(true);
  });
});
