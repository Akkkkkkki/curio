import { describe, expect, it, vi } from 'vitest';
import {
  createCaptureWorkflow,
  type CaptureWorkflowDependencies,
} from '../../src/workflows/captureWorkflow';

const collection = {
  id: 'collection-1',
  name: 'Tea tins',
  collectionDescription: 'Japanese tea packaging',
  customFields: [
    { id: 'origin', name: 'Origin', type: 'text' as const },
    { id: 'year', name: 'Year', type: 'text' as const },
  ],
};

const createDeps = (
  overrides: Partial<CaptureWorkflowDependencies> = {},
): CaptureWorkflowDependencies => ({
  refreshAiEnabled: vi.fn().mockResolvedValue(true),
  compressImage: vi.fn(async (image: string) => `compressed:${image}`),
  analyzeImage: vi.fn().mockResolvedValue({
    status: 'success',
    title: 'Uji Matcha',
    data: { origin: 'Uji', ignored: null },
    aiDescription: 'Green tea tin',
    notes: 'Green tea tin',
  }),
  ...overrides,
});

describe('captureWorkflow', () => {
  it('returns field suggestions without mutating story content', async () => {
    const deps = createDeps();
    const workflow = createCaptureWorkflow(deps);

    const result = await workflow.analyzeSingle({
      image: 'photo',
      collection,
      locale: 'en',
      isActive: () => true,
    });

    expect(result).toEqual({
      status: 'success',
      title: 'Uji Matcha',
      aiDescription: 'Green tea tin',
      fieldSuggestions: { origin: 'Uji' },
      lowConfidence: false,
    });
    expect(deps.analyzeImage).toHaveBeenCalledWith(
      'compressed:photo',
      collection.customFields,
      expect.objectContaining({ locale: 'en' }),
    );
  });

  it('cancels after an await boundary when the session becomes stale', async () => {
    let active = true;
    const deps = createDeps({
      compressImage: vi.fn(async () => {
        active = false;
        return 'compressed';
      }),
    });
    const workflow = createCaptureWorkflow(deps);

    const result = await workflow.analyzeSingle({
      image: 'photo',
      collection,
      locale: 'en',
      isActive: () => active,
    });

    expect(result).toEqual({ status: 'cancelled' });
    expect(deps.analyzeImage).not.toHaveBeenCalled();
  });

  it('preserves every selected photo when AI is unavailable', async () => {
    const workflow = createCaptureWorkflow(
      createDeps({ refreshAiEnabled: vi.fn().mockResolvedValue(false) }),
    );

    const result = await workflow.analyzeBatch({
      images: ['one', 'two'],
      existingIds: ['existing-1'],
      collection,
      locale: 'en',
      isActive: () => true,
      shouldStop: () => false,
    });

    expect(result.status).toBe('unavailable');
    expect(result.hadError).toBe(true);
    expect(result.items).toHaveLength(2);
    expect(result.items[0].id).toBe('existing-1');
    expect(result.items.map((item) => item.image)).toEqual(['one', 'two']);
  });

  it('stops a batch between photos for manual-entry escape', async () => {
    let stop = false;
    const deps = createDeps({
      analyzeImage: vi.fn().mockImplementation(async () => {
        stop = true;
        return {
          status: 'success',
          title: 'First',
          data: {},
          aiDescription: '',
          notes: '',
        };
      }),
    });
    const workflow = createCaptureWorkflow(deps);

    const result = await workflow.analyzeBatch({
      images: ['one', 'two', 'three'],
      collection,
      locale: 'en',
      isActive: () => true,
      shouldStop: () => stop,
    });

    expect(result.status).toBe('complete');
    expect(result.items).toHaveLength(1);
    expect(deps.analyzeImage).toHaveBeenCalledTimes(1);
  });

  it('keeps partial batch progress when one analysis fails', async () => {
    const analyze = vi
      .fn()
      .mockResolvedValueOnce({
        status: 'success',
        title: 'First',
        data: { origin: 'Kyoto' },
        aiDescription: '',
        notes: '',
      })
      .mockResolvedValueOnce({ status: 'error', message: 'busy', retryable: true });
    const workflow = createCaptureWorkflow(createDeps({ analyzeImage: analyze }));

    const result = await workflow.analyzeBatch({
      images: ['one', 'two'],
      collection,
      locale: 'en',
      isActive: () => true,
      shouldStop: () => false,
    });

    expect(result.hadError).toBe(true);
    expect(result.items).toHaveLength(2);
    expect(result.items[0].title).toBe('First');
    expect(result.items[1].title).toBe('');
  });

  it('saves batch items sequentially and reports each successful item', async () => {
    const workflow = createCaptureWorkflow(createDeps());
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onItemSaved = vi.fn();
    const items = [
      { id: '1', image: 'a', title: 'A', notes: 'story', data: {}, rating: 3 },
      { id: '2', image: 'b', title: 'B', notes: '', data: {}, rating: 0 },
    ];

    await workflow.saveBatch({ collectionId: 'collection-1', items, onSave, onItemSaved });

    expect(onSave).toHaveBeenCalledTimes(2);
    expect(onItemSaved).toHaveBeenNthCalledWith(1, items[0]);
    expect(onItemSaved).toHaveBeenNthCalledWith(2, items[1]);
  });
});
