import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders, screen } from '../utils/test-utils';
import { CollectionCard } from '@/components/CollectionCard';
import type { UserCollection } from '@/types';

vi.mock('@/theme', async () => {
  const { createThemeMock } = await import('../utils/test-utils');
  return createThemeMock();
});

const collection: UserCollection = {
  id: 'long-title-collection',
  templateId: 'vinyl',
  name: 'Japanese City Pop Pressings and Limited Anniversary Reissues',
  icon: '🎵',
  customFields: [],
  items: [],
  ownerId: 'test-user-id',
  updatedAt: new Date('2026-09-02T00:00:00.000Z').toISOString(),
};

describe('CollectionCard long title discoverability', () => {
  it('allows collection names to occupy two lines while preserving the full desktop tooltip', () => {
    renderWithProviders(<CollectionCard collection={collection} onClick={vi.fn()} />);

    const heading = screen.getByRole('heading', { name: collection.name });
    expect(heading).toHaveClass('line-clamp-2');
    expect(heading).not.toHaveClass('truncate');
    expect(heading).toHaveAttribute('title', collection.name);
  });
});
