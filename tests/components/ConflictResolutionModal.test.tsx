import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { ConflictResolutionModal, ConflictEntry } from '@/components/ConflictResolutionModal';
import { renderWithProviders, setMockTheme } from '../utils/test-utils';

vi.mock('@/theme', async () => {
  const { createThemeMock } = await import('../utils/test-utils');
  return createThemeMock();
});

const LANGUAGE_STORAGE_KEY = 'curio_language';

const itemConflict: ConflictEntry = {
  id: 'item-1',
  type: 'item',
  collectionId: 'col-1',
  itemId: 'item-1',
  localLabel: 'Local Title',
  cloudLabel: 'Cloud Title',
  localUpdatedAt: '2024-02-01T00:00:00Z',
  cloudUpdatedAt: '2024-01-01T00:00:00Z',
  localPayload: {
    title: 'Local Title',
    rating: 4,
    notes: 'Local story',
    data: { brand: 'Local' },
  },
  cloudPayload: {
    title: 'Cloud Title',
    rating: 5,
    notes: 'Cloud story',
    data: { brand: 'Cloud' },
  },
};

const collectionConflict: ConflictEntry = {
  id: 'col-1',
  type: 'collection',
  collectionId: 'col-1',
  localLabel: 'Local Collection',
  cloudLabel: 'Cloud Collection',
  localUpdatedAt: '2024-01-01T00:00:00Z',
  cloudUpdatedAt: '2024-02-01T00:00:00Z',
  localPayload: { name: 'Local', icon: '📚', description: 'Local desc' },
  cloudPayload: { name: 'Cloud', icon: '🎨', description: 'Cloud desc' },
};

describe('ConflictResolutionModal', () => {
  beforeEach(() => {
    setMockTheme('gallery');
    window.localStorage?.removeItem(LANGUAGE_STORAGE_KEY);
  });

  it('renders English Changed prefix with localized field labels and Newer badge for an item conflict', () => {
    renderWithProviders(
      <ConflictResolutionModal
        isOpen
        conflicts={[itemConflict]}
        onClose={vi.fn()}
        onKeepCloud={vi.fn()}
        onUseLocal={vi.fn()}
      />,
    );

    expect(screen.getByText('Changed: Title, Rating, Story, Details')).toBeInTheDocument();
    expect(screen.getByText('Newer')).toBeInTheDocument();
  });

  it('renders English Changed prefix with collection field labels', () => {
    renderWithProviders(
      <ConflictResolutionModal
        isOpen
        conflicts={[collectionConflict]}
        onClose={vi.fn()}
        onKeepCloud={vi.fn()}
        onUseLocal={vi.fn()}
      />,
    );

    expect(screen.getByText('Changed: Name, Icon, Description')).toBeInTheDocument();
  });

  it('renders Chinese Changed prefix, field labels, and Newer badge when language is zh', () => {
    window.localStorage?.setItem(LANGUAGE_STORAGE_KEY, 'zh');
    renderWithProviders(
      <ConflictResolutionModal
        isOpen
        conflicts={[itemConflict]}
        onClose={vi.fn()}
        onKeepCloud={vi.fn()}
        onUseLocal={vi.fn()}
      />,
    );

    expect(screen.getByText('变更： 标题, 评分, 故事, 详情')).toBeInTheDocument();
    expect(screen.getByText('较新')).toBeInTheDocument();
    expect(screen.queryByText('Newer')).not.toBeInTheDocument();
    expect(screen.queryByText(/^Changed:/)).not.toBeInTheDocument();
  });

  it('closes on Escape without committing a destructive choice', () => {
    const onClose = vi.fn();
    const onKeepCloud = vi.fn();
    const onUseLocal = vi.fn();
    renderWithProviders(
      <ConflictResolutionModal
        isOpen
        conflicts={[itemConflict]}
        onClose={onClose}
        onKeepCloud={onKeepCloud}
        onUseLocal={onUseLocal}
      />,
    );

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onKeepCloud).not.toHaveBeenCalled();
    expect(onUseLocal).not.toHaveBeenCalled();
  });

  it('lands initial focus on the dismiss button so Enter does not commit a side', async () => {
    renderWithProviders(
      <ConflictResolutionModal
        isOpen
        conflicts={[itemConflict]}
        onClose={vi.fn()}
        onKeepCloud={vi.fn()}
        onUseLocal={vi.fn()}
      />,
    );

    await new Promise((resolve) => requestAnimationFrame(resolve));

    const closeButton = screen.getByRole('button', { name: 'Close' });
    expect(document.activeElement).toBe(closeButton);
  });
});
