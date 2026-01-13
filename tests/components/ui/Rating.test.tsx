import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../utils/test-utils';
import { Rating } from '@/components/ui/Rating';

describe('Rating', () => {
  describe('Basic Rendering', () => {
    it('renders 5 stars by default', () => {
      renderWithProviders(<Rating value={3} />);
      const buttons = screen.getAllByRole('button');
      expect(buttons).toHaveLength(5);
    });

    it('renders correct number of stars when max is specified', () => {
      renderWithProviders(<Rating value={2} max={3} />);
      const buttons = screen.getAllByRole('button');
      expect(buttons).toHaveLength(3);
    });

    it('has correct aria-label', () => {
      renderWithProviders(<Rating value={3} max={5} />);
      const rating = screen.getByRole('img');
      expect(rating).toHaveAttribute('aria-label', '3 out of 5 stars');
    });
  });

  describe('Value Display', () => {
    it('displays correct number of filled stars', () => {
      renderWithProviders(<Rating value={3} />);
      const stars = screen.getAllByRole('button');

      // First 3 stars should have fill-current class (filled)
      stars.slice(0, 3).forEach((star) => {
        expect(star.querySelector('svg')).toHaveClass('fill-current');
      });
    });

    it('displays correct number of empty stars', () => {
      renderWithProviders(<Rating value={2} max={5} />);
      const stars = screen.getAllByRole('button');

      // Stars 3, 4, 5 should not have fill-current class (empty)
      stars.slice(2).forEach((star) => {
        expect(star.querySelector('svg')).not.toHaveClass('fill-current');
      });
    });

    it('handles zero value correctly', () => {
      renderWithProviders(<Rating value={0} />);
      const stars = screen.getAllByRole('button');

      // All stars should be empty
      stars.forEach((star) => {
        expect(star.querySelector('svg')).not.toHaveClass('fill-current');
      });
    });

    it('handles max value correctly', () => {
      renderWithProviders(<Rating value={5} max={5} />);
      const stars = screen.getAllByRole('button');

      // All stars should be filled
      stars.forEach((star) => {
        expect(star.querySelector('svg')).toHaveClass('fill-current');
      });
    });
  });

  describe('Sizes', () => {
    it('applies small size classes', () => {
      renderWithProviders(<Rating value={3} size="sm" />);
      const star = screen.getAllByRole('button')[0].querySelector('svg');
      expect(star).toHaveClass('w-3');
      expect(star).toHaveClass('h-3');
    });

    it('applies medium size classes by default', () => {
      renderWithProviders(<Rating value={3} />);
      const star = screen.getAllByRole('button')[0].querySelector('svg');
      expect(star).toHaveClass('w-4');
      expect(star).toHaveClass('h-4');
    });

    it('applies large size classes', () => {
      renderWithProviders(<Rating value={3} size="lg" />);
      const star = screen.getAllByRole('button')[0].querySelector('svg');
      expect(star).toHaveClass('w-5');
      expect(star).toHaveClass('h-5');
    });
  });

  describe('Interactive Mode', () => {
    it('is not interactive by default', () => {
      renderWithProviders(<Rating value={3} />);
      const stars = screen.getAllByRole('button');

      stars.forEach((star) => {
        expect(star).toBeDisabled();
      });
    });

    it('is interactive when onChange is provided', () => {
      const handleChange = vi.fn();
      renderWithProviders(<Rating value={3} onChange={handleChange} />);
      const stars = screen.getAllByRole('button');

      stars.forEach((star) => {
        expect(star).not.toBeDisabled();
      });
    });

    it('calls onChange with correct value when star is clicked', async () => {
      const handleChange = vi.fn();
      const user = userEvent.setup();
      renderWithProviders(<Rating value={2} onChange={handleChange} />);

      const stars = screen.getAllByRole('button');
      await user.click(stars[3]); // Click 4th star

      expect(handleChange).toHaveBeenCalledWith(4);
    });

    it('applies hover styles in interactive mode', () => {
      const handleChange = vi.fn();
      renderWithProviders(<Rating value={3} onChange={handleChange} />);
      const star = screen.getAllByRole('button')[0];

      expect(star).toHaveClass('cursor-pointer');
      expect(star).toHaveClass('hover:scale-110');
    });

    it('applies default cursor in non-interactive mode', () => {
      renderWithProviders(<Rating value={3} />);
      const star = screen.getAllByRole('button')[0];

      expect(star).toHaveClass('cursor-default');
    });
  });

  describe('Custom className', () => {
    it('applies custom className to container', () => {
      renderWithProviders(<Rating value={3} className="custom-class" />);
      const container = screen.getByRole('img');
      expect(container).toHaveClass('custom-class');
    });
  });

  describe('Theme Integration', () => {
    it('applies theme-specific colors (default gallery theme)', () => {
      renderWithProviders(<Rating value={3} />);
      const filledStar = screen.getAllByRole('button')[0].querySelector('svg');
      // Default theme is gallery which uses text-amber-500
      expect(filledStar).toHaveClass('text-amber-500');
    });
  });

  describe('Accessibility', () => {
    it('has img role for the container', () => {
      renderWithProviders(<Rating value={3} />);
      expect(screen.getByRole('img')).toBeInTheDocument();
    });

    it('has aria-label for each star button', () => {
      renderWithProviders(<Rating value={3} />);
      const stars = screen.getAllByRole('button');

      expect(stars[0]).toHaveAttribute('aria-label', '1 star');
      expect(stars[1]).toHaveAttribute('aria-label', '2 stars');
      expect(stars[4]).toHaveAttribute('aria-label', '5 stars');
    });
  });
});
