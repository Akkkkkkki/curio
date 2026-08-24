import { describe, expect, it, vi } from 'vitest';
import {
  analyzeItem,
  buildAnalysisPrompt,
  buildStoryPrompt,
  getGeminiAnalyzeModel,
  normalizeStoryPrompts,
  normalizeSuggestedFields,
  storyPrompts,
  suggestFields,
  validateAnalyzeInput,
} from '../../server/ai/operations.js';

const fakeClient = (payload: unknown) => ({
  models: {
    generateContent: vi.fn().mockResolvedValue({ text: JSON.stringify(payload) }),
  },
});

describe('shared AI operations', () => {
  it('resolves the analysis model from the current environment at runtime', () => {
    const previous = process.env.GEMINI_ANALYZE_MODEL;
    try {
      process.env.GEMINI_ANALYZE_MODEL = 'gemini-local-override';
      expect(getGeminiAnalyzeModel()).toBe('gemini-local-override');
      delete process.env.GEMINI_ANALYZE_MODEL;
      expect(getGeminiAnalyzeModel()).toBe('gemini-2.5-flash');
    } finally {
      if (previous === undefined) delete process.env.GEMINI_ANALYZE_MODEL;
      else process.env.GEMINI_ANALYZE_MODEL = previous;
    }
  });

  it('validates analysis input at the shared boundary', () => {
    expect(validateAnalyzeInput({ imageBase64: '', fields: [] })).toBe('imageBase64 is empty');
    expect(
      validateAnalyzeInput({ imageBase64: 'abc', fields: [{ id: 'year', type: 'text' }] }),
    ).toBeNull();
  });

  it('builds one analysis prompt with collection context and locale', () => {
    const prompt = buildAnalysisPrompt({
      collectionContext: { name: 'Cameras', description: '35mm favorites' },
      locale: 'ja',
    });
    expect(prompt).toContain('Cameras');
    expect(prompt).toContain('35mm favorites');
    expect(prompt).toContain('"ja" language');
  });

  it('normalizes analysis output consistently', async () => {
    const client = fakeClient({
      title: 'Leica M6',
      aiDescription: 'Black rangefinder.',
      year: 1984,
    });
    const result = await analyzeItem({
      apiKey: 'unused',
      client,
      imageBase64: 'abc',
      fields: [{ id: 'year', label: 'Year', type: 'number' }],
    });
    expect(result).toEqual({
      title: 'Leica M6',
      aiDescription: 'Black rangefinder.',
      notes: 'Black rangefinder.',
      data: { year: 1984 },
    });
  });

  it('deduplicates and caps field suggestions', async () => {
    expect(normalizeSuggestedFields([' Year ', 'year', '- Brand', '', 'Model'])).toEqual([
      'Year',
      'Brand',
      'Model',
    ]);
    const client = fakeClient({ fields: ['Year', 'Brand', 'Model'] });
    await expect(
      suggestFields({ apiKey: 'unused', client, description: 'vintage cameras', locale: 'en' }),
    ).resolves.toEqual({ fields: ['Year', 'Brand', 'Model'] });
  });

  it('keeps story prompt construction and normalization shared', async () => {
    const prompt = buildStoryPrompt({
      title: 'Blue mug',
      knownFields: { maker: 'Studio A' },
      locale: 'en',
    });
    expect(prompt).toContain('Blue mug');
    expect(prompt).toContain('Studio A');
    expect(
      normalizeStoryPrompts(['Why this mug?', 'Why this mug?', 'Where did you find it?']),
    ).toEqual(['Why this mug?', 'Where did you find it?']);

    const client = fakeClient({
      prompts: ['Why this mug?', 'Who made it?', 'When did it arrive?'],
    });
    await expect(
      storyPrompts({ apiKey: 'unused', client, title: 'Blue mug', locale: 'en' }),
    ).resolves.toEqual({ prompts: ['Why this mug?', 'Who made it?', 'When did it arrive?'] });
  });

  it('rejects invalid shared operation inputs without invoking a provider', async () => {
    const client = fakeClient({});
    await expect(
      suggestFields({ apiKey: 'unused', client, description: '' }),
    ).rejects.toMatchObject({
      statusCode: 400,
    });
    await expect(storyPrompts({ apiKey: 'unused', client, title: ' ' })).rejects.toMatchObject({
      statusCode: 400,
    });
    expect(client.models.generateContent).not.toHaveBeenCalled();
  });
});
