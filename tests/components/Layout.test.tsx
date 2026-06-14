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
  within,
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
        const dropdown = screen.getByTestId('profile-dropdown');
        expect(within(dropdown).getByText('Sign In')).toBeInTheDocument();
      });
    });

    it('calls onOpenAuth when login button is clicked', async () => {
      const onOpenAuth = vi.fn();
      renderWithProviders(<Layout {...defaultProps} user={null} onOpenAuth={onOpenAuth} />);

      const accountButton = screen.getByRole('button', { name: /account/i });
      fireEvent.click(accountButton);

      await waitFor(() => {
        const dropdown = screen.getByTestId('profile-dropdown');
        const loginButton = within(dropdown).getByText('Sign In');
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
        const dropdown = screen.getByTestId('profile-dropdown');
        const loginButton = within(dropdown).getByText('Sign In');
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
    const authenticatedUser = { id: 'user-1', email: 'test@example.com' };

    it('renders all navigation items', () => {
      renderWithProviders(
        <Layout {...defaultProps} user={authenticatedUser} sampleCollectionId="sample-vinyl-1" />,
      );

      const bottomNav = screen.getByRole('navigation', { name: /primary/i });
      expect(bottomNav).toBeInTheDocument();

      expect(within(bottomNav).getByText('Home')).toBeInTheDocument();
      expect(within(bottomNav).getByText('Explore')).toBeInTheDocument();
      expect(within(bottomNav).getByText('Add')).toBeInTheDocument();
      expect(within(bottomNav).getByText('Profile')).toBeInTheDocument();
    });

    it('calls onAddItem when add button is clicked', () => {
      const onAddItem = vi.fn();
      renderWithProviders(<Layout {...defaultProps} onAddItem={onAddItem} />);

      const bottomNav = screen.getByRole('navigation', { name: /primary/i });
      const addButton = within(bottomNav).getByText('Add').closest('button');
      fireEvent.click(addButton!);

      expect(onAddItem).toHaveBeenCalledTimes(1);
    });

    it('opens profile when profile button is clicked', async () => {
      renderWithProviders(<Layout {...defaultProps} user={authenticatedUser} />);

      const bottomNav = screen.getByRole('navigation', { name: /primary/i });
      const profileButton = within(bottomNav).getByText('Profile').closest('button');
      fireEvent.click(profileButton!);

      await waitFor(() => {
        expect(screen.getByText('Account Status')).toBeInTheDocument();
      });
    });

    describe('Add button pill is theme-aware', () => {
      it.each([
        { theme: 'gallery' as const, expected: ['bg-amber-100', 'text-amber-700'] },
        { theme: 'vault' as const, expected: ['bg-[#D4A574]/20', 'text-[#D4A574]'] },
        { theme: 'atelier' as const, expected: ['bg-[#A86F3C]/15', 'text-[#A86F3C]'] },
      ])('uses theme accent in $theme', ({ theme, expected }) => {
        setMockTheme(theme);
        renderWithProviders(<Layout {...defaultProps} />);

        const pill = screen.getByTestId('bottom-nav-add-pill');
        for (const className of expected) {
          expect(pill.className).toContain(className);
        }
      });
    });

    it('renders profile menu as a bottom sheet (not the header dropdown) when triggered from bottom nav', async () => {
      renderWithProviders(<Layout {...defaultProps} user={authenticatedUser} />);

      const bottomNav = screen.getByRole('navigation', { name: /primary/i });
      const profileButton = within(bottomNav).getByText('Profile').closest('button');
      fireEvent.click(profileButton!);

      await waitFor(() => {
        expect(screen.getByTestId('profile-bottom-sheet')).toBeInTheDocument();
      });
      expect(screen.queryByTestId('profile-dropdown')).not.toBeInTheDocument();
    });

    it('renders the header dropdown (not the bottom sheet) when triggered from the header account button', async () => {
      renderWithProviders(<Layout {...defaultProps} />);

      const accountButton = screen.getByRole('button', { name: /account/i });
      fireEvent.click(accountButton);

      await waitFor(() => {
        expect(screen.getByTestId('profile-dropdown')).toBeInTheDocument();
      });
      expect(screen.queryByTestId('profile-bottom-sheet')).not.toBeInTheDocument();
    });

    it('closes the bottom sheet when Escape is pressed', async () => {
      renderWithProviders(<Layout {...defaultProps} user={authenticatedUser} />);

      const bottomNav = screen.getByRole('navigation', { name: /primary/i });
      const profileButton = within(bottomNav).getByText('Profile').closest('button');
      fireEvent.click(profileButton!);

      await waitFor(() => {
        expect(screen.getByTestId('profile-bottom-sheet')).toBeInTheDocument();
      });

      fireEvent.keyDown(document, { key: 'Escape' });

      await waitFor(() => {
        expect(screen.queryByTestId('profile-bottom-sheet')).not.toBeInTheDocument();
      });
    });

    it('closes the bottom sheet when the backdrop is clicked', async () => {
      renderWithProviders(<Layout {...defaultProps} user={authenticatedUser} />);

      const bottomNav = screen.getByRole('navigation', { name: /primary/i });
      const profileButton = within(bottomNav).getByText('Profile').closest('button');
      fireEvent.click(profileButton!);

      await waitFor(() => {
        expect(screen.getByTestId('profile-bottom-sheet')).toBeInTheDocument();
      });

      const backdrop = screen.getByTestId('profile-bottom-sheet-backdrop');
      fireEvent.click(backdrop);

      await waitFor(() => {
        expect(screen.queryByTestId('profile-bottom-sheet')).not.toBeInTheDocument();
      });
    });

    // CUR-95: bottom sheet exposes a visible close button (the backdrop alone
    // is not a discoverable affordance on mobile) and restores focus to the
    // trigger after dismissal.
    describe('CUR-95 bottom sheet close affordance', () => {
      it('renders a visible close button inside the bottom sheet', async () => {
        renderWithProviders(<Layout {...defaultProps} user={authenticatedUser} />);

        const bottomNav = screen.getByRole('navigation', { name: /primary/i });
        const profileButton = within(bottomNav).getByText('Profile').closest('button');
        fireEvent.click(profileButton!);

        await waitFor(() => {
          expect(screen.getByTestId('profile-bottom-sheet-close')).toBeInTheDocument();
        });
        const closeButton = screen.getByTestId('profile-bottom-sheet-close');
        expect(closeButton).toHaveAttribute('aria-label', 'Close');
      });

      it('closes the bottom sheet when the close button is clicked', async () => {
        renderWithProviders(<Layout {...defaultProps} user={authenticatedUser} />);

        const bottomNav = screen.getByRole('navigation', { name: /primary/i });
        const profileButton = within(bottomNav).getByText('Profile').closest('button');
        fireEvent.click(profileButton!);

        await waitFor(() => {
          expect(screen.getByTestId('profile-bottom-sheet')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByTestId('profile-bottom-sheet-close'));

        await waitFor(() => {
          expect(screen.queryByTestId('profile-bottom-sheet')).not.toBeInTheDocument();
        });
      });

      it('restores focus to the bottom-nav profile button after the sheet closes', async () => {
        renderWithProviders(<Layout {...defaultProps} user={authenticatedUser} />);

        const bottomNav = screen.getByRole('navigation', { name: /primary/i });
        const profileButton = within(bottomNav).getByText('Profile').closest('button');
        fireEvent.click(profileButton!);

        await waitFor(() => {
          expect(screen.getByTestId('profile-bottom-sheet-close')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByTestId('profile-bottom-sheet-close'));

        await waitFor(() => {
          expect(document.activeElement).toBe(profileButton);
        });
      });
    });
  });

  describe('Theme Support', () => {
    describe.each([
      { theme: 'gallery' as const, bgPattern: /bg-white/, description: 'light background' },
      { theme: 'vault' as const, bgPattern: /bg-stone-900/, description: 'dark background' },
      {
        theme: 'atelier' as const,
        bgPattern: /bg-\[#F5EFE4\]/,
        description: 'warm cream background',
      },
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

  // CUR-49: First-run discoverability — signed-out users get a visible "Sign In"
  // label next to the header icon and in the mobile bottom nav, with a matching
  // tooltip on hover.
  describe('CUR-49 Sign-in entry point label', () => {
    const authenticatedUser = { id: 'user-1', email: 'test@example.com' };

    it('shows a visible Sign In label in the header when signed out', () => {
      renderWithProviders(<Layout {...defaultProps} user={null} />);

      const label = screen.getByTestId('header-sign-in-label');
      expect(label).toBeInTheDocument();
      expect(label).toHaveTextContent('Sign In');
    });

    it('uses JetBrains Mono uppercase wide tracking on the header label (per DESIGN.md)', () => {
      renderWithProviders(<Layout {...defaultProps} user={null} />);

      const label = screen.getByTestId('header-sign-in-label');
      expect(label.className).toContain('font-mono');
      expect(label.className).toContain('uppercase');
      expect(label.className).toMatch(/tracking-/);
    });

    it('hides the header Sign In label when signed in', () => {
      renderWithProviders(<Layout {...defaultProps} user={authenticatedUser} />);

      expect(screen.queryByTestId('header-sign-in-label')).not.toBeInTheDocument();
    });

    it('hides the header Sign In label when Supabase is not configured', () => {
      renderWithProviders(<Layout {...defaultProps} user={null} isSupabaseConfigured={false} />);

      expect(screen.queryByTestId('header-sign-in-label')).not.toBeInTheDocument();
    });

    it('uses Sign In as the header button tooltip when signed out', () => {
      renderWithProviders(<Layout {...defaultProps} user={null} />);

      const accountButton = screen.getByRole('button', { name: /account/i });
      expect(accountButton).toHaveAttribute('title', 'Sign In');
    });

    it('keeps the signed-in status as the tooltip when signed in', () => {
      renderWithProviders(<Layout {...defaultProps} user={authenticatedUser} />);

      const accountButton = screen.getByRole('button', { name: /account/i });
      expect(accountButton).toHaveAttribute('title', 'Signed In');
    });

    it('shows Sign In on the mobile bottom nav when signed out', () => {
      renderWithProviders(<Layout {...defaultProps} user={null} />);

      const bottomNav = screen.getByRole('navigation', { name: /primary/i });
      expect(within(bottomNav).getByText('Sign In')).toBeInTheDocument();
      expect(within(bottomNav).queryByText('Profile')).not.toBeInTheDocument();
    });

    it('shows Profile on the mobile bottom nav when signed in', () => {
      renderWithProviders(<Layout {...defaultProps} user={authenticatedUser} />);

      const bottomNav = screen.getByRole('navigation', { name: /primary/i });
      expect(within(bottomNav).getByText('Profile')).toBeInTheDocument();
      expect(within(bottomNav).queryByText('Sign In')).not.toBeInTheDocument();
    });

    it('keeps Profile on the mobile bottom nav when Supabase is not configured', () => {
      renderWithProviders(<Layout {...defaultProps} user={null} isSupabaseConfigured={false} />);

      const bottomNav = screen.getByRole('navigation', { name: /primary/i });
      expect(within(bottomNav).getByText('Profile')).toBeInTheDocument();
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
