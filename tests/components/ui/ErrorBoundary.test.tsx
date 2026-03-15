import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';

// Component that throws an error
const ThrowError = ({ shouldThrow }: { shouldThrow: boolean }) => {
  if (shouldThrow) {
    throw new Error('Test error message');
  }
  return <div>Child content</div>;
};

describe('ErrorBoundary', () => {
  // Suppress console.error for these tests since we expect errors
  const originalConsoleError = console.error;

  beforeEach(() => {
    console.error = vi.fn();
  });

  afterEach(() => {
    console.error = originalConsoleError;
  });

  describe('Normal Rendering', () => {
    it('renders children when no error occurs', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={false} />
        </ErrorBoundary>,
      );

      expect(screen.getByText('Child content')).toBeInTheDocument();
    });

    it('does not show error UI when no error occurs', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={false} />
        </ErrorBoundary>,
      );

      expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('catches errors and displays error UI', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>,
      );

      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    });

    it('displays helpful message about data being safe', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>,
      );

      expect(
        screen.getByText(/The app encountered an unexpected error\. Your data is safe/),
      ).toBeInTheDocument();
    });

    it('shows reload button when error occurs', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>,
      );

      expect(screen.getByRole('button', { name: /reload app/i })).toBeInTheDocument();
    });

    it('reports error via captureError', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>,
      );

      expect(console.error).toHaveBeenCalledWith(
        '[ErrorReporting]',
        'Test error message',
        expect.objectContaining({ source: 'ErrorBoundary' }),
      );
    });
  });

  describe('Error Details Toggle', () => {
    it('shows "Show details" button initially', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>,
      );

      expect(screen.getByRole('button', { name: /show details/i })).toBeInTheDocument();
    });

    it('toggles to show error details when clicked', async () => {
      const user = userEvent.setup();

      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>,
      );

      await user.click(screen.getByRole('button', { name: /show details/i }));

      expect(screen.getByText('Test error message')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /hide details/i })).toBeInTheDocument();
    });

    it('hides error details when clicked again', async () => {
      const user = userEvent.setup();

      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>,
      );

      // Show details
      await user.click(screen.getByRole('button', { name: /show details/i }));
      expect(screen.getByText('Test error message')).toBeInTheDocument();

      // Hide details
      await user.click(screen.getByRole('button', { name: /hide details/i }));
      expect(screen.queryByText('Test error message')).not.toBeInTheDocument();
    });
  });

  describe('Reload Functionality', () => {
    it('calls window.location.reload when reload button is clicked', async () => {
      const user = userEvent.setup();
      const reloadMock = vi.fn();
      Object.defineProperty(window, 'location', {
        value: { reload: reloadMock },
        writable: true,
      });

      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>,
      );

      await user.click(screen.getByRole('button', { name: /reload app/i }));
      expect(reloadMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('Styling', () => {
    it('has proper container styling', () => {
      const { container } = render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>,
      );

      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper).toHaveClass('min-h-screen');
      expect(wrapper).toHaveClass('flex');
      expect(wrapper).toHaveClass('items-center');
      expect(wrapper).toHaveClass('justify-center');
    });

    it('shows error icon', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>,
      );

      // The AlertCircle icon should be present (in a red container)
      const iconContainer = document.querySelector('.bg-red-50');
      expect(iconContainer).toBeInTheDocument();
    });
  });
});
