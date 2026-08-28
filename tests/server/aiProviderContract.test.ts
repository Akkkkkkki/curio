import { describe, expect, it, vi } from 'vitest';
import { analyzeItem, storyPrompts, suggestFields } from '../../server/ai/operations.js';

const fakeProvider = () => ({
  name: 'fake',
  model: 'fake-model',
  analyzeImage: vi.fn().mockResolvedValue({
    title: 'Test Camera',
    aiDescription: 'A black camera.',
    year: 1984,
  }),
  generateStructuredText: vi
    .fn()
    .mockResolvedValueOnce({ fields: ['Year', 'Maker'] })
    .mockResolvedValueOnce({ prompts: ['Where did you find this camera?'] }),
});

describe('AI provider contract', () => {
  it('lets Curio operations run against a non-Gemini provider', async () => {
    const provider = fakeProvider();

    const analysis = await analyzeItem({
      provider,
      imageBase64: 'abc',
      fields: [{ id: 'year', label: 'Year', type: 'number' }],
    });
    expect(analysis).toEqual({
      title: 'Test Camera',
      aiDescription: 'A black camera.',
      notes: 'A black camera.',
      data: { year: 1984 },
    });

    await expect(suggestFields({ provider, description: 'vintage cameras' })).resolves.toEqual({
      fields: ['Year', 'Maker'],
    });
    await expect(storyPrompts({ provider, title: 'Test Camera' })).resolves.toEqual({
      prompts: ['Where did you find this camera?'],
    });

    expect(provider.analyzeImage).toHaveBeenCalledOnce();
    expect(provider.generateStructuredText).toHaveBeenCalledTimes(2);
  });
});
