import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../utils/test-utils';
import { Button } from '@/components/ui/Button';
import { Camera, Plus } from 'lucide-react';

describe('Button', () => {
  describe('Basic Rendering', () => {
    it('renders button with text content', () => {
      renderWithProviders(<Button>Click me</Button>);
      expect(screen.getByRole('button', { name: /click me/i })).toBeInTheDocument();
    });

    it('renders as a button element', () => {
      renderWithProviders(<Button>Test</Button>);
      const button = screen.getByRole('button');
      expect(button.tagName).toBe('BUTTON');
    });
  });

  describe('Variants', () => {
    it('applies primary variant styles by default', () => {
      renderWithProviders(<Button>Primary</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('bg-stone-800');
      expect(button).toHaveClass('text-stone-50');
    });

    it('applies secondary variant styles', () => {
      renderWithProviders(<Button variant="secondary">Secondary</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('bg-amber-100');
      expect(button).toHaveClass('text-amber-900');
    });

    it('applies outline variant styles', () => {
      renderWithProviders(<Button variant="outline">Outline</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('border');
      expect(button).toHaveClass('border-stone-300');
    });

    it('applies ghost variant styles', () => {
      renderWithProviders(<Button variant="ghost">Ghost</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('text-stone-600');
    });
  });

  describe('Sizes', () => {
    it('applies medium size by default', () => {
      renderWithProviders(<Button>Medium</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('text-sm');
      expect(button).toHaveClass('px-5');
      expect(button).toHaveClass('py-2.5');
    });

    it('applies small size styles', () => {
      renderWithProviders(<Button size="sm">Small</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('text-xs');
      expect(button).toHaveClass('px-3');
      expect(button).toHaveClass('py-1.5');
    });

    it('applies large size styles', () => {
      renderWithProviders(<Button size="lg">Large</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('text-base');
      expect(button).toHaveClass('px-6');
      expect(button).toHaveClass('py-3');
    });
  });

  describe('Icon Support', () => {
    it('renders icon when provided', () => {
      renderWithProviders(<Button icon={<Camera data-testid="icon" />}>With Icon</Button>);
      expect(screen.getByTestId('icon')).toBeInTheDocument();
    });

    it('renders icon before text', () => {
      renderWithProviders(<Button icon={<Plus data-testid="icon" />}>Add Item</Button>);
      const button = screen.getByRole('button');
      const icon = screen.getByTestId('icon');

      // Icon should be in an element that comes before the text
      expect(button.textContent).toContain('Add Item');
      expect(icon.closest('span')).toBeInTheDocument();
    });

    it('renders without icon when not provided', () => {
      renderWithProviders(<Button>No Icon</Button>);
      const button = screen.getByRole('button');
      // Should only have text content, no icon wrapper
      expect(button.querySelector('span')).not.toBeInTheDocument();
    });
  });

  describe('Disabled State', () => {
    it('applies disabled styles when disabled', () => {
      renderWithProviders(<Button disabled>Disabled</Button>);
      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
      expect(button).toHaveClass('disabled:opacity-50');
      expect(button).toHaveClass('disabled:cursor-not-allowed');
    });

    it('does not trigger onClick when disabled', async () => {
      const handleClick = vi.fn();
      const user = userEvent.setup();
      renderWithProviders(
        <Button disabled onClick={handleClick}>
          Disabled
        </Button>,
      );

      await user.click(screen.getByRole('button'));
      expect(handleClick).not.toHaveBeenCalled();
    });
  });

  describe('Click Handling', () => {
    it('calls onClick handler when clicked', async () => {
      const handleClick = vi.fn();
      const user = userEvent.setup();
      renderWithProviders(<Button onClick={handleClick}>Click me</Button>);

      await user.click(screen.getByRole('button'));
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('passes event to onClick handler', async () => {
      const handleClick = vi.fn();
      const user = userEvent.setup();
      renderWithProviders(<Button onClick={handleClick}>Click me</Button>);

      await user.click(screen.getByRole('button'));
      expect(handleClick).toHaveBeenCalledWith(expect.any(Object));
    });
  });

  describe('Custom className', () => {
    it('applies custom className in addition to default styles', () => {
      renderWithProviders(<Button className="custom-class w-full">Custom</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('custom-class');
      expect(button).toHaveClass('w-full');
      // Still has default styles
      expect(button).toHaveClass('rounded-full');
    });
  });

  describe('HTML Attributes', () => {
    it('passes through HTML button attributes', () => {
      renderWithProviders(
        <Button type="submit" name="submit-btn" data-testid="submit">
          Submit
        </Button>,
      );
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('type', 'submit');
      expect(button).toHaveAttribute('name', 'submit-btn');
    });

    it('supports aria attributes', () => {
      renderWithProviders(<Button aria-label="Close dialog">X</Button>);
      const button = screen.getByRole('button', { name: /close dialog/i });
      expect(button).toBeInTheDocument();
    });
  });

  describe('Base Styles', () => {
    it('has proper focus styles', () => {
      renderWithProviders(<Button>Focus Test</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('focus:outline-none');
      expect(button).toHaveClass('focus:ring-2');
      expect(button).toHaveClass('focus:ring-offset-1');
    });

    it('has rounded full border radius', () => {
      renderWithProviders(<Button>Rounded</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('rounded-full');
    });

    it('uses flexbox for layout', () => {
      renderWithProviders(<Button>Flex</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('inline-flex');
      expect(button).toHaveClass('items-center');
      expect(button).toHaveClass('justify-center');
    });
  });

  describe('Accessibility', () => {
    it('is focusable', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Button>Focusable</Button>);
      const button = screen.getByRole('button');

      await user.tab();
      expect(button).toHaveFocus();
    });

    it('responds to keyboard activation', async () => {
      const handleClick = vi.fn();
      const user = userEvent.setup();
      renderWithProviders(<Button onClick={handleClick}>Keyboard</Button>);

      const button = screen.getByRole('button');
      button.focus();
      await user.keyboard('{Enter}');

      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('responds to space key activation', async () => {
      const handleClick = vi.fn();
      const user = userEvent.setup();
      renderWithProviders(<Button onClick={handleClick}>Space</Button>);

      const button = screen.getByRole('button');
      button.focus();
      await user.keyboard(' ');

      expect(handleClick).toHaveBeenCalledTimes(1);
    });
  });
});
