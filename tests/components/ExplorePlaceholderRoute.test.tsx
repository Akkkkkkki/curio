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

describe('Explore placeholder routing', () => {
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
  });

  it('navigates to the explore placeholder from the bottom nav', async () => {
    renderWithProviders(
      <Layout {...defaultProps}>
        <Routes>
          <Route path="/" element={<div>Home</div>} />
          <Route path="/explore" element={<ExplorePlaceholder />} />
        </Routes>
      </Layout>,
    );

    const exploreLink = screen.getByRole('link', { name: /explore/i });
    fireEvent.click(exploreLink);

    expect(await screen.findByTestId('explore-placeholder')).toBeInTheDocument();
    expect(screen.getByText('Community features are coming soon.')).toBeInTheDocument();
  });
});
