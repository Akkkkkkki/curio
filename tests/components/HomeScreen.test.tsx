import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, fireEvent, waitFor, within } from '../utils/test-utils';
import { HomeScreen } from '@/components/HomeScreen';
import { UserCollection } from '@/types';

// Mock useDebouncedValue to return value immediately for testing
vi.mock('@/hooks/useDebouncedValue', () => ({
  useDebouncedValue: (value: any) => value,
}));

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

  const defaultProps = {
    collections: mockCollections,
    stats: {
      totalItems: 1,
      totalCollections: 2,
      featured: mockCollections[0].items[0],
      historyItems: [],
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
  });

  it('renders collections', () => {
    renderWithProviders(<HomeScreen {...defaultProps} />);
    // Use getAllByText because the title appears in the h3 and the tooltip
    expect(screen.getAllByText('Vinyl Records')[0]).toBeInTheDocument();
    expect(screen.getAllByText('Stamps')[0]).toBeInTheDocument();
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

  describe('first-run layout', () => {
    it('shows only the Add-first CTA when no editable collections exist (no stacked onboarding checklist)', () => {
      renderWithProviders(<HomeScreen {...defaultProps} collections={[]} />);

      expect(screen.getByText(/add your first/i)).toBeInTheDocument();
      expect(screen.queryByText(/quick start/i)).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /got it/i })).not.toBeInTheDocument();
    });

    it('lays the search bar out in normal flow without a negative top margin', () => {
      const { container } = renderWithProviders(<HomeScreen {...defaultProps} />);

      const searchInput = screen.getByPlaceholderText(/search/i);
      const searchContainer = searchInput.closest('div.relative.max-w-xl') as HTMLElement | null;

      expect(searchContainer).not.toBeNull();
      expect(searchContainer!.className).not.toMatch(/-mt-/);
    });
  });

  it('shows loading state', () => {
    renderWithProviders(<HomeScreen {...defaultProps} isLoading={true} />);
    expect(screen.getByText('Restoring the archives...')).toBeInTheDocument();
  });

  it('shows error state', () => {
    renderWithProviders(<HomeScreen {...defaultProps} loadError="Failed to load" />);
    expect(screen.getByText(/sync paused/i)).toBeInTheDocument();
    expect(screen.getByText('Failed to load')).toBeInTheDocument();
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
  });
});
