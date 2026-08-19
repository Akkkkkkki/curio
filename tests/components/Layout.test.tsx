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

    // Note: Click-outside and Escape key handlers are not currently implemented
    // in the Layout component. These would be good accessibility improvements.
  });

  // CUR-127: theme switching moved out of the profile grab-bag into a dedicated
  // header quick toggle, and the remaining menu items are grouped into
  // scannable Account / About / Data sections instead of a flat list.
  describe('CUR-127 Theme quick toggle and grouped profile menu', () => {
    const authenticatedUser = { id: 'user-1', email: 'test@example.com' };

    it('changes theme without opening the profile menu (header quick toggle)', async () => {
      renderWithProviders(<Layout {...defaultProps} />);

      const themeButton = screen.getByTestId('theme-picker');
      expect(themeButton).toHaveAttribute('aria-expanded', 'false');
      fireEvent.click(themeButton);

      await waitFor(() => {
        expect(themeButton).toHaveAttribute('aria-expanded', 'true');
        const menu = screen.getByTestId('theme-quick-menu');
        expect(within(menu).getByTestId('mock-theme-picker')).toHaveAttribute(
          'data-layout',
          'stacked',
        );
      });
    });

    it('closes the theme popover on Escape', async () => {
      renderWithProviders(<Layout {...defaultProps} />);

      fireEvent.click(screen.getByTestId('theme-picker'));
      await waitFor(() => {
        expect(screen.getByTestId('theme-quick-menu')).toBeInTheDocument();
      });

      fireEvent.keyDown(document, { key: 'Escape' });
      await waitFor(() => {
        expect(screen.queryByTestId('theme-quick-menu')).not.toBeInTheDocument();
      });
    });

    it('no longer renders the ThemePicker inside the profile dropdown', async () => {
      renderWithProviders(<Layout {...defaultProps} />);

      fireEvent.click(screen.getByRole('button', { name: /account/i }));

      await waitFor(() => {
        const dropdown = screen.getByTestId('profile-dropdown');
        expect(within(dropdown).queryByTestId('mock-theme-picker')).not.toBeInTheDocument();
      });
    });

    it('groups the profile menu into Account / About / Data sections', async () => {
      renderWithProviders(
        <Layout
          {...defaultProps}
          user={authenticatedUser}
          hasLocalImport
          onImportLocal={vi.fn()}
        />,
      );

      fireEvent.click(screen.getByRole('button', { name: /account/i }));

      await waitFor(() => {
        const dropdown = screen.getByTestId('profile-dropdown');
        const account = within(dropdown).getByTestId('profile-account-section');
        expect(within(account).getByText('Account Status')).toBeInTheDocument();
        expect(within(account).getByText('Sign Out')).toBeInTheDocument();

        const about = within(dropdown).getByTestId('profile-about-section');
        expect(within(about).getByText('About')).toBeInTheDocument();
        expect(within(about).getByTestId('profile-legal-links')).toBeInTheDocument();

        const data = within(dropdown).getByTestId('profile-data-section');
        expect(within(data).getByText('Your Data')).toBeInTheDocument();
        expect(within(data).getByTestId('profile-import-card')).toBeInTheDocument();
      });
    });

    it('keeps the sign-in action inside the Account section when signed out', async () => {
      renderWithProviders(<Layout {...defaultProps} user={null} />);

      fireEvent.click(screen.getByRole('button', { name: /account/i }));

      await waitFor(() => {
        const account = within(screen.getByTestId('profile-dropdown')).getByTestId(
          'profile-account-section',
        );
        expect(within(account).getByText('Sign In')).toBeInTheDocument();
      });
    });
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

  describe('CUR-97 desktop bottom clearance', () => {
    it('gates the bottom-nav padding to mobile with a desktop override', () => {
      renderWithProviders(<Layout {...defaultProps} />);

      const main = document.getElementById('main-content')!;
      // Mobile reserves clearance for the bottom nav; desktop drops back to py-8.
      expect(main.className).toContain(
        'pb-[calc(var(--bottom-nav-height,5.5rem)+env(safe-area-inset-bottom,0px))]',
      );
      expect(main.className).toContain('sm:pb-8');
      // The reservation must not leak in as an unconditional inline style.
      expect(main.style.paddingBottom).toBe('');
    });

    it('does not draw the decorative footer fade on desktop', () => {
      renderWithProviders(<Layout {...defaultProps} />);

      const footer = document.querySelector('footer')!;
      expect(footer).not.toBeNull();
      expect(footer.className).toContain('sm:hidden');
    });
  });

  describe('CUR-410 Desktop header Add-item entry point', () => {
    const authenticatedUser = { id: 'user-1', email: 'test@example.com' };

    it('renders a desktop Add Item button for signed-in users', () => {
      renderWithProviders(
        <Layout {...defaultProps} user={authenticatedUser} onAddItem={vi.fn()} />,
      );

      const addButton = screen.getByTestId('header-add-item');
      expect(addButton).toHaveTextContent('Add Item');
      // Hidden on mobile so it never overlaps the bottom-nav Add pill.
      expect(addButton.className).toContain('hidden');
      expect(addButton.className).toContain('sm:inline-flex');
    });

    it('calls onAddItem when the desktop Add Item button is clicked', () => {
      const onAddItem = vi.fn();
      renderWithProviders(
        <Layout {...defaultProps} user={authenticatedUser} onAddItem={onAddItem} />,
      );

      fireEvent.click(screen.getByTestId('header-add-item'));
      expect(onAddItem).toHaveBeenCalledTimes(1);
    });

    it('does not render the desktop Add Item button when signed out', () => {
      renderWithProviders(<Layout {...defaultProps} user={null} onAddItem={vi.fn()} />);

      expect(screen.queryByTestId('header-add-item')).not.toBeInTheDocument();
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

  // CUR-112: Privacy / Terms have no in-app discovery path after signup.
  // Profile menu (shared by header dropdown + mobile bottom sheet) now surfaces
  // both legal docs in every auth state.
  describe('CUR-112 Legal links in profile menu', () => {
    const authenticatedUser = { id: 'user-1', email: 'test@example.com' };

    it('surfaces Terms and Privacy links in the header dropdown when signed in', async () => {
      renderWithProviders(<Layout {...defaultProps} user={authenticatedUser} />);

      fireEvent.click(screen.getByRole('button', { name: /account/i }));

      await waitFor(() => {
        const legal = within(screen.getByTestId('profile-dropdown')).getByTestId(
          'profile-legal-links',
        );
        expect(within(legal).getByRole('link', { name: 'Terms of Service' })).toHaveAttribute(
          'href',
          '#/legal/terms',
        );
        expect(within(legal).getByRole('link', { name: 'Privacy Policy' })).toHaveAttribute(
          'href',
          '#/legal/privacy',
        );
      });
    });

    it('surfaces the same Terms and Privacy links when signed out', async () => {
      renderWithProviders(<Layout {...defaultProps} user={null} />);

      fireEvent.click(screen.getByRole('button', { name: /account/i }));

      await waitFor(() => {
        const legal = within(screen.getByTestId('profile-dropdown')).getByTestId(
          'profile-legal-links',
        );
        expect(within(legal).getByRole('link', { name: 'Terms of Service' })).toBeInTheDocument();
        expect(within(legal).getByRole('link', { name: 'Privacy Policy' })).toBeInTheDocument();
      });
    });

    it('opens both legal links in a new tab with secure rel (mirrors signup pattern)', async () => {
      renderWithProviders(<Layout {...defaultProps} user={authenticatedUser} />);

      fireEvent.click(screen.getByRole('button', { name: /account/i }));

      await waitFor(() => {
        const legal = within(screen.getByTestId('profile-dropdown')).getByTestId(
          'profile-legal-links',
        );
        for (const name of ['Terms of Service', 'Privacy Policy']) {
          const link = within(legal).getByRole('link', { name });
          expect(link).toHaveAttribute('target', '_blank');
          expect(link).toHaveAttribute('rel', 'noopener noreferrer');
        }
      });
    });

    it('surfaces both links from the mobile bottom sheet', async () => {
      renderWithProviders(<Layout {...defaultProps} user={authenticatedUser} />);

      const bottomNav = screen.getByRole('navigation', { name: /primary/i });
      fireEvent.click(within(bottomNav).getByText('Profile').closest('button')!);

      await waitFor(() => {
        const legal = within(screen.getByTestId('profile-bottom-sheet')).getByTestId(
          'profile-legal-links',
        );
        expect(within(legal).getByRole('link', { name: 'Terms of Service' })).toHaveAttribute(
          'href',
          '#/legal/terms',
        );
        expect(within(legal).getByRole('link', { name: 'Privacy Policy' })).toHaveAttribute(
          'href',
          '#/legal/privacy',
        );
      });
    });
  });

  // CUR-108: Profile menu auth-status chip and local-import card hardcoded the
  // Gallery 50-tone palette, so on Vault the chip turned pastel-on-near-black
  // and on Atelier it clashed with cream; the import card body copy failed
  // contrast on Vault. These tests pin the per-theme tone mapping so the
  // surfaces stay legible and palette-coherent across all three themes.
  describe('CUR-108 Profile menu theming', () => {
    const authenticatedUser = { id: 'user-1', email: 'test@example.com' };

    const openChip = async () => {
      fireEvent.click(screen.getByRole('button', { name: /account/i }));
      const dropdown = await screen.findByTestId('profile-dropdown');
      return within(dropdown).getByTestId('profile-auth-chip');
    };

    describe.each([
      {
        theme: 'gallery' as const,
        signedIn: ['bg-emerald-50', 'text-emerald-600'],
        signedOut: ['bg-amber-50', 'text-amber-600'],
        unconfigured: ['bg-stone-50', 'text-stone-400'],
      },
      {
        theme: 'vault' as const,
        signedIn: ['bg-emerald-500/15', 'text-emerald-300'],
        signedOut: ['bg-amber-500/15', 'text-amber-300'],
        unconfigured: ['bg-white/10', 'text-white/60'],
      },
      {
        theme: 'atelier' as const,
        signedIn: ['bg-emerald-100/70', 'text-emerald-700'],
        signedOut: ['bg-amber-100/70', 'text-amber-800'],
        unconfigured: ['bg-[#EDE4D3]', 'text-[#8C7B6B]'],
      },
    ])('Auth-status chip in $theme', ({ theme, signedIn, signedOut, unconfigured }) => {
      beforeEach(() => {
        setMockTheme(theme);
      });

      it('uses theme-aware signed-in chip tones', async () => {
        renderWithProviders(<Layout {...defaultProps} user={authenticatedUser} />);
        const chip = await openChip();
        for (const cls of signedIn) expect(chip.classList.contains(cls)).toBe(true);
      });

      it('uses theme-aware signed-out chip tones', async () => {
        renderWithProviders(<Layout {...defaultProps} user={null} />);
        const chip = await openChip();
        for (const cls of signedOut) expect(chip.classList.contains(cls)).toBe(true);
      });

      it('uses theme-aware unconfigured chip tones', async () => {
        renderWithProviders(<Layout {...defaultProps} user={null} isSupabaseConfigured={false} />);
        const chip = await openChip();
        for (const cls of unconfigured) expect(chip.classList.contains(cls)).toBe(true);
      });
    });

    describe.each([
      {
        theme: 'gallery' as const,
        surface: ['border-amber-100', 'bg-amber-50/60'],
        title: 'text-amber-900',
        body: 'text-stone-600',
        action: 'bg-amber-600',
        status: 'text-amber-700',
        error: 'text-red-500',
      },
      {
        theme: 'vault' as const,
        surface: ['border-amber-500/25', 'bg-amber-500/10'],
        title: 'text-amber-200',
        body: 'text-stone-300',
        action: 'bg-[#D4A574]',
        status: 'text-amber-200',
        error: 'text-red-300',
      },
      {
        theme: 'atelier' as const,
        surface: ['border-amber-300/60', 'bg-amber-100/70'],
        title: 'text-amber-900',
        body: 'text-[#3D3530]',
        action: 'bg-[#A86F3C]',
        status: 'text-amber-900',
        error: 'text-red-700',
      },
    ])('Local-import card in $theme', ({ theme, surface, title, body, action, status, error }) => {
      beforeEach(() => {
        setMockTheme(theme);
      });

      const openWithImport = async (extraProps: Record<string, unknown> = {}) => {
        renderWithProviders(
          <Layout
            {...defaultProps}
            user={authenticatedUser}
            hasLocalImport={true}
            onImportLocal={vi.fn()}
            {...extraProps}
          />,
        );
        fireEvent.click(screen.getByRole('button', { name: /account/i }));
        await waitFor(() => expect(screen.getByText('Local data found')).toBeInTheDocument());
      };

      it('applies the theme-aware card surface', async () => {
        await openWithImport();
        const card = screen.getByTestId('profile-import-card');
        for (const cls of surface) expect(card.className).toContain(cls);
      });

      it('applies theme-aware title, body, and action tones', async () => {
        await openWithImport();
        const card = screen.getByTestId('profile-import-card');
        const titleEl = card.querySelector('p:first-child') as HTMLElement;
        const bodyEl = titleEl.nextElementSibling as HTMLElement;
        const actionEl = card.querySelector('button') as HTMLElement;

        expect(titleEl.className).toContain(title);
        expect(bodyEl.className).toContain(body);
        expect(actionEl.className).toContain(action);
      });

      it('uses the theme-aware status tone for non-error import messages', async () => {
        await openWithImport({ importMessage: 'Imported 3 collections', importState: 'done' });
        const card = screen.getByTestId('profile-import-card');
        const messageEl = card.querySelector('p:last-of-type') as HTMLElement;
        expect(messageEl).toHaveTextContent('Imported 3 collections');
        expect(messageEl.className).toContain(status);
      });

      it('uses the theme-aware error tone when the import fails', async () => {
        await openWithImport({ importMessage: 'Import failed', importState: 'error' });
        const card = screen.getByTestId('profile-import-card');
        const messageEl = card.querySelector('p:last-of-type') as HTMLElement;
        expect(messageEl).toHaveTextContent('Import failed');
        expect(messageEl.className).toContain(error);
      });
    });

    // Regression guard for the pre-fix bug: Vault chip rendered the Gallery
    // bg-emerald-50 / bg-amber-50 light wash. Pin the absence so a casual
    // refactor cannot reintroduce it.
    it('does not leak Gallery 50-tones into the Vault signed-in chip', async () => {
      setMockTheme('vault');
      renderWithProviders(<Layout {...defaultProps} user={authenticatedUser} />);
      const chip = await openChip();
      expect(chip.classList.contains('bg-emerald-50')).toBe(false);
      expect(chip.classList.contains('text-emerald-600')).toBe(false);
    });

    it('does not leak Gallery 50-tones into the Vault local-import card', async () => {
      setMockTheme('vault');
      renderWithProviders(
        <Layout
          {...defaultProps}
          user={authenticatedUser}
          hasLocalImport={true}
          onImportLocal={vi.fn()}
        />,
      );
      fireEvent.click(screen.getByRole('button', { name: /account/i }));
      await waitFor(() => expect(screen.getByText('Local data found')).toBeInTheDocument());

      const card = screen.getByTestId('profile-import-card');
      expect(card.classList.contains('bg-amber-50/60')).toBe(false);
      expect(card.classList.contains('border-amber-100')).toBe(false);
    });
  });

  // CUR-138: Bottom-nav Home / Explore links were flagged as active only via
  // color (text-amber-500) with no programmatic signal, so screen readers
  // could not tell which tab was the current page. Pin aria-current="page"
  // on the active tab and its absence on inactive tabs and non-page buttons.
  describe('CUR-138 Bottom-nav aria-current', () => {
    const findBottomNav = () => screen.getByRole('navigation', { name: /primary/i });

    beforeEach(() => {
      window.location.hash = '#/';
    });

    it('marks the Home link as the current page on Home', () => {
      renderWithProviders(<Layout {...defaultProps} sampleCollectionId="sample-vinyl-1" />);

      const nav = findBottomNav();
      const homeLink = within(nav).getByRole('link', { name: /home/i });
      expect(homeLink).toHaveAttribute('aria-current', 'page');

      const exploreLink = within(nav).getByRole('link', { name: /explore/i });
      expect(exploreLink).not.toHaveAttribute('aria-current');
    });

    it('marks the Explore link as the current page while browsing the sample collection', () => {
      window.location.hash = '#/collection/sample-vinyl-1';
      renderWithProviders(<Layout {...defaultProps} sampleCollectionId="sample-vinyl-1" />);

      const nav = findBottomNav();
      const exploreLink = within(nav).getByRole('link', { name: /explore/i });
      expect(exploreLink).toHaveAttribute('aria-current', 'page');

      const homeLink = within(nav).getByRole('link', { name: /home/i });
      expect(homeLink).not.toHaveAttribute('aria-current');
    });

    it('leaves both tabs uncurrent when the route is neither Home nor the sample collection', () => {
      window.location.hash = '#/collection/other-user-collection';
      renderWithProviders(<Layout {...defaultProps} sampleCollectionId="sample-vinyl-1" />);

      const nav = findBottomNav();
      expect(within(nav).getByRole('link', { name: /home/i })).not.toHaveAttribute('aria-current');
      expect(within(nav).getByRole('link', { name: /explore/i })).not.toHaveAttribute(
        'aria-current',
      );
    });

    it('does not set aria-current on the Add or Profile trigger buttons', () => {
      renderWithProviders(
        <Layout
          {...defaultProps}
          user={{ id: 'user-1', email: 'test@example.com' }}
          sampleCollectionId="sample-vinyl-1"
        />,
      );

      const nav = findBottomNav();
      const addButton = within(nav).getByText('Add').closest('button');
      const profileButton = within(nav).getByText('Profile').closest('button');
      expect(addButton).not.toHaveAttribute('aria-current');
      expect(profileButton).not.toHaveAttribute('aria-current');
    });
  });

  // CUR-153: the header status badge used to hang at -bottom-1/-right-1 —
  // half outside the account button, poking below the header edge — with no
  // accessible name, so it read as a rendering glitch instead of a trust cue.
  // Pin containment inside the button bounds and the accessible name/tooltip
  // (same status vocabulary as the profile menu chip) in every auth state.
  describe('CUR-153 Header status badge', () => {
    const authenticatedUser = { id: 'user-1', email: 'test@example.com' };

    it.each([
      { state: 'signed out', props: { user: null }, label: 'Signed Out' },
      { state: 'signed in', props: { user: authenticatedUser }, label: 'Signed In' },
      {
        state: 'unconfigured',
        props: { user: null, isSupabaseConfigured: false },
        label: 'Cloud Required',
      },
    ])('has an accessible name and tooltip when $state', ({ props, label }) => {
      renderWithProviders(<Layout {...defaultProps} {...props} />);

      const badge = screen.getByTestId('header-status-badge');
      expect(badge).toHaveAttribute('aria-label', label);
      expect(badge).toHaveAttribute('title', label);
    });

    // Screen readers flatten a button's descendants, so the badge's own
    // aria-label is not reliably announced; the status must reach the
    // account button itself as its accessible description.
    it.each([
      { state: 'signed out', props: { user: null }, label: 'Signed Out' },
      { state: 'signed in', props: { user: authenticatedUser }, label: 'Signed In' },
      {
        state: 'unconfigured',
        props: { user: null, isSupabaseConfigured: false },
        label: 'Cloud Required',
      },
    ])('describes the account button with the status when $state', ({ props, label }) => {
      renderWithProviders(<Layout {...defaultProps} {...props} />);

      const accountButton = screen.getByRole('button', { name: /account/i });
      expect(accountButton).toHaveAttribute('aria-describedby', 'header-status-badge');
      expect(accountButton).toHaveAccessibleDescription(label);
    });

    // CUR-158: once CUR-49 widened the signed-out control into a labelled
    // "Sign In" pill, a badge anchored to the button box floated off its
    // rounded bottom-right corner and read as a stray glyph. The badge is now
    // anchored to the account icon, so it hugs the glyph in both the icon-only
    // and pill layouts, in every auth state.
    it.each([
      { state: 'signed out', props: { user: null } },
      { state: 'signed in', props: { user: authenticatedUser } },
      { state: 'unconfigured', props: { user: null, isSupabaseConfigured: false } },
    ])(
      'anchors the status badge to the account icon, not the button box, when $state',
      ({ props }) => {
        renderWithProviders(<Layout {...defaultProps} {...props} />);

        const badge = screen.getByTestId('header-status-badge');
        const accountButton = screen.getByRole('button', { name: /account/i });

        // Anchored to the icon wrapper, not directly to the button box.
        expect(badge.parentElement).not.toBe(accountButton);
        expect(badge.parentElement).toHaveClass('relative');
        // Its positioning ancestor wraps the account glyph (the User icon svg).
        expect(badge.parentElement?.querySelector('svg')).toBeInTheDocument();
        // Hugs the icon's corner rather than the far corner of the wide pill.
        expect(badge.className).toContain('-bottom-0.5');
        expect(badge.className).toContain('-right-0.5');
      },
    );
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
