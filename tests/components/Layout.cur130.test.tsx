import { describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import { Layout } from '@/components/Layout';
import { renderWithProviders, createThemeMock } from '../utils/test-utils';

vi.mock('@/theme', async () => {
  const { createThemeMock } = await import('../utils/test-utils');
  return createThemeMock();
});

vi.mock('@/components/ThemePicker', () => ({
  ThemePicker: () => <div data-testid="mock-theme-picker" />,
}));

describe('CUR-130 mobile navigation IA', () => {
  const baseProps = {
    onOpenAuth: vi.fn(),
    onSignOut: vi.fn(),
    onAddItem: vi.fn(),
    user: { id: 'user-1', email: 'collector@example.com' },
    isSupabaseConfigured: true,
    sampleCollectionId: 'sample-vinyl-1',
  };

  it('keeps Add in the center position and exposes the warmer You label', () => {
    renderWithProviders(
      <Layout {...baseProps}>
        <div>Content</div>
      </Layout>,
    );

    const nav = screen.getByRole('navigation', { name: /primary/i });
    expect(within(nav).getByText('Home')).toBeInTheDocument();
    expect(within(nav).getByText('Explore')).toBeInTheDocument();
    expect(within(nav).getByText('Add')).toBeInTheDocument();
    expect(within(nav).getByText('You')).toBeInTheDocument();

    const fab = screen.getByTestId('bottom-nav-add-pill');
    expect(fab.className).toContain('w-14');
    expect(fab.className).toContain('h-14');
    expect(fab.className).toContain('-mt-5');
  });

  it('does not render a dead Wrapped destination before CUR-129 is live', () => {
    renderWithProviders(
      <Layout {...baseProps}>
        <div>Content</div>
      </Layout>,
    );

    const nav = screen.getByRole('navigation', { name: /primary/i });
    expect(within(nav).queryByText(/wrapped/i)).not.toBeInTheDocument();
    expect(screen.getByTestId('bottom-nav-wrapped-slot')).toBeInTheDocument();
  });
});
