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
      // Make sign in take some time
      mockSignIn.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ user: { id: 'test' } }), 1000)),
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
    });

    it('disables form inputs during authentication', async () => {
      mockSignIn.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ user: { id: 'test' } }), 1000)),
      );

      const user = userEvent.setup();
      renderWithProviders(<AuthModal {...defaultProps} />);

      await user.type(screen.getByPlaceholderText(/curator@museum.com/i), 'test@example.com');
      await user.type(screen.getByPlaceholderText(/••••••••/), 'password123');

      const submitButton = screen.getByRole('button', { name: /sign in/i });
      await user.click(submitButton);

      // Check button becomes disabled while loading
      await waitFor(() => {
        expect(submitButton).toBeDisabled();
      });
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
});
