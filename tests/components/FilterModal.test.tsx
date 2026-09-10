import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { renderWithProviders, setMockTheme } from '../utils/test-utils';
import { FilterModal } from '@/components/FilterModal';
import { CollectionItem, FieldDefinition } from '@/types';

vi.mock('@/theme', async () => {
  const { createThemeMock } = await import('../utils/test-utils');
  return createThemeMock();
});

const createItem = (overrides: Partial<CollectionItem> = {}): CollectionItem => ({
  id: Math.random().toString(36).slice(2),
  collectionId: 'col-1',
  title: 'Item',
  rating: 0,
  notes: '',
  data: {},
  photoUrl: '',
  createdAt: '2026-01-01T00:00:00Z',
  ...overrides,
});

describe('FilterModal', () => {
  const fields: FieldDefinition[] = [
    { id: 'artist', label: 'Artist', type: 'text', displayMode: 'primary' },
    { id: 'year', label: 'Year', type: 'number', displayMode: 'badge' },
  ];
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    fields,
    items: [] as CollectionItem[],
    activeFilters: {},
    onApply: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    setMockTheme('gallery');
  });

  it('renders nothing when closed', () => {
    renderWithProviders(<FilterModal {...defaultProps} isOpen={false} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  describe('accessibility (CUR-78)', () => {
    it('renders as a labelled dialog', () => {
      renderWithProviders(<FilterModal {...defaultProps} />);
      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-modal', 'true');
      expect(dialog).toHaveAttribute('aria-labelledby');
    });

    it('closes on Escape', async () => {
      renderWithProviders(<FilterModal {...defaultProps} />);

      fireEvent.keyDown(document, { key: 'Escape' });

      await waitFor(() => {
        expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
      });
    });

    it('associates every field label with its input via htmlFor / id', () => {
      renderWithProviders(<FilterModal {...defaultProps} />);
      // Rating gets a real associated <label>; getByLabelText only resolves
      // when the htmlFor/id pair is intact.
      expect(screen.getByLabelText(/Rating/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Artist/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Year/i)).toBeInTheDocument();
    });
  });

  const selectField: FieldDefinition = {
    id: 'genre',
    label: 'Genre',
    type: 'select',
    options: ['Jazz', 'Funk'],
    displayMode: 'primary',
  };

  describe('typed field rendering (CUR-134)', () => {
    const numberField: FieldDefinition = {
      id: 'year',
      label: 'Year',
      type: 'number',
      displayMode: 'badge',
    };
    const textField: FieldDefinition = {
      id: 'artist',
      label: 'Artist',
      type: 'text',
      displayMode: 'primary',
    };

    it('renders a select field as a real <select> with the union of declared and observed options', () => {
      renderWithProviders(
        <FilterModal
          {...defaultProps}
          fields={[selectField]}
          items={[
            createItem({ data: { genre: 'Jazz' } }),
            createItem({ data: { genre: 'Ambient' } }),
          ]}
        />,
      );
      const control = screen.getByLabelText(/Genre/i) as HTMLSelectElement;
      expect(control.tagName).toBe('SELECT');
      const optionValues = Array.from(control.options).map((o) => o.value);
      // Includes the "Any" sentinel plus the sorted union of declared + observed values.
      expect(optionValues).toEqual(['', 'Ambient', 'Funk', 'Jazz']);
    });

    it('propagates the picked select value to onApply on Apply', () => {
      const onApply = vi.fn();
      renderWithProviders(
        <FilterModal
          {...defaultProps}
          fields={[selectField]}
          items={[createItem({ data: { genre: 'Jazz' } })]}
          onApply={onApply}
        />,
      );
      const control = screen.getByLabelText(/Genre/i) as HTMLSelectElement;
      fireEvent.change(control, { target: { value: 'Jazz' } });
      fireEvent.click(screen.getByRole('button', { name: /Apply/i }));
      expect(onApply).toHaveBeenCalledWith({ genre: 'Jazz' });
    });

    it('marks number fields as numeric so mobile keyboards show the digit pad', () => {
      renderWithProviders(<FilterModal {...defaultProps} fields={[numberField]} items={[]} />);
      expect(screen.getByLabelText(/Year/i)).toHaveAttribute('inputmode', 'numeric');
    });

    it('leaves text fields as free-text inputs without a numeric input mode', () => {
      renderWithProviders(<FilterModal {...defaultProps} fields={[textField]} items={[]} />);
      const input = screen.getByLabelText(/Artist/i);
      expect(input.tagName).toBe('INPUT');
      expect(input).not.toHaveAttribute('inputmode');
    });
  });

  describe('added month filter (CUR-24)', () => {
    it('lists represented months newest-first and applies the reserved month key', () => {
      const onApply = vi.fn();
      renderWithProviders(
        <FilterModal
          {...defaultProps}
          items={[
            createItem({ createdAt: '2025-12-04T12:00:00.000Z' }),
            createItem({ createdAt: '2026-03-02T12:00:00.000Z' }),
            createItem({ createdAt: '2026-03-28T12:00:00.000Z' }),
            createItem({ createdAt: 'not-a-date' }),
          ]}
          onApply={onApply}
        />,
      );

      const control = screen.getByLabelText(/Added on/i) as HTMLSelectElement;
      expect(Array.from(control.options).map((option) => option.value)).toEqual([
        '',
        '2026-03',
        '2025-12',
      ]);
      expect(Array.from(control.options).map((option) => option.textContent)).toEqual([
        'Any',
        'March 2026',
        'December 2025',
      ]);

      fireEvent.change(control, { target: { value: '2026-03' } });
      fireEvent.click(screen.getByRole('button', { name: /Apply/i }));

      expect(onApply).toHaveBeenCalledWith({ __addedMonth: '2026-03' });
    });
  });

  describe('dropdown touch targets', () => {
    it('keeps select chevrons pointer-transparent so taps reach the select control', () => {
      renderWithProviders(<FilterModal {...defaultProps} fields={[selectField]} />);

      const ratingChevron = screen.getByLabelText(/Rating/i).parentElement?.querySelector('svg');
      const genreChevron = screen.getByLabelText(/Genre/i).parentElement?.querySelector('svg');

      expect(ratingChevron).toHaveClass('pointer-events-none');
      expect(genreChevron).toHaveClass('pointer-events-none');
    });
  });
});
