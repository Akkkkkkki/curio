/**
 * ImageEditModal Component Tests (CUR-86)
 *
 * Mirrors the a11y contract that CUR-78 established on the other modals
 * (FilterModal, Delete*Modal, EnhanceImageModal).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders, setMockTheme } from '../utils/test-utils';
import { ImageEditModal } from '@/components/ImageEditModal';

vi.mock('@/theme', async () => {
  const { createThemeMock } = await import('../utils/test-utils');
  return createThemeMock();
});

const TRANSPARENT_PIXEL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

describe('ImageEditModal', () => {
  const defaultProps = {
    isOpen: true,
    source: TRANSPARENT_PIXEL,
    onClose: vi.fn(),
    onApply: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    setMockTheme('gallery');
  });

  it('renders nothing when closed', () => {
    renderWithProviders(<ImageEditModal {...defaultProps} isOpen={false} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders nothing when source is missing', () => {
    renderWithProviders(<ImageEditModal {...defaultProps} source={null} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('calls onClose when cancel is clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ImageEditModal {...defaultProps} />);

    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onApply with the current preview when apply is clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ImageEditModal {...defaultProps} />);

    await user.click(screen.getByRole('button', { name: /apply/i }));
    expect(defaultProps.onApply).toHaveBeenCalledWith(TRANSPARENT_PIXEL);
  });

  describe('accessibility (CUR-86)', () => {
    it('renders as a labelled dialog', () => {
      renderWithProviders(<ImageEditModal {...defaultProps} />);
      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-modal', 'true');
      expect(dialog).toHaveAttribute('aria-labelledby', 'image-edit-title');
    });

    it('closes on Escape', async () => {
      renderWithProviders(<ImageEditModal {...defaultProps} />);

      fireEvent.keyDown(document, { key: 'Escape' });

      await waitFor(() => {
        expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
      });
    });

    it('lands initial focus on Cancel (safe action), not Rotate/Apply', async () => {
      renderWithProviders(<ImageEditModal {...defaultProps} />);

      await waitFor(() => {
        expect(document.activeElement).toBe(screen.getByRole('button', { name: /cancel/i }));
      });
    });
  });
});
