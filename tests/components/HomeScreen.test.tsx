import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, fireEvent, waitFor } from '../utils/test-utils';
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

  it('shows loading state', () => {
    renderWithProviders(<HomeScreen {...defaultProps} isLoading={true} />);
    expect(screen.getByText('Restoring the archives...')).toBeInTheDocument();
  });

  it('shows error state', () => {
    renderWithProviders(<HomeScreen {...defaultProps} loadError="Failed to load" />);
    expect(screen.getByText(/sync paused/i)).toBeInTheDocument();
    expect(screen.getByText('Failed to load')).toBeInTheDocument();
  });
});
