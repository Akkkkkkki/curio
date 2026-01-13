import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../utils/test-utils';
import { Divider } from '@/components/ui/Divider';

describe('Divider', () => {
  describe('Basic Rendering', () => {
    it('renders horizontal divider by default', () => {
      renderWithProviders(<Divider />);
      const divider = screen.getByRole('separator');
      expect(divider).toBeInTheDocument();
      expect(divider).toHaveAttribute('aria-orientation', 'horizontal');
    });

    it('renders as hr element for horizontal orientation', () => {
      renderWithProviders(<Divider />);
      const divider = screen.getByRole('separator');
      expect(divider.tagName).toBe('HR');
    });
  });

  describe('Orientation', () => {
    it('renders vertical divider when orientation is vertical', () => {
      renderWithProviders(<Divider orientation="vertical" />);
      const divider = screen.getByRole('separator');
      expect(divider).toHaveAttribute('aria-orientation', 'vertical');
    });

    it('renders as div element for vertical orientation', () => {
      renderWithProviders(<Divider orientation="vertical" />);
      const divider = screen.getByRole('separator');
      expect(divider.tagName).toBe('DIV');
    });

    it('applies border-l class for vertical orientation', () => {
      renderWithProviders(<Divider orientation="vertical" />);
      const divider = screen.getByRole('separator');
      expect(divider).toHaveClass('border-l');
    });

    it('applies border-t class for horizontal orientation', () => {
      renderWithProviders(<Divider orientation="horizontal" />);
      const divider = screen.getByRole('separator');
      expect(divider).toHaveClass('border-t');
    });
  });

  describe('Spacing', () => {
    it('applies no spacing by default', () => {
      renderWithProviders(<Divider />);
      const divider = screen.getByRole('separator');
      expect(divider).not.toHaveClass('my-2');
      expect(divider).not.toHaveClass('my-4');
      expect(divider).not.toHaveClass('my-8');
    });

    it('applies small spacing when spacing is sm', () => {
      renderWithProviders(<Divider spacing="sm" />);
      const divider = screen.getByRole('separator');
      expect(divider).toHaveClass('my-2');
    });

    it('applies medium spacing when spacing is md', () => {
      renderWithProviders(<Divider spacing="md" />);
      const divider = screen.getByRole('separator');
      expect(divider).toHaveClass('my-4');
    });

    it('applies large spacing when spacing is lg', () => {
      renderWithProviders(<Divider spacing="lg" />);
      const divider = screen.getByRole('separator');
      expect(divider).toHaveClass('my-8');
    });

    it('applies horizontal spacing for vertical divider', () => {
      renderWithProviders(<Divider orientation="vertical" spacing="md" />);
      const divider = screen.getByRole('separator');
      expect(divider).toHaveClass('mx-4');
    });
  });

  describe('Custom className', () => {
    it('applies custom className in addition to default styles', () => {
      renderWithProviders(<Divider className="custom-class" />);
      const divider = screen.getByRole('separator');
      expect(divider).toHaveClass('custom-class');
      expect(divider).toHaveClass('border-t');
    });
  });

  describe('Theme Integration', () => {
    it('applies theme-specific border color (default gallery theme)', () => {
      renderWithProviders(<Divider />);
      const divider = screen.getByRole('separator');
      // Default theme is gallery which uses border-stone-200
      expect(divider).toHaveClass('border-stone-200');
    });
  });

  describe('Accessibility', () => {
    it('has separator role', () => {
      renderWithProviders(<Divider />);
      expect(screen.getByRole('separator')).toBeInTheDocument();
    });

    it('has correct aria-orientation for horizontal', () => {
      renderWithProviders(<Divider orientation="horizontal" />);
      const divider = screen.getByRole('separator');
      expect(divider).toHaveAttribute('aria-orientation', 'horizontal');
    });

    it('has correct aria-orientation for vertical', () => {
      renderWithProviders(<Divider orientation="vertical" />);
      const divider = screen.getByRole('separator');
      expect(divider).toHaveAttribute('aria-orientation', 'vertical');
    });
  });
});
