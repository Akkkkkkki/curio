/**
 * Phase 4: Layout Component Tests
 *
 * Tests the Layout component which provides the main app structure.
 * Validates header, navigation, auth status, theme picker, and accessibility.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  renderWithProviders,
  screen,
  fireEvent,
  waitFor,
  setMockTheme,
  createThemeMock,
} from '../utils/test-utils';
import { Layout } from '@/components/Layout';

// Use centralized configurable theme mock
vi.mock('@/theme', async () => {
  const { createThemeMock } = await import('../utils/test-utils');
  return createThemeMock();
});

// Mock ThemePicker to simplify testing
vi.mock('@/components/ThemePicker', () => ({
  ThemePicker: ({ layout }: { layout?: string }) => (
    <div data-testid="mock-theme-picker" data-layout={layout}>
      Theme Picker
    </div>
  ),
}));

describe('Layout Component', () => {
  const defaultProps = {
    onOpenAuth: vi.fn(),
    onSignOut: vi.fn(),
    user: null,
    isSupabaseConfigured: true,
    children: <div data-testid="child-content">Main Content</div>,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    setMockTheme('gallery');
  });

  describe('Basic Rendering', () => {
    it('renders children content', () => {
      renderWithProviders(<Layout {...defaultProps} />);

      expect(screen.getByTestId('child-content')).toBeInTheDocument();
      expect(screen.getByText('Main Content')).toBeInTheDocument();
    });

    it('renders app title with link to home', () => {
      renderWithProviders(<Layout {...defaultProps} />);

      expect(screen.getByText('Curio')).toBeInTheDocument();
      // The title should be a link to home
      const homeLink = screen.getByRole('link', { name: /curio/i });
      expect(homeLink).toHaveAttribute('href', '#/');
    });

    it('renders the C logo', () => {
      renderWithProviders(<Layout {...defaultProps} />);

      expect(screen.getByText('C')).toBeInTheDocument();
    });

    it('renders header extras when provided', () => {
      const headerExtras = <button data-testid="custom-button">Custom</button>;

      renderWithProviders(<Layout {...defaultProps} headerExtras={headerExtras} />);

      expect(screen.getByTestId('custom-button')).toBeInTheDocument();
    });
  });

  describe('Profile Dropdown', () => {
    it('opens profile dropdown when account button is clicked', async () => {
      renderWithProviders(<Layout {...defaultProps} />);

      const accountButton = screen.getByRole('button', { name: /account/i });
      fireEvent.click(accountButton);

      await waitFor(() => {
        expect(screen.getByText('Account Status')).toBeInTheDocument();
      });
    });

    it('closes profile dropdown when clicked again', async () => {
      renderWithProviders(<Layout {...defaultProps} />);

      const accountButton = screen.getByRole('button', { name: /account/i });

      // Open
      fireEvent.click(accountButton);
      await waitFor(() => {
        expect(screen.getByText('Account Status')).toBeInTheDocument();
      });

      // Close
      fireEvent.click(accountButton);
      await waitFor(() => {
        expect(screen.queryByText('Account Status')).not.toBeInTheDocument();
      });
    });

    it('renders ThemePicker in profile dropdown', async () => {
      renderWithProviders(<Layout {...defaultProps} />);

      const accountButton = screen.getByRole('button', { name: /account/i });
      fireEvent.click(accountButton);

      await waitFor(() => {
        expect(screen.getByTestId('mock-theme-picker')).toBeInTheDocument();
        expect(screen.getByTestId('mock-theme-picker')).toHaveAttribute('data-layout', 'stacked');
      });
    });

    // Note: Click-outside and Escape key handlers are not currently implemented
    // in the Layout component. These would be good accessibility improvements.
  });

  describe('Authentication Status - Not Configured', () => {
    it('displays cloud required status when Supabase is not configured', async () => {
      renderWithProviders(<Layout {...defaultProps} isSupabaseConfigured={false} />);

      const accountButton = screen.getByRole('button', { name: /account/i });
      fireEvent.click(accountButton);

      await waitFor(() => {
        expect(screen.getByText('Cloud Required')).toBeInTheDocument();
      });
    });
  });

  describe('Authentication Status - Signed Out', () => {
    it('displays signed out status for unauthenticated user', async () => {
      renderWithProviders(<Layout {...defaultProps} user={null} />);

      const accountButton = screen.getByRole('button', { name: /account/i });
      fireEvent.click(accountButton);

      await waitFor(() => {
        expect(screen.getByText('Signed Out')).toBeInTheDocument();
      });
    });

    it('shows login button when signed out', async () => {
      renderWithProviders(<Layout {...defaultProps} user={null} />);

      const accountButton = screen.getByRole('button', { name: /account/i });
      fireEvent.click(accountButton);

      await waitFor(() => {
        expect(screen.getByText('Sign In')).toBeInTheDocument();
      });
    });

    it('calls onOpenAuth when login button is clicked', async () => {
      const onOpenAuth = vi.fn();
      renderWithProviders(<Layout {...defaultProps} user={null} onOpenAuth={onOpenAuth} />);

      const accountButton = screen.getByRole('button', { name: /account/i });
      fireEvent.click(accountButton);

      await waitFor(() => {
        const loginButton = screen.getByText('Sign In');
        fireEvent.click(loginButton);
      });

      expect(onOpenAuth).toHaveBeenCalledTimes(1);
    });

    it('closes dropdown after login button is clicked', async () => {
      const onOpenAuth = vi.fn();
      renderWithProviders(<Layout {...defaultProps} user={null} onOpenAuth={onOpenAuth} />);

      const accountButton = screen.getByRole('button', { name: /account/i });
      fireEvent.click(accountButton);

      await waitFor(() => {
        const loginButton = screen.getByText('Sign In');
        fireEvent.click(loginButton);
      });

      // Dropdown should close
      await waitFor(() => {
        expect(screen.queryByText('Account Status')).not.toBeInTheDocument();
      });
    });
  });

  describe('Authentication Status - Signed In', () => {
    const authenticatedUser = { id: 'user-1', email: 'test@example.com' };

    it('displays signed in status for authenticated user', async () => {
      renderWithProviders(<Layout {...defaultProps} user={authenticatedUser} />);

      const accountButton = screen.getByRole('button', { name: /account/i });
      fireEvent.click(accountButton);

      await waitFor(() => {
        expect(screen.getByText('Signed In')).toBeInTheDocument();
      });
    });

    it('displays user email when signed in', async () => {
      renderWithProviders(<Layout {...defaultProps} user={authenticatedUser} />);

      const accountButton = screen.getByRole('button', { name: /account/i });
      fireEvent.click(accountButton);

      await waitFor(() => {
        expect(screen.getByText(/test@example.com/)).toBeInTheDocument();
      });
    });

    it('shows sign out button when signed in', async () => {
      renderWithProviders(<Layout {...defaultProps} user={authenticatedUser} />);

      const accountButton = screen.getByRole('button', { name: /account/i });
      fireEvent.click(accountButton);

      await waitFor(() => {
        expect(screen.getByText('Sign Out')).toBeInTheDocument();
      });
    });

    it('calls onSignOut when sign out button is clicked', async () => {
      const onSignOut = vi.fn();
      renderWithProviders(
        <Layout {...defaultProps} user={authenticatedUser} onSignOut={onSignOut} />,
      );

      const accountButton = screen.getByRole('button', { name: /account/i });
      fireEvent.click(accountButton);

      await waitFor(() => {
        const signOutButton = screen.getByText('Sign Out');
        fireEvent.click(signOutButton);
      });

      expect(onSignOut).toHaveBeenCalledTimes(1);
    });

    it('closes dropdown after sign out button is clicked', async () => {
      const onSignOut = vi.fn();
      renderWithProviders(
        <Layout {...defaultProps} user={authenticatedUser} onSignOut={onSignOut} />,
      );

      const accountButton = screen.getByRole('button', { name: /account/i });
      fireEvent.click(accountButton);

      await waitFor(() => {
        const signOutButton = screen.getByText('Sign Out');
        fireEvent.click(signOutButton);
      });

      // Dropdown should close
      await waitFor(() => {
        expect(screen.queryByText('Account Status')).not.toBeInTheDocument();
      });
    });
  });

  describe('Local Import Feature', () => {
    const authenticatedUser = { id: 'user-1', email: 'test@example.com' };

    it('shows import section when hasLocalImport is true and user is authenticated', async () => {
      const onImportLocal = vi.fn();
      renderWithProviders(
        <Layout
          {...defaultProps}
          user={authenticatedUser}
          hasLocalImport={true}
          onImportLocal={onImportLocal}
        />,
      );

      const accountButton = screen.getByRole('button', { name: /account/i });
      fireEvent.click(accountButton);

      await waitFor(() => {
        expect(screen.getByText('Local data found')).toBeInTheDocument();
      });
    });

    it('does not show import section when user is not authenticated', async () => {
      const onImportLocal = vi.fn();
      renderWithProviders(
        <Layout
          {...defaultProps}
          user={null}
          hasLocalImport={true}
          onImportLocal={onImportLocal}
        />,
      );

      const accountButton = screen.getByRole('button', { name: /account/i });
      fireEvent.click(accountButton);

      await waitFor(() => {
        expect(screen.queryByText('Local data found')).not.toBeInTheDocument();
      });
    });

    it('calls onImportLocal when import button is clicked', async () => {
      const onImportLocal = vi.fn();
      renderWithProviders(
        <Layout
          {...defaultProps}
          user={authenticatedUser}
          hasLocalImport={true}
          onImportLocal={onImportLocal}
        />,
      );

      const accountButton = screen.getByRole('button', { name: /account/i });
      fireEvent.click(accountButton);

      await waitFor(() => {
        const importButton = screen.getByText('Import Local Data');
        fireEvent.click(importButton);
      });

      expect(onImportLocal).toHaveBeenCalledTimes(1);
    });

    it('shows importing state', async () => {
      renderWithProviders(
        <Layout
          {...defaultProps}
          user={authenticatedUser}
          hasLocalImport={true}
          onImportLocal={vi.fn()}
          importState="running"
        />,
      );

      const accountButton = screen.getByRole('button', { name: /account/i });
      fireEvent.click(accountButton);

      await waitFor(() => {
        expect(screen.getByText('Importing...')).toBeInTheDocument();
      });
    });

    it('disables import button during import', async () => {
      renderWithProviders(
        <Layout
          {...defaultProps}
          user={authenticatedUser}
          hasLocalImport={true}
          onImportLocal={vi.fn()}
          importState="running"
        />,
      );

      const accountButton = screen.getByRole('button', { name: /account/i });
      fireEvent.click(accountButton);

      await waitFor(() => {
        const importButton = screen.getByText('Importing...').closest('button');
        expect(importButton).toBeDisabled();
      });
    });

    it('displays import message when provided', async () => {
      renderWithProviders(
        <Layout
          {...defaultProps}
          user={authenticatedUser}
          hasLocalImport={true}
          onImportLocal={vi.fn()}
          importMessage="Import completed successfully"
        />,
      );

      const accountButton = screen.getByRole('button', { name: /account/i });
      fireEvent.click(accountButton);

      await waitFor(() => {
        expect(screen.getByText('Import completed successfully')).toBeInTheDocument();
      });
    });
  });

  describe('Bottom Navigation (Mobile)', () => {
    it('renders home link in bottom nav', () => {
      renderWithProviders(<Layout {...defaultProps} />);

      // Bottom nav has aria-label="Primary"
      const bottomNav = screen.getByRole('navigation', { name: /primary/i });
      expect(bottomNav).toBeInTheDocument();

      // Home link should be present
      const homeLinks = screen.getAllByText('Home');
      expect(homeLinks.length).toBeGreaterThanOrEqual(1);
    });

    it('renders explore link in bottom nav when sampleCollectionId is provided', () => {
      renderWithProviders(<Layout {...defaultProps} sampleCollectionId="sample-vinyl-1" />);

      expect(screen.getByText('Explore')).toBeInTheDocument();
    });

    it('renders explore button when no sampleCollectionId', () => {
      renderWithProviders(<Layout {...defaultProps} onExploreSamples={vi.fn()} />);

      expect(screen.getByText('Explore')).toBeInTheDocument();
    });

    it('calls onExploreSamples when explore button is clicked', () => {
      const onExploreSamples = vi.fn();
      renderWithProviders(<Layout {...defaultProps} onExploreSamples={onExploreSamples} />);

      const exploreButton = screen.getByText('Explore');
      fireEvent.click(exploreButton);

      expect(onExploreSamples).toHaveBeenCalledTimes(1);
    });
  });

  describe('Theme Support', () => {
    describe.each([
      { theme: 'gallery' as const, bgPattern: /bg-white/, description: 'light background' },
      { theme: 'vault' as const, bgPattern: /bg-stone-900/, description: 'dark background' },
      { theme: 'atelier' as const, bgPattern: /bg-\[#f8f6f1\]/, description: 'cream background' },
    ])('Theme: $theme', ({ theme, bgPattern, description }) => {
      beforeEach(() => {
        setMockTheme(theme);
      });

      it(`renders correctly with ${theme} theme`, () => {
        renderWithProviders(<Layout {...defaultProps} />);

        expect(screen.getByText('Curio')).toBeInTheDocument();
        expect(screen.getByTestId('child-content')).toBeInTheDocument();
      });

      it(`applies ${description} styling to header for ${theme} theme`, () => {
        renderWithProviders(<Layout {...defaultProps} />);

        const header = document.querySelector('header');
        expect(header?.className).toMatch(bgPattern);
      });

      it(`header has backdrop blur effect with ${theme} theme`, () => {
        renderWithProviders(<Layout {...defaultProps} />);

        const header = document.querySelector('header');
        expect(header?.className).toContain('backdrop-blur');
      });

      it(`maintains navigation functionality with ${theme} theme`, async () => {
        renderWithProviders(<Layout {...defaultProps} />);

        const accountButton = screen.getByRole('button', { name: /account/i });
        fireEvent.click(accountButton);

        await waitFor(() => {
          expect(screen.getByText('Account Status')).toBeInTheDocument();
        });
      });
    });
  });

  describe('Accessibility', () => {
    it('has accessible account button with aria-label', () => {
      renderWithProviders(<Layout {...defaultProps} />);

      const accountButton = screen.getByRole('button', { name: /account/i });
      expect(accountButton).toHaveAttribute('aria-label', 'Account');
    });

    it('has primary navigation with aria-label', () => {
      renderWithProviders(<Layout {...defaultProps} />);

      const bottomNav = screen.getByRole('navigation', { name: /primary/i });
      expect(bottomNav).toBeInTheDocument();
    });

    it('header is sticky for easy navigation', () => {
      renderWithProviders(<Layout {...defaultProps} />);

      const header = document.querySelector('header');
      expect(header?.className).toContain('sticky');
      expect(header?.className).toContain('top-0');
    });
  });

  describe('Edge Cases', () => {
    it('handles undefined onExploreSamples gracefully', () => {
      // Should not throw when onExploreSamples is not provided
      expect(() => {
        renderWithProviders(<Layout {...defaultProps} onExploreSamples={undefined} />);
      }).not.toThrow();
    });

    it('handles null sampleCollectionId gracefully', () => {
      expect(() => {
        renderWithProviders(<Layout {...defaultProps} sampleCollectionId={null} />);
      }).not.toThrow();
    });

    it('handles empty children gracefully', () => {
      expect(() => {
        renderWithProviders(<Layout {...defaultProps}>{null}</Layout>);
      }).not.toThrow();
    });
  });
});
