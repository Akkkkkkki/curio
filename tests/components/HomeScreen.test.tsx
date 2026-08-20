import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderWithProviders, screen, fireEvent, waitFor, within, act } from '../utils/test-utils';
import { setMockTheme } from '../utils/test-utils';
import { HomeScreen } from '@/components/HomeScreen';
import { UserCollection } from '@/types';

// Mock useDebouncedValue to return value immediately for testing
vi.mock('@/hooks/useDebouncedValue', () => ({
  useDebouncedValue: (value: any) => value,
}));

// Route the real useTheme through the test-utils mock state so tests can drive
// theme via setMockTheme('vault' | 'atelier' | 'gallery').
vi.mock('@/theme', async () => {
  const { createThemeMock } = await import('../utils/test-utils');
  return createThemeMock();
});

describe('HomeScreen', () => {
  const mockCollections: UserCollection[] = [
    {
      id: 'col1',
      name: 'Vinyl Records',
      items: [
        {
          id: 'item1',
          title: 'Abbey Road',
          data: {},
          rating: 5,
          notes: '',
          photoUrl: '',
          createdAt: '',
          updatedAt: '',
          collectionId: 'col1',
          userId: 'user1',
        },
      ],
      templateId: 'vinyl',
      icon: '🎵',
      customFields: [],
      isPublic: false,
      ownerId: 'user1',
      updatedAt: '',
      createdAt: '',
    },
    {
      id: 'col2',
      name: 'Stamps',
      items: [],
      templateId: 'general',
      icon: '✉️',
      customFields: [],
      isPublic: false,
      ownerId: 'user1',
      updatedAt: '',
      createdAt: '',
    },
  ];

  const sampleCollection: UserCollection = {
    id: 'sample',
    name: 'Sample Gallery',
    items: [
      {
        id: 'sample-item',
        title: 'Sample Vase',
        data: {},
        rating: 4,
        notes: '',
        photoUrl: '',
        createdAt: '',
        updatedAt: '',
        collectionId: 'sample',
        userId: 'sample-user',
      },
    ],
    templateId: 'general',
    icon: '🏛️',
    customFields: [],
    isPublic: true,
    ownerId: 'sample-user',
    updatedAt: '',
    createdAt: '',
  };

  const defaultProps = {
    collections: mockCollections,
    stats: {
      totalItems: 1,
      totalCollections: 2,
      featured: mockCollections[0].items[0],
      historyItems: [],
      historyMatchType: 'anniversary' as const,
    },
    isLoading: false,
    loadError: null,
    sampleCollection: undefined,
    refreshCollections: vi.fn(),
    handleAddAction: vi.fn(),
    handleCreateCollectionAction: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    setMockTheme('gallery');
  });

  afterEach(() => {
    setMockTheme('gallery');
  });

  it('renders collections', () => {
    renderWithProviders(<HomeScreen {...defaultProps} />);
    // Use getAllByText because the title appears in the h3 and the tooltip
    expect(screen.getAllByText('Vinyl Records')[0]).toBeInTheDocument();
    expect(screen.getAllByText('Stamps')[0]).toBeInTheDocument();
  });

  it('pluralizes the museum subtitle counts (CUR-146)', () => {
    const { unmount } = renderWithProviders(<HomeScreen {...defaultProps} />);
    expect(screen.getByText('2 collections · 1 piece')).toBeInTheDocument();
    unmount();

    renderWithProviders(
      <HomeScreen
        {...defaultProps}
        stats={{ ...defaultProps.stats, totalItems: 2, totalCollections: 1 }}
      />,
    );
    expect(screen.getByText('1 collection · 2 pieces')).toBeInTheDocument();
  });

  it('jumps to the collections grid when the museum stats are activated (CUR-30)', () => {
    const scrollSpy = vi.fn();
    const original = (HTMLElement.prototype as any).scrollIntoView;
    (HTMLElement.prototype as any).scrollIntoView = scrollSpy;
    try {
      renderWithProviders(<HomeScreen {...defaultProps} />);

      const grid = screen.getByTestId('collections-grid');
      // Keyboard users are focused into the grid, so it must keep a visible
      // focus-visible indicator rather than only suppressing the outline.
      expect(grid.className).toMatch(/focus-visible:ring/);
      const focusMock = vi.spyOn(grid, 'focus');

      const statsButton = screen.getByRole('button', { name: /jump to your collections/i });
      // The visible label is still the plain stat line, so it stays legible.
      expect(statsButton).toHaveTextContent('2 collections · 1 piece');

      fireEvent.click(statsButton);

      expect(scrollSpy).toHaveBeenCalledTimes(1);
      expect(focusMock).toHaveBeenCalledTimes(1);
    } finally {
      (HTMLElement.prototype as any).scrollIntoView = original;
    }
  });

  it('filters collections by search term', async () => {
    renderWithProviders(<HomeScreen {...defaultProps} />);

    const searchInput = screen.getByPlaceholderText(/search/i);
    fireEvent.change(searchInput, { target: { value: 'Vinyl' } });

    await waitFor(() => {
      expect(screen.getAllByText('Vinyl Records')[0]).toBeInTheDocument();
      expect(screen.queryByText('Stamps')).not.toBeInTheDocument();
    });
  });

  it('shows no results message when search yields nothing', async () => {
    renderWithProviders(<HomeScreen {...defaultProps} />);

    const searchInput = screen.getByPlaceholderText(/search/i);
    fireEvent.change(searchInput, { target: { value: 'XYZ' } });

    await waitFor(() => {
      expect(screen.getByText(/no matches found/i)).toBeInTheDocument();
      expect(screen.queryByText('Vinyl Records')).not.toBeInTheDocument();
    });
  });

  it('exposes an inline clear button on the search input only when it has a value', async () => {
    renderWithProviders(<HomeScreen {...defaultProps} />);

    expect(screen.queryByRole('button', { name: /clear search/i })).not.toBeInTheDocument();

    const searchInput = screen.getByPlaceholderText(/search/i) as HTMLInputElement;
    fireEvent.change(searchInput, { target: { value: 'Vinyl' } });

    const clearButton = await screen.findByRole('button', { name: /clear search/i });
    fireEvent.click(clearButton);

    await waitFor(() => {
      expect(searchInput.value).toBe('');
      expect(screen.queryByRole('button', { name: /clear search/i })).not.toBeInTheDocument();
      expect(screen.getAllByText('Stamps')[0]).toBeInTheDocument();
    });
  });

  it('offers a Clear search action in the empty-results card', async () => {
    renderWithProviders(<HomeScreen {...defaultProps} />);

    const searchInput = screen.getByPlaceholderText(/search/i) as HTMLInputElement;
    fireEvent.change(searchInput, { target: { value: 'zzzzz' } });

    await waitFor(() => {
      expect(screen.getByText(/no matches found/i)).toBeInTheDocument();
    });

    const clearButtons = screen.getAllByRole('button', { name: /clear search/i });
    fireEvent.click(clearButtons[clearButtons.length - 1]);

    await waitFor(() => {
      expect(searchInput.value).toBe('');
      expect(screen.queryByText(/no matches found/i)).not.toBeInTheDocument();
      expect(screen.getAllByText('Vinyl Records')[0]).toBeInTheDocument();
    });
  });

  it('keeps a create-collection action available on populated Home', () => {
    renderWithProviders(<HomeScreen {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: /start a collection/i }));

    expect(defaultProps.handleCreateCollectionAction).toHaveBeenCalledTimes(1);
  });

  it('renders public collections when App has classified them as editable', () => {
    renderWithProviders(<HomeScreen {...defaultProps} collections={[sampleCollection]} />);

    expect(screen.getByTestId('collections-grid')).toBeInTheDocument();
    expect(screen.getAllByText('Sample Gallery')[0]).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: /start your museum with one thing you love/i }),
    ).not.toBeInTheDocument();
  });

  describe('first-run layout', () => {
    it('shows one primary action and one sample action when no editable collections exist', () => {
      renderWithProviders(
        <HomeScreen {...defaultProps} collections={[]} sampleCollection={sampleCollection} />,
      );

      expect(
        screen.getByRole('heading', { name: /start your museum with one thing you love/i }),
      ).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /add your first piece/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /wander a sample museum/i })).toHaveAttribute(
        'href',
        '#/collection/sample',
      );
      expect(screen.getByText(/no account needed to look around/i)).toBeInTheDocument();
      expect(screen.queryByText(/quick start/i)).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /got it/i })).not.toBeInTheDocument();
      expect(screen.queryByTestId('collections-grid')).not.toBeInTheDocument();
      expect(screen.queryByText('Sample Gallery')).not.toBeInTheDocument();
    });

    it('lays the search bar out in normal flow without a negative top margin', () => {
      const { container } = renderWithProviders(<HomeScreen {...defaultProps} />);

      const searchInput = screen.getByPlaceholderText(/search/i);
      const searchContainer = searchInput.closest('div.relative.max-w-xl') as HTMLElement | null;

      expect(searchContainer).not.toBeNull();
      expect(searchContainer!.className).not.toMatch(/-mt-/);
    });

    it('orders populated Home as header, search, On This Day, then grid', () => {
      const historyItems = [
        {
          id: 'history-item',
          title: 'Remembered ticket',
          data: {},
          rating: 0,
          notes: '',
          photoUrl: '',
          createdAt: new Date(2020, 0, 1).toISOString(),
          updatedAt: '',
          collectionId: 'col1',
          userId: 'user1',
        },
      ];
      renderWithProviders(
        <HomeScreen {...defaultProps} stats={{ ...defaultProps.stats, historyItems }} />,
      );

      const heading = screen.getByRole('heading', { name: /your museum/i });
      const searchInput = screen.getByPlaceholderText(/search/i);
      const onThisDay = screen.getByText(/on this day/i);
      const grid = screen.getByTestId('collections-grid');

      expect(screen.queryByText(/in the spotlight/i)).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /start a collection/i })).toBeInTheDocument();
      expect(heading.compareDocumentPosition(searchInput) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
        Node.DOCUMENT_POSITION_FOLLOWING,
      );
      expect(
        searchInput.compareDocumentPosition(onThisDay) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
      expect(onThisDay.compareDocumentPosition(grid) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
        Node.DOCUMENT_POSITION_FOLLOWING,
      );
    });
  });

  it('shows loading state', () => {
    renderWithProviders(<HomeScreen {...defaultProps} isLoading={true} />);
    expect(screen.getByText('Opening your museum...')).toBeInTheDocument();
  });

  it('shows error state', () => {
    renderWithProviders(<HomeScreen {...defaultProps} loadError="Failed to load" />);
    expect(screen.getByText(/sync paused/i)).toBeInTheDocument();
    expect(screen.getByText('Failed to load')).toBeInTheDocument();
  });

  describe('theme-aware surfaces (CUR-96)', () => {
    const makeHistoryItem = (id: string, title: string, year: number) => ({
      id,
      title,
      data: {},
      rating: 0,
      notes: '',
      photoUrl: '',
      createdAt: new Date(year, 0, 1).toISOString(),
      updatedAt: '',
      collectionId: 'col1',
      userId: 'user1',
    });

    it('renders the "New Archive" inner disc with a Vault-aware surface (not the gallery bg-stone-50)', () => {
      setMockTheme('vault');
      renderWithProviders(<HomeScreen {...defaultProps} />);

      const tile = screen.getByRole('button', { name: /start a collection/i });
      const disc = tile.querySelector('div');

      expect(disc).not.toBeNull();
      expect(disc!.className).not.toMatch(/bg-stone-50/);
      expect(disc!.className).toMatch(/bg-white\/5/);
      expect(disc!.className).not.toMatch(/text-stone-300/);
    });

    it('places the On This Day image on the Vault mat instead of a bg-stone-100 placeholder', () => {
      const historyItems = [makeHistoryItem('h1', 'Remembered ticket', 2020)];
      setMockTheme('vault');
      const { container } = renderWithProviders(
        <HomeScreen {...defaultProps} stats={{ ...defaultProps.stats, historyItems }} />,
      );

      // On This Day image container is the ancestor with aspect-square + rounded-2xl.
      const imageContainer = container.querySelector('div.aspect-square.rounded-2xl');
      expect(imageContainer).not.toBeNull();
      expect(imageContainer!.className).not.toMatch(/bg-stone-100/);
      expect(imageContainer!.className).toMatch(/bg-\[#1C1917\]/);
    });

    it('uses a Vault-legible placeholder on the hero search input', () => {
      setMockTheme('vault');
      renderWithProviders(<HomeScreen {...defaultProps} />);

      const searchInput = screen.getByPlaceholderText(/search/i);
      // Vault should not inherit the Gallery-only stone-300 placeholder token.
      expect(searchInput.className).not.toMatch(/placeholder:text-stone-300/);
      expect(searchInput.className).toMatch(/placeholder:text-stone-400/);
    });
  });

  describe('On This Day', () => {
    const makeHistoryItem = (id: string, title: string, year: number) => ({
      id,
      title,
      data: {},
      rating: 0,
      notes: '',
      photoUrl: '',
      createdAt: new Date(year, 0, 1).toISOString(),
      updatedAt: '',
      collectionId: 'col1',
      userId: 'user1',
    });

    it('hides the "See all" CTA when every memory already fits in the preview', () => {
      const historyItems = [
        makeHistoryItem('h1', 'First memory', 2020),
        makeHistoryItem('h2', 'Second memory', 2021),
        makeHistoryItem('h3', 'Third memory', 2022),
      ];
      const { container } = renderWithProviders(
        <HomeScreen {...defaultProps} stats={{ ...defaultProps.stats, historyItems }} />,
      );

      const list = container.querySelector('#on-this-day-list') as HTMLElement;
      expect(list).toBeTruthy();
      historyItems.forEach((item) => {
        expect(within(list).getByText(item.title)).toBeInTheDocument();
      });
      expect(screen.queryByRole('button', { name: /See all/i })).not.toBeInTheDocument();
      expect(screen.queryByText(/And \d+ more/)).not.toBeInTheDocument();
    });

    it('reveals every memory inline when "See all" is pressed', () => {
      const historyItems = [
        makeHistoryItem('h1', 'First memory', 2018),
        makeHistoryItem('h2', 'Second memory', 2019),
        makeHistoryItem('h3', 'Third memory', 2020),
        makeHistoryItem('h4', 'Fourth memory', 2021),
        makeHistoryItem('h5', 'Fifth memory', 2022),
      ];
      const { container } = renderWithProviders(
        <HomeScreen {...defaultProps} stats={{ ...defaultProps.stats, historyItems }} />,
      );

      const list = () => container.querySelector('#on-this-day-list') as HTMLElement;
      expect(within(list()).getByText('First memory')).toBeInTheDocument();
      expect(within(list()).getByText('Second memory')).toBeInTheDocument();
      expect(within(list()).getByText('Third memory')).toBeInTheDocument();
      expect(within(list()).queryByText('Fourth memory')).not.toBeInTheDocument();
      expect(within(list()).queryByText('Fifth memory')).not.toBeInTheDocument();
      expect(screen.getByText('And 2 more')).toBeInTheDocument();

      const seeAll = screen.getByRole('button', { name: /See all 5 memories/i });
      expect(seeAll).toHaveAttribute('aria-expanded', 'false');
      expect(seeAll).toHaveAttribute('aria-controls', 'on-this-day-list');

      fireEvent.click(seeAll);

      expect(within(list()).getByText('Fourth memory')).toBeInTheDocument();
      expect(within(list()).getByText('Fifth memory')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /See all/i })).not.toBeInTheDocument();
      expect(screen.queryByText(/And \d+ more/)).not.toBeInTheDocument();
    });

    it('shows the anniversary header and year badges for true prior-year matches', () => {
      const historyItems = [makeHistoryItem('h1', 'Remembered ticket', 2020)];
      renderWithProviders(
        <HomeScreen
          {...defaultProps}
          stats={{ ...defaultProps.stats, historyItems, historyMatchType: 'anniversary' }}
        />,
      );

      expect(screen.getByText('On This Day')).toBeInTheDocument();
      expect(screen.getByText('2020')).toBeInTheDocument();
    });

    it('labels prior-week fallback items honestly and hides the year badge (#371)', () => {
      const currentYear = new Date().getFullYear();
      const historyItems = [makeHistoryItem('h1', 'Added last week', currentYear)];
      renderWithProviders(
        <HomeScreen
          {...defaultProps}
          stats={{ ...defaultProps.stats, historyItems, historyMatchType: 'lastWeek' }}
        />,
      );

      expect(screen.getByText('One Week Ago')).toBeInTheDocument();
      expect(screen.queryByText('On This Day')).not.toBeInTheDocument();
      expect(screen.queryByText(String(currentYear))).not.toBeInTheDocument();
    });

    it('labels prior-month fallback items honestly and hides the year badge (#371)', () => {
      const historyItems = [makeHistoryItem('h1', 'Added last month', new Date().getFullYear())];
      renderWithProviders(
        <HomeScreen
          {...defaultProps}
          stats={{ ...defaultProps.stats, historyItems, historyMatchType: 'lastMonth' }}
        />,
      );

      expect(screen.getByText('One Month Ago')).toBeInTheDocument();
      expect(screen.queryByText('On This Day')).not.toBeInTheDocument();
    });
  });

  describe('load error auto-retry (#370)', () => {
    const setOnline = (online: boolean) => {
      Object.defineProperty(window.navigator, 'onLine', {
        value: online,
        configurable: true,
      });
    };

    beforeEach(() => {
      vi.useFakeTimers();
      setOnline(true);
    });

    afterEach(() => {
      vi.useRealTimers();
      setOnline(true);
    });

    it('shows honest copy that never blames "Supabase" and offers a countdown', () => {
      renderWithProviders(
        <HomeScreen
          {...defaultProps}
          loadError={"We couldn't reach your museum. Check your connection — we'll keep trying."}
        />,
      );

      // The user-facing body no longer names the internal backend.
      expect(screen.queryByText(/Supabase/i)).not.toBeInTheDocument();
      expect(
        screen.getByText(
          /We couldn't reach your museum\. Check your connection — we'll keep trying\./,
        ),
      ).toBeInTheDocument();
      // The countdown text is announced politely so the screen doesn't feel dead.
      expect(screen.getByTestId('home-auto-retry-status')).toHaveTextContent(
        /Trying again in \d+s/,
      );
      // The manual button reads as an override, not the only escape.
      expect(screen.getByRole('button', { name: /Retry now/i })).toBeInTheDocument();
    });

    it('auto-retries after the first backoff step without user action', () => {
      const refreshCollections = vi.fn();
      renderWithProviders(
        <HomeScreen
          {...defaultProps}
          loadError="whatever the current copy is"
          refreshCollections={refreshCollections}
        />,
      );

      expect(refreshCollections).not.toHaveBeenCalled();
      expect(screen.getByTestId('home-auto-retry-status')).toHaveTextContent('Trying again in 5s');

      // Countdown ticks visibly then fires the retry at zero.
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(screen.getByTestId('home-auto-retry-status')).toHaveTextContent('Trying again in 4s');
      act(() => {
        vi.advanceTimersByTime(4000);
      });
      expect(refreshCollections).toHaveBeenCalledTimes(1);
    });

    it('pauses the countdown while offline and retries immediately on reconnect', () => {
      setOnline(false);
      const refreshCollections = vi.fn();
      renderWithProviders(
        <HomeScreen
          {...defaultProps}
          loadError="offline"
          refreshCollections={refreshCollections}
        />,
      );

      // No countdown — a wait time we can't honour would be dishonest.
      expect(screen.getByTestId('home-auto-retry-status')).toHaveTextContent(/offline/i);
      act(() => {
        vi.advanceTimersByTime(30000);
      });
      expect(refreshCollections).not.toHaveBeenCalled();

      // Reconnect: the status promises a retry "as soon as you're back", so it
      // fires at once rather than imposing a fresh full backoff.
      setOnline(true);
      act(() => {
        window.dispatchEvent(new Event('online'));
      });
      expect(refreshCollections).toHaveBeenCalledTimes(1);
    });

    it('the manual Retry button short-circuits the wait and only fires once per click', () => {
      const refreshCollections = vi.fn();
      renderWithProviders(
        <HomeScreen
          {...defaultProps}
          loadError="whatever"
          refreshCollections={refreshCollections}
        />,
      );

      fireEvent.click(screen.getByRole('button', { name: /Retry now/i }));
      expect(refreshCollections).toHaveBeenCalledTimes(1);

      // The pending countdown was cancelled — advancing past its window must
      // not stack a second automatic call on top of the manual one.
      act(() => {
        vi.advanceTimersByTime(6000);
      });
      expect(refreshCollections).toHaveBeenCalledTimes(1);
    });

    it('preserves the backoff step across the transient error-clear of an in-flight retry (#420 review)', () => {
      // App.refreshCollections clears loadError (isLoading=true) before awaiting
      // the request, then restores it on failure. The schedule must advance
      // (5s → 15s) across that flicker rather than reset to the first step, or a
      // persistent outage would retry every 5s forever.
      const refreshCollections = vi.fn();
      const { rerender } = renderWithProviders(
        <HomeScreen {...defaultProps} loadError="err" refreshCollections={refreshCollections} />,
      );
      expect(screen.getByTestId('home-auto-retry-status')).toHaveTextContent('Trying again in 5s');

      act(() => {
        vi.advanceTimersByTime(5000);
      });
      expect(refreshCollections).toHaveBeenCalledTimes(1);

      // In-flight retry: error cleared, loading spinner shown.
      rerender(
        <HomeScreen
          {...defaultProps}
          loadError={null}
          isLoading={true}
          refreshCollections={refreshCollections}
        />,
      );
      // Retry failed: error restored.
      rerender(
        <HomeScreen {...defaultProps} loadError="err" refreshCollections={refreshCollections} />,
      );

      // Advanced to the second step, not reset to the first.
      expect(screen.getByTestId('home-auto-retry-status')).toHaveTextContent('Trying again in 15s');
      act(() => {
        vi.advanceTimersByTime(15000);
      });
      expect(refreshCollections).toHaveBeenCalledTimes(2);
    });

    it('resets the backoff schedule only after a settled recovery', () => {
      const refreshCollections = vi.fn();
      const { rerender } = renderWithProviders(
        <HomeScreen {...defaultProps} loadError="err" refreshCollections={refreshCollections} />,
      );

      // Burn the first step.
      act(() => {
        vi.advanceTimersByTime(5000);
      });
      expect(refreshCollections).toHaveBeenCalledTimes(1);

      // A genuine recovery: no error, not loading.
      rerender(
        <HomeScreen
          {...defaultProps}
          loadError={null}
          isLoading={false}
          refreshCollections={refreshCollections}
        />,
      );
      // A brand-new outage starts fresh at 5s.
      rerender(
        <HomeScreen {...defaultProps} loadError="err" refreshCollections={refreshCollections} />,
      );
      expect(screen.getByTestId('home-auto-retry-status')).toHaveTextContent('Trying again in 5s');
    });

    it('stops auto-retrying after the backoff schedule is exhausted', () => {
      const refreshCollections = vi.fn();
      renderWithProviders(
        <HomeScreen {...defaultProps} loadError="err" refreshCollections={refreshCollections} />,
      );

      // Schedule is [5s, 15s, 30s] — three passes total, error never clears.
      act(() => {
        vi.advanceTimersByTime(5000);
      });
      act(() => {
        vi.advanceTimersByTime(15000);
      });
      act(() => {
        vi.advanceTimersByTime(30000);
      });
      expect(refreshCollections).toHaveBeenCalledTimes(3);

      // Countdown is gone; the manual button is the only remaining path.
      expect(screen.queryByTestId('home-auto-retry-status')).not.toBeInTheDocument();
      act(() => {
        vi.advanceTimersByTime(60000);
      });
      expect(refreshCollections).toHaveBeenCalledTimes(3);
    });

    it('makes no reconnect promise once the schedule is exhausted, even offline (#420 review)', () => {
      const refreshCollections = vi.fn();
      const { rerender } = renderWithProviders(
        <HomeScreen {...defaultProps} loadError="err" refreshCollections={refreshCollections} />,
      );

      // Exhaust all three automatic attempts (error never clears).
      act(() => {
        vi.advanceTimersByTime(5000);
      });
      act(() => {
        vi.advanceTimersByTime(15000);
      });
      act(() => {
        vi.advanceTimersByTime(30000);
      });
      expect(refreshCollections).toHaveBeenCalledTimes(3);

      // Now go offline: the status must NOT promise a reconnect retry it can't keep.
      setOnline(false);
      act(() => {
        window.dispatchEvent(new Event('offline'));
      });
      expect(screen.queryByTestId('home-auto-retry-status')).not.toBeInTheDocument();

      // Reconnecting fires nothing automatic — the manual button is the only path.
      setOnline(true);
      act(() => {
        window.dispatchEvent(new Event('online'));
      });
      expect(refreshCollections).toHaveBeenCalledTimes(3);
      rerender(
        <HomeScreen {...defaultProps} loadError="err" refreshCollections={refreshCollections} />,
      );
      expect(screen.getByRole('button', { name: /Retry now/i })).toBeInTheDocument();
    });
  });
});
