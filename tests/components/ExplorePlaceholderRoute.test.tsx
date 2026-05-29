import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, renderWithProviders, screen, setMockTheme } from '../utils/test-utils';
import { Routes, Route } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { ExplorePlaceholder } from '@/components/ExplorePlaceholder';

// Use centralized configurable theme mock
vi.mock('@/theme', async () => {
  const { createThemeMock } = await import('../utils/test-utils');
  return createThemeMock();
});

describe('Explore navigation routing', () => {
  const defaultProps = {
    onOpenAuth: vi.fn(),
    onSignOut: vi.fn(),
    user: null,
    isSupabaseConfigured: true,
    children: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    setMockTheme('gallery');
    window.location.hash = '#/';
  });

  it('routes the bottom-nav Explore tab straight to the sample collection in one tap', async () => {
    const onExploreSamples = vi.fn();
    renderWithProviders(
      <Layout
        {...defaultProps}
        sampleCollectionId="sample-vinyl-1"
        onExploreSamples={onExploreSamples}
      >
        <Routes>
          <Route path="/" element={<div>Home</div>} />
          <Route path="/explore" element={<ExplorePlaceholder />} />
          <Route
            path="/collection/:id"
            element={<div data-testid="sample-gallery">Sample gallery</div>}
          />
        </Routes>
      </Layout>,
    );

    const exploreLink = screen.getByRole('link', { name: /explore/i });
    fireEvent.click(exploreLink);

    expect(await screen.findByTestId('sample-gallery')).toBeInTheDocument();
    expect(screen.queryByText('Community features are coming soon.')).not.toBeInTheDocument();
    expect(onExploreSamples).toHaveBeenCalledTimes(1);
  });

  it('hides the Explore tab when no sample collection exists (no dead end)', () => {
    renderWithProviders(
      <Layout {...defaultProps} sampleCollectionId={null}>
        <Routes>
          <Route path="/" element={<div>Home</div>} />
        </Routes>
      </Layout>,
    );

    expect(screen.queryByRole('link', { name: /explore/i })).not.toBeInTheDocument();
  });

  it('keeps the Explore placeholder as a destination for the future feed', () => {
    renderWithProviders(<ExplorePlaceholder sampleCollectionId="sample-vinyl-1" />);

    expect(screen.getByTestId('explore-placeholder')).toBeInTheDocument();
    expect(screen.getByText('Community features are coming soon.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /sample gallery/i })).toHaveAttribute(
      'href',
      '#/collection/sample-vinyl-1',
    );
  });
});
