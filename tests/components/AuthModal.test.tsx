import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../utils/test-utils';
import { AuthModal } from '@/components/AuthModal';

// Mock the supabase module
vi.mock('@/services/supabase', () => ({
  signInWithEmail: vi.fn(),
  signUpWithEmail: vi.fn(),
  isSupabaseConfigured: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  updateUserPassword: vi.fn(),
}));

// Mock the theme module to use our test theme context
vi.mock('@/theme', async () => {
  const actual = await vi.importActual('@/theme');
  return {
    ...actual,
    useTheme: () => ({ theme: 'gallery', setTheme: vi.fn() }),
  };
});

// Import the mocked functions
import {
  signInWithEmail,
  signUpWithEmail,
  isSupabaseConfigured,
  resetPasswordForEmail,
  updateUserPassword,
} from '@/services/supabase';

const mockSignIn = signInWithEmail as ReturnType<typeof vi.fn>;
const mockSignUp = signUpWithEmail as ReturnType<typeof vi.fn>;
const mockIsSupabaseConfigured = isSupabaseConfigured as ReturnType<typeof vi.fn>;
const mockResetPassword = resetPasswordForEmail as ReturnType<typeof vi.fn>;
const mockUpdatePassword = updateUserPassword as ReturnType<typeof vi.fn>;

describe('AuthModal', () => {
  const mockOnClose = vi.fn();
  const mockOnAuthSuccess = vi.fn();

  const defaultProps = {
    isOpen: true,
    onClose: mockOnClose,
    onAuthSuccess: mockOnAuthSuccess,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockIsSupabaseConfigured.mockReturnValue(true);
    mockSignIn.mockResolvedValue({ user: { id: 'test-user' } });
    mockSignUp.mockResolvedValue({ user: { id: 'test-user' } });
    mockResetPassword.mockResolvedValue(undefined);
    mockUpdatePassword.mockResolvedValue({ id: 'test-user' });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Modal Display', () => {
    it('renders nothing when isOpen is false', () => {
      renderWithProviders(<AuthModal {...defaultProps} isOpen={false} />);
      expect(screen.queryByText(/Sign In/i)).not.toBeInTheDocument();
    });

    it('renders modal when isOpen is true', () => {
      renderWithProviders(<AuthModal {...defaultProps} />);
      expect(screen.getByText(/Cloud Sync/i)).toBeInTheDocument();
    });

    it('displays close button that calls onClose when clicked', async () => {
      const user = userEvent.setup();
      renderWithProviders(<AuthModal {...defaultProps} />);

      const closeButton = screen.getByRole('button', { name: /close/i });
      await user.click(closeButton);
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('Supabase Not Configured', () => {
    beforeEach(() => {
      mockIsSupabaseConfigured.mockReturnValue(false);
    });

    it('shows cloud required message when Supabase is not configured', () => {
      renderWithProviders(<AuthModal {...defaultProps} />);

      expect(screen.getByText(/Cloud Required/i)).toBeInTheDocument();
    });

    it('shows close button that works when Supabase is not configured', async () => {
      const user = userEvent.setup();
      renderWithProviders(<AuthModal {...defaultProps} />);

      const closeButtons = screen.getAllByRole('button', { name: /close/i });
      await user.click(closeButtons[0]);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('Sign In Mode', () => {
    it('starts in sign in mode by default', () => {
      renderWithProviders(<AuthModal {...defaultProps} />);

      expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
    });

    it('displays email and password input fields', () => {
      renderWithProviders(<AuthModal {...defaultProps} />);

      expect(screen.getByPlaceholderText(/curator@museum.com/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/••••••••/)).toBeInTheDocument();
    });

    it('calls signInWithEmail with correct credentials on submit', async () => {
      const user = userEvent.setup();
      renderWithProviders(<AuthModal {...defaultProps} />);

      await user.type(screen.getByPlaceholderText(/curator@museum.com/i), 'test@example.com');
      await user.type(screen.getByPlaceholderText(/••••••••/), 'password123');
      await user.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() => {
        expect(mockSignIn).toHaveBeenCalledWith('test@example.com', 'password123');
      });
    });

    it('calls onAuthSuccess and onClose after successful sign in', async () => {
      const user = userEvent.setup();
      renderWithProviders(<AuthModal {...defaultProps} />);

      await user.type(screen.getByPlaceholderText(/curator@museum.com/i), 'test@example.com');
      await user.type(screen.getByPlaceholderText(/••••••••/), 'password123');
      await user.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() => {
        expect(mockOnAuthSuccess).toHaveBeenCalledTimes(1);
        expect(mockOnClose).toHaveBeenCalledTimes(1);
      });
    });

    it('displays error message on sign in failure', async () => {
      mockSignIn.mockRejectedValue(new Error('Invalid credentials'));
      const user = userEvent.setup();
      renderWithProviders(<AuthModal {...defaultProps} />);

      await user.type(screen.getByPlaceholderText(/curator@museum.com/i), 'test@example.com');
      await user.type(screen.getByPlaceholderText(/••••••••/), 'wrongpassword');
      await user.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() => {
        expect(screen.getByText(/Invalid credentials/i)).toBeInTheDocument();
      });
    });
  });

  describe('Sign Up Mode', () => {
    it('toggles to sign up mode when clicking "No account" link', async () => {
      const user = userEvent.setup();
      renderWithProviders(<AuthModal {...defaultProps} />);

      await user.click(screen.getByText(/Don't have an account/i));

      expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument();
    });

    it('calls signUpWithEmail with correct credentials on submit', async () => {
      const user = userEvent.setup();
      renderWithProviders(<AuthModal {...defaultProps} />);

      // Switch to sign up mode
      await user.click(screen.getByText(/Don't have an account/i));

      await user.type(screen.getByPlaceholderText(/curator@museum.com/i), 'newuser@example.com');
      await user.type(screen.getByPlaceholderText(/••••••••/), 'newpassword123');
      await user.click(screen.getByRole('button', { name: /create account/i }));

      await waitFor(() => {
        expect(mockSignUp).toHaveBeenCalledWith('newuser@example.com', 'newpassword123');
      });
    });

    it('displays error message on sign up failure', async () => {
      mockSignUp.mockRejectedValue(new Error('Email already exists'));
      const user = userEvent.setup();
      renderWithProviders(<AuthModal {...defaultProps} />);

      await user.click(screen.getByText(/Don't have an account/i));
      await user.type(screen.getByPlaceholderText(/curator@museum.com/i), 'existing@example.com');
      await user.type(screen.getByPlaceholderText(/••••••••/), 'password123');
      await user.click(screen.getByRole('button', { name: /create account/i }));

      await waitFor(() => {
        expect(screen.getByText(/Email already exists/i)).toBeInTheDocument();
      });
    });

    it('can toggle back to sign in mode', async () => {
      const user = userEvent.setup();
      renderWithProviders(<AuthModal {...defaultProps} />);

      // Switch to sign up
      await user.click(screen.getByText(/Don't have an account/i));
      expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument();

      // Switch back to sign in
      await user.click(screen.getByText(/Already have an account/i));
      expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
    });

    it('shows a consent line with Terms and Privacy Policy links in signup mode (CUR-57)', async () => {
      const user = userEvent.setup();
      renderWithProviders(<AuthModal {...defaultProps} />);

      // Consent line is hidden in sign-in mode.
      expect(screen.queryByTestId('signup-legal-consent')).not.toBeInTheDocument();

      // Switch to sign up.
      await user.click(screen.getByText(/Don't have an account/i));

      const consent = screen.getByTestId('signup-legal-consent');
      expect(consent).toBeInTheDocument();
      expect(consent.textContent).toMatch(/By creating an account/i);

      const termsLink = screen.getByRole('link', { name: /terms of service/i });
      const privacyLink = screen.getByRole('link', { name: /privacy policy/i });

      expect(termsLink).toHaveAttribute('href', '#/legal/terms');
      expect(termsLink).toHaveAttribute('target', '_blank');
      expect(termsLink).toHaveAttribute('rel', expect.stringContaining('noopener'));
      expect(privacyLink).toHaveAttribute('href', '#/legal/privacy');
      expect(privacyLink).toHaveAttribute('target', '_blank');
      expect(privacyLink).toHaveAttribute('rel', expect.stringContaining('noopener'));
    });

    it('hides the consent line outside signup mode', async () => {
      const user = userEvent.setup();
      renderWithProviders(<AuthModal {...defaultProps} />);

      expect(screen.queryByTestId('signup-legal-consent')).not.toBeInTheDocument();

      // Forgot password flow should also not show the consent.
      await user.click(screen.getByRole('button', { name: /forgot password/i }));
      expect(screen.queryByTestId('signup-legal-consent')).not.toBeInTheDocument();
    });
  });

  describe('Form Validation', () => {
    it('email input has required attribute', () => {
      renderWithProviders(<AuthModal {...defaultProps} />);
      expect(screen.getByPlaceholderText(/curator@museum.com/i)).toHaveAttribute('required');
    });

    it('password input has required attribute', () => {
      renderWithProviders(<AuthModal {...defaultProps} />);
      expect(screen.getByPlaceholderText(/••••••••/)).toHaveAttribute('required');
    });

    it('email input has correct type', () => {
      renderWithProviders(<AuthModal {...defaultProps} />);
      expect(screen.getByPlaceholderText(/curator@museum.com/i)).toHaveAttribute('type', 'email');
    });

    it('password input has correct type', () => {
      renderWithProviders(<AuthModal {...defaultProps} />);
      expect(screen.getByPlaceholderText(/••••••••/)).toHaveAttribute('type', 'password');
    });
  });

  describe('Loading State', () => {
    it('shows loading indicator during authentication', async () => {
      let resolveSignIn!: (v: { user: { id: string } }) => void;
      mockSignIn.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveSignIn = resolve;
          }),
      );

      const user = userEvent.setup();
      renderWithProviders(<AuthModal {...defaultProps} />);

      await user.type(screen.getByPlaceholderText(/curator@museum.com/i), 'test@example.com');
      await user.type(screen.getByPlaceholderText(/••••••••/), 'password123');

      const submitButton = screen.getByRole('button', { name: /sign in/i });
      await user.click(submitButton);

      // Button should be disabled during loading
      await waitFor(() => {
        expect(submitButton).toBeDisabled();
      });

      resolveSignIn({ user: { id: 'test' } });
      await waitFor(() => expect(mockOnAuthSuccess).toHaveBeenCalled());
    });

    it('shows "Signing in…" label and aria-busy on submit during sign-in', async () => {
      let resolveSignIn!: (v: { user: { id: string } }) => void;
      mockSignIn.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveSignIn = resolve;
          }),
      );

      const user = userEvent.setup();
      renderWithProviders(<AuthModal {...defaultProps} />);

      await user.type(screen.getByPlaceholderText(/curator@museum.com/i), 'test@example.com');
      await user.type(screen.getByPlaceholderText(/••••••••/), 'password123');
      await user.click(screen.getByRole('button', { name: /sign in/i }));

      const busyButton = await screen.findByRole('button', { name: /signing in/i });
      expect(busyButton).toHaveAttribute('aria-busy', 'true');
      expect(busyButton).toBeDisabled();

      // Resolve the pending sign-in so the component finishes its work and
      // does not leak a pending promise into later tests.
      resolveSignIn({ user: { id: 'test' } });
      await waitFor(() => expect(mockOnAuthSuccess).toHaveBeenCalled());
    });

    it('shows "Creating account…" label on submit during sign-up', async () => {
      let resolveSignUp!: (v: { user: { id: string } }) => void;
      mockSignUp.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveSignUp = resolve;
          }),
      );

      const user = userEvent.setup();
      renderWithProviders(<AuthModal {...defaultProps} />);

      await user.click(screen.getByText(/Don't have an account/i));
      await user.type(screen.getByPlaceholderText(/curator@museum.com/i), 'new@example.com');
      await user.type(screen.getByPlaceholderText(/••••••••/), 'password123');
      await user.click(screen.getByRole('button', { name: /create account/i }));

      const busyButton = await screen.findByRole('button', { name: /creating account/i });
      expect(busyButton).toHaveAttribute('aria-busy', 'true');

      resolveSignUp({ user: { id: 'test' } });
      await waitFor(() => expect(mockOnAuthSuccess).toHaveBeenCalled());
    });

    it('disables form inputs during authentication', async () => {
      let resolveSignIn!: (v: { user: { id: string } }) => void;
      mockSignIn.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveSignIn = resolve;
          }),
      );

      const user = userEvent.setup();
      renderWithProviders(<AuthModal {...defaultProps} />);

      const emailInput = screen.getByPlaceholderText(/curator@museum.com/i);
      const passwordInput = screen.getByPlaceholderText(/••••••••/);
      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'password123');
      await user.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() => {
        expect(emailInput).toBeDisabled();
        expect(passwordInput).toBeDisabled();
      });

      resolveSignIn({ user: { id: 'test' } });
      await waitFor(() => expect(mockOnAuthSuccess).toHaveBeenCalled());
    });
  });

  describe('Cloud Sync Information', () => {
    it('displays cloud sync information section', () => {
      renderWithProviders(<AuthModal {...defaultProps} />);

      expect(screen.getByText(/Cloud Sync/i)).toBeInTheDocument();
    });

    it('shows privacy and speed info cards', () => {
      renderWithProviders(<AuthModal {...defaultProps} />);

      expect(screen.getByText(/Private/i)).toBeInTheDocument();
      expect(screen.getByText(/Fast/i)).toBeInTheDocument();
    });
  });

  describe('Theme Support', () => {
    it('renders correctly with gallery theme', () => {
      renderWithProviders(<AuthModal {...defaultProps} />, { initialTheme: 'gallery' });
      expect(screen.getByText(/Cloud Sync/i)).toBeInTheDocument();
    });

    it('renders correctly with vault theme', () => {
      renderWithProviders(<AuthModal {...defaultProps} />, { initialTheme: 'vault' });
      expect(screen.getByText(/Cloud Sync/i)).toBeInTheDocument();
    });

    it('renders correctly with atelier theme', () => {
      renderWithProviders(<AuthModal {...defaultProps} />, { initialTheme: 'atelier' });
      expect(screen.getByText(/Cloud Sync/i)).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has proper form structure', () => {
      renderWithProviders(<AuthModal {...defaultProps} />);

      const form = document.querySelector('form');
      expect(form).toBeInTheDocument();
    });

    it('has proper input fields with placeholders', () => {
      renderWithProviders(<AuthModal {...defaultProps} />);

      const emailInput = screen.getByPlaceholderText(/curator@museum.com/i);
      const passwordInput = screen.getByPlaceholderText(/••••••••/);

      expect(emailInput).toBeInTheDocument();
      expect(passwordInput).toBeInTheDocument();
    });

    it('submit button has proper type', () => {
      renderWithProviders(<AuthModal {...defaultProps} />);

      const submitButton = screen.getByRole('button', { name: /sign in/i });
      expect(submitButton).toHaveAttribute('type', 'submit');
    });
  });

  describe('Forgot Password Flow', () => {
    it('shows a "Forgot password" link in sign-in mode', () => {
      renderWithProviders(<AuthModal {...defaultProps} />);
      expect(screen.getByRole('button', { name: /forgot password/i })).toBeInTheDocument();
    });

    it('switches to reset-request mode and hides the password field', async () => {
      const user = userEvent.setup();
      renderWithProviders(<AuthModal {...defaultProps} />);

      await user.click(screen.getByRole('button', { name: /forgot password/i }));

      expect(screen.getByRole('button', { name: /send reset link/i })).toBeInTheDocument();
      expect(screen.queryByPlaceholderText(/••••••••/)).not.toBeInTheDocument();
      expect(screen.getByPlaceholderText(/curator@museum.com/i)).toBeInTheDocument();
    });

    it('calls resetPasswordForEmail and shows confirmation copy', async () => {
      const user = userEvent.setup();
      renderWithProviders(<AuthModal {...defaultProps} />);

      await user.click(screen.getByRole('button', { name: /forgot password/i }));
      await user.type(screen.getByPlaceholderText(/curator@museum.com/i), 'lost@example.com');
      await user.click(screen.getByRole('button', { name: /send reset link/i }));

      await waitFor(() => {
        expect(mockResetPassword).toHaveBeenCalledWith('lost@example.com');
      });
      expect(await screen.findByText(/check your email/i)).toBeInTheDocument();
      expect(screen.getByText(/lost@example\.com/)).toBeInTheDocument();
      // No submit button in the confirmation view — only "Back to sign in".
      expect(screen.queryByRole('button', { name: /send reset link/i })).not.toBeInTheDocument();
    });

    it('lets the user return to sign-in from the reset flow', async () => {
      const user = userEvent.setup();
      renderWithProviders(<AuthModal {...defaultProps} />);

      await user.click(screen.getByRole('button', { name: /forgot password/i }));
      await user.click(screen.getByRole('button', { name: /back to sign in/i }));

      expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
    });

    it('surfaces a reset failure as an error', async () => {
      mockResetPassword.mockRejectedValue(new Error('Email rate limit exceeded'));
      const user = userEvent.setup();
      renderWithProviders(<AuthModal {...defaultProps} />);

      await user.click(screen.getByRole('button', { name: /forgot password/i }));
      await user.type(screen.getByPlaceholderText(/curator@museum.com/i), 'lost@example.com');
      await user.click(screen.getByRole('button', { name: /send reset link/i }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(/rate limit/i);
      });
      expect(screen.queryByText(/check your email/i)).not.toBeInTheDocument();
    });
  });

  describe('CUR-285: Resend / use-different-email on reset-sent', () => {
    const sendInitialReset = async (
      user: ReturnType<typeof userEvent.setup>,
      email = 'lost@example.com',
    ) => {
      await user.click(screen.getByRole('button', { name: /forgot password/i }));
      const emailInput = screen.getByPlaceholderText(/curator@museum.com/i);
      // Clear in case a prior round of this helper left the input populated;
      // an unset clear would concatenate addresses and fail HTML5 validation.
      await user.clear(emailInput);
      await user.type(emailInput, email);
      await user.click(screen.getByRole('button', { name: /send reset link/i }));
      await screen.findByText(/check your email/i);
    };

    it('shows a Resend link button and a Use different email link on the sent screen', async () => {
      const user = userEvent.setup();
      renderWithProviders(<AuthModal {...defaultProps} />);
      await sendInitialReset(user);

      expect(screen.getByRole('button', { name: /resend link/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /use a different email/i })).toBeInTheDocument();
      // Submit "Send reset link" must stay hidden so it doesn't compete with Resend.
      expect(screen.queryByRole('button', { name: /send reset link/i })).not.toBeInTheDocument();
    });

    it('re-fires resetPasswordForEmail for the sent address and shows a sent confirmation', async () => {
      const user = userEvent.setup();
      renderWithProviders(<AuthModal {...defaultProps} />);
      await sendInitialReset(user);

      mockResetPassword.mockClear();
      await user.click(screen.getByRole('button', { name: /resend link/i }));

      await waitFor(() => {
        expect(mockResetPassword).toHaveBeenCalledWith('lost@example.com');
      });
      expect(await screen.findByText(/sent again/i)).toBeInTheDocument();
    });

    it('starts a ~30s cooldown after a successful resend', async () => {
      const user = userEvent.setup();
      renderWithProviders(<AuthModal {...defaultProps} />);
      await sendInitialReset(user);

      await user.click(screen.getByRole('button', { name: /resend link/i }));
      await screen.findByText(/sent again/i);

      const cooldownButton = await screen.findByRole('button', { name: /resend in 30s/i });
      expect(cooldownButton).toBeDisabled();
    });

    it('surfaces an error inline when the resend call fails', async () => {
      const user = userEvent.setup();
      renderWithProviders(<AuthModal {...defaultProps} />);
      await sendInitialReset(user);

      mockResetPassword.mockRejectedValueOnce(new Error('boom'));
      await user.click(screen.getByRole('button', { name: /resend link/i }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(/couldn't resend/i);
      });
      // No cooldown should start on failure — the button remains pressable.
      expect(screen.getByRole('button', { name: /resend link/i })).not.toBeDisabled();
    });

    it('returns to reset-request with the previous email prefilled on Use different email', async () => {
      const user = userEvent.setup();
      renderWithProviders(<AuthModal {...defaultProps} />);
      await sendInitialReset(user);

      await user.click(screen.getByRole('button', { name: /use a different email/i }));

      const email = await screen.findByPlaceholderText(/curator@museum.com/i);
      expect(email).toHaveValue('lost@example.com');
      expect(screen.getByRole('button', { name: /send reset link/i })).toBeInTheDocument();
    });

    it('clears stale resend status / cooldown when a new reset request is sent', async () => {
      const user = userEvent.setup();
      renderWithProviders(<AuthModal {...defaultProps} />);

      // First round: send → resend → cooldown is now active.
      await sendInitialReset(user, 'first@example.com');
      await user.click(screen.getByRole('button', { name: /resend link/i }));
      await screen.findByText(/sent again/i);
      expect(await screen.findByRole('button', { name: /resend in 30s/i })).toBeDisabled();

      // Navigate back to sign-in and start a brand-new reset for a different email.
      await user.click(screen.getByRole('button', { name: /back to sign in/i }));
      await sendInitialReset(user, 'second@example.com');

      // The fresh reset-sent screen must not carry over the prior "Sent again"
      // microcopy or the locked-out Resend button.
      expect(screen.queryByText(/sent again/i)).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /resend in \d+s/i })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /resend link/i })).not.toBeDisabled();
    });
  });

  describe('Set Password Mode (recovery redirect)', () => {
    it('opens in set-password mode when initialMode is set', () => {
      renderWithProviders(<AuthModal {...defaultProps} initialMode="set-password" />);
      expect(screen.getByRole('button', { name: /save password/i })).toBeInTheDocument();
      expect(screen.queryByPlaceholderText(/curator@museum.com/i)).not.toBeInTheDocument();
    });

    it('rejects passwords shorter than 8 characters without calling the service', async () => {
      const user = userEvent.setup();
      renderWithProviders(<AuthModal {...defaultProps} initialMode="set-password" />);

      const newField = screen.getByLabelText('New password');
      const confirmField = screen.getByLabelText('Confirm password');
      // Strip the HTML5 minLength so we can exercise our own validation branch.
      newField.removeAttribute('minLength');
      confirmField.removeAttribute('minLength');

      await user.type(newField, 'short');
      await user.type(confirmField, 'short');
      await user.click(screen.getByRole('button', { name: /save password/i }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(/at least 8/i);
      });
      expect(mockUpdatePassword).not.toHaveBeenCalled();
    });

    it('rejects mismatched confirmation without calling the service', async () => {
      const user = userEvent.setup();
      renderWithProviders(<AuthModal {...defaultProps} initialMode="set-password" />);

      await user.type(screen.getByLabelText('New password'), 'longenough1');
      await user.type(screen.getByLabelText('Confirm password'), 'different1!');
      await user.click(screen.getByRole('button', { name: /save password/i }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(/don't match/i);
      });
      expect(mockUpdatePassword).not.toHaveBeenCalled();
    });

    it('saves a valid new password and signals success', async () => {
      const user = userEvent.setup();
      renderWithProviders(<AuthModal {...defaultProps} initialMode="set-password" />);

      await user.type(screen.getByLabelText('New password'), 'brandnewpass1');
      await user.type(screen.getByLabelText('Confirm password'), 'brandnewpass1');
      await user.click(screen.getByRole('button', { name: /save password/i }));

      await waitFor(() => {
        expect(mockUpdatePassword).toHaveBeenCalledWith('brandnewpass1');
        expect(mockOnAuthSuccess).toHaveBeenCalledTimes(1);
        expect(mockOnClose).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('CUR-68: password reveal + min-length hint', () => {
    it('starts with the password input masked', () => {
      renderWithProviders(<AuthModal {...defaultProps} />);
      expect(screen.getByPlaceholderText(/••••••••/)).toHaveAttribute('type', 'password');
      expect(screen.getByRole('button', { name: /show password/i })).toHaveAttribute(
        'aria-pressed',
        'false',
      );
    });

    it('reveals and re-hides the password when the toggle is clicked', async () => {
      const user = userEvent.setup();
      renderWithProviders(<AuthModal {...defaultProps} />);

      const input = screen.getByPlaceholderText(/••••••••/);
      await user.type(input, 'mysecret1');

      const toggle = screen.getByRole('button', { name: /show password/i });
      await user.click(toggle);

      expect(input).toHaveAttribute('type', 'text');
      const hideToggle = screen.getByRole('button', { name: /hide password/i });
      expect(hideToggle).toHaveAttribute('aria-pressed', 'true');

      await user.click(hideToggle);
      expect(input).toHaveAttribute('type', 'password');
      expect(screen.getByRole('button', { name: /show password/i })).toHaveAttribute(
        'aria-pressed',
        'false',
      );
    });

    it('does not show the min-length hint in sign-in mode', () => {
      renderWithProviders(<AuthModal {...defaultProps} />);
      expect(screen.queryByText(/At least 8 characters/i)).not.toBeInTheDocument();
    });

    it('shows the min-length hint in sign-up mode', async () => {
      const user = userEvent.setup();
      renderWithProviders(<AuthModal {...defaultProps} />);

      await user.click(screen.getByText(/Don't have an account/i));

      expect(screen.getByText(/At least 8 characters/i)).toBeInTheDocument();
    });

    it('blocks a short sign-up password client-side and surfaces friendly copy', async () => {
      const user = userEvent.setup();
      renderWithProviders(<AuthModal {...defaultProps} />);

      await user.click(screen.getByText(/Don't have an account/i));
      const password = screen.getByPlaceholderText(/••••••••/);
      // Sign-up password input must NOT carry the native `minLength` HTML
      // attribute, otherwise the browser blocks submit before React's
      // handler runs and the translated `passwordTooShort` copy never
      // surfaces. The JS guard in handleSubmit is the source of truth.
      expect(password).not.toHaveAttribute('minLength');

      await user.type(screen.getByPlaceholderText(/curator@museum.com/i), 'new@example.com');
      await user.type(password, 'short');
      await user.click(screen.getByRole('button', { name: /create account/i }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(/at least 8 characters/i);
      });
      expect(mockSignUp).not.toHaveBeenCalled();
    });

    it('maps a backend "password too short" error to friendly copy on sign-up', async () => {
      mockSignUp.mockRejectedValue(new Error('Password should be at least 6 characters.'));
      const user = userEvent.setup();
      renderWithProviders(<AuthModal {...defaultProps} />);

      await user.click(screen.getByText(/Don't have an account/i));
      await user.type(screen.getByPlaceholderText(/curator@museum.com/i), 'new@example.com');
      await user.type(screen.getByPlaceholderText(/••••••••/), 'longenoughpass1');
      await user.click(screen.getByRole('button', { name: /create account/i }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(/use at least 8 characters/i);
      });
    });

    it('renders independent toggles for new and confirm password inputs', () => {
      renderWithProviders(<AuthModal {...defaultProps} initialMode="set-password" />);

      const newPasswordInput = screen.getByLabelText('New password');
      const confirmPasswordInput = screen.getByLabelText('Confirm password');
      expect(newPasswordInput).toHaveAttribute('type', 'password');
      expect(confirmPasswordInput).toHaveAttribute('type', 'password');

      const toggles = screen.getAllByRole('button', { name: /show password/i });
      expect(toggles).toHaveLength(2);
    });

    it('toggles the new-password input without affecting the confirm-password input', async () => {
      const user = userEvent.setup();
      renderWithProviders(<AuthModal {...defaultProps} initialMode="set-password" />);

      const newPasswordInput = screen.getByLabelText('New password');
      const confirmPasswordInput = screen.getByLabelText('Confirm password');

      const toggles = screen.getAllByRole('button', { name: /show password/i });
      await user.click(toggles[0]);

      expect(newPasswordInput).toHaveAttribute('type', 'text');
      expect(confirmPasswordInput).toHaveAttribute('type', 'password');
    });

    it('resets the reveal state when the modal closes and reopens', async () => {
      const user = userEvent.setup();
      const { rerender } = renderWithProviders(<AuthModal {...defaultProps} />);

      await user.click(screen.getByRole('button', { name: /show password/i }));
      expect(screen.getByPlaceholderText(/••••••••/)).toHaveAttribute('type', 'text');

      rerender(<AuthModal {...defaultProps} isOpen={false} />);
      rerender(<AuthModal {...defaultProps} isOpen={true} />);

      expect(screen.getByPlaceholderText(/••••••••/)).toHaveAttribute('type', 'password');
    });
  });
});
