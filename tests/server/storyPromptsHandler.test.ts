import { EventEmitter } from 'node:events';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import handler from '../../api/gemini/story-prompts.js';

const { generateContentMock, requireAiAccessMock } = vi.hoisted(() => ({
  generateContentMock: vi.fn(),
  requireAiAccessMock: vi.fn(),
}));

vi.mock('../../api/_aiSecurity.js', () => ({
  requireAiAccess: requireAiAccessMock,
}));

vi.mock('@google/genai', () => ({
  Type: {
    ARRAY: 'ARRAY',
    OBJECT: 'OBJECT',
    STRING: 'STRING',
  },
  GoogleGenAI: vi.fn(function GoogleGenAI() {
    return {
      models: {
        generateContent: generateContentMock,
      },
    };
  }),
}));

const createMockResponse = () => {
  const emitter = new EventEmitter();
  const headers = new Map<string, string>();
  const res = {
    body: undefined as unknown,
    headers,
    locals: {} as Record<string, unknown>,
    statusCode: 200,
    json(payload: unknown) {
      this.body = payload;
      emitter.emit('finish');
      return this;
    },
    on(eventName: string, listener: () => void) {
      emitter.on(eventName, listener);
      return this;
    },
    setHeader(name: string, value: string) {
      headers.set(name.toLowerCase(), value);
      return this;
    },
    status(statusCode: number) {
      this.statusCode = statusCode;
      return this;
    },
  };
  return res;
};

const postJson = async (body: unknown) => {
  const req = {
    body,
    headers: {},
    method: 'POST',
  };
  const res = createMockResponse();

  await handler(req, res);

  return res;
};

describe('/api/gemini/story-prompts handler', () => {
  beforeEach(() => {
    generateContentMock.mockReset();
    requireAiAccessMock.mockReset();
    requireAiAccessMock.mockResolvedValue(null);
    process.env.GEMINI_API_KEY = 'test-gemini-key';
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  it('rejects a whitespace-only title before calling Gemini', async () => {
    const res = await postJson({
      title: '   ',
      aiDescription: '',
      knownFields: {
        empty: '',
        missing: null,
      },
      locale: 'en',
    });

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: 'Missing title' });
    expect(generateContentMock).not.toHaveBeenCalled();
  });

  it('passes bounded context to Gemini and sanitizes prompt output', async () => {
    generateContentMock.mockResolvedValueOnce({
      text: JSON.stringify({
        prompts: [
          '1. Where did this copy first find you?',
          '- Where did this copy first find you?',
          '',
          42,
          'This prompt has more than enough words to force truncation before it reaches the collector',
          '* What detail still feels unresolved?',
          'Which shelf holds it now?',
        ],
      }),
    });

    const res = await postJson({
      title: ' Kind of Blue ',
      collectionContext: {
        name: 'Vinyl Vault',
        description: 'Jazz records with personal provenance',
      },
      aiDescription: '  Blue-toned album cover with white serif lettering.  ',
      knownFields: {
        artist: 'Miles Davis',
        pressing: 'Mono',
        empty: '',
        nullable: null,
        undefinedValue: undefined,
        year: 1959,
        country: 'US',
        label: 'Columbia',
        condition: 'VG+',
        matrix: 'XSM47326',
        shelf: 'A1',
        overflow: 'Should not be included',
      },
      locale: 'en',
    });

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      prompts: [
        'Where did this copy first find you?',
        expect.stringMatching(/^This prompt has more than enough words to force truncation/),
        'What detail still feels unresolved?',
      ],
    });

    const request = generateContentMock.mock.calls[0][0];
    const systemPrompt = request.contents.parts[0].text;
    expect(systemPrompt).toContain('- Title: "Kind of Blue"');
    expect(systemPrompt).toContain('- Collection: "Vinyl Vault"');
    expect(systemPrompt).toContain(
      '- Collection description: "Jazz records with personal provenance"',
    );
    expect(systemPrompt).toContain(
      '- Visual observation: "Blue-toned album cover with white serif lettering."',
    );
    expect(systemPrompt).toContain('  - artist: Miles Davis');
    expect(systemPrompt).toContain('  - matrix: XSM47326');
    expect(systemPrompt).not.toContain('empty:');
    expect(systemPrompt).not.toContain('nullable:');
    expect(systemPrompt).not.toContain('undefinedValue:');
    expect(systemPrompt).not.toContain('overflow:');
  });

  it('returns a stable generic 500 when Gemini generation fails', async () => {
    generateContentMock.mockRejectedValueOnce(new Error('quota exceeded'));
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const res = await postJson({ title: 'Kind of Blue' });

    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ error: 'Story prompt generation failed' });
  });

  it('keeps the local proxy validation, normalization, and errors in parity', async () => {
    const originalJwtSecret = process.env.SUPABASE_JWT_SECRET;
    delete process.env.SUPABASE_JWT_SECRET;
    vi.resetModules();

    const { default: localApp } = await import('../../server/geminiProxy.js');
    const server = localApp.listen(0);
    await new Promise<void>((resolve) => server.once('listening', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') {
      throw new Error('Expected local proxy to bind to a TCP port');
    }
    const endpoint = `http://127.0.0.1:${address.port}/api/gemini/story-prompts`;

    try {
      generateContentMock.mockClear();
      const whitespaceResponse = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: '   ' }),
      });

      expect(whitespaceResponse.status).toBe(400);
      expect(await whitespaceResponse.json()).toEqual({ error: 'Missing title' });
      expect(generateContentMock).not.toHaveBeenCalled();

      generateContentMock.mockResolvedValueOnce({
        text: JSON.stringify({ prompts: ['Where did this copy first find you?'] }),
      });
      const successResponse = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: ' Kind of Blue ',
          aiDescription: '  Blue-toned album cover.  ',
          locale: 'en',
        }),
      });

      expect(successResponse.status).toBe(200);
      expect(await successResponse.json()).toEqual({
        prompts: ['Where did this copy first find you?'],
      });
      const localRequest = generateContentMock.mock.calls[0][0];
      const localPrompt = localRequest.contents.parts[0].text;
      expect(localPrompt).toContain('- Title: "Kind of Blue"');
      expect(localPrompt).not.toContain('- Title: " Kind of Blue "');
      expect(localPrompt).toContain('- Visual observation: "Blue-toned album cover."');

      generateContentMock.mockRejectedValueOnce(new Error('quota exceeded'));
      vi.spyOn(console, 'error').mockImplementation(() => {});
      const errorResponse = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Kind of Blue' }),
      });

      expect(errorResponse.status).toBe(500);
      expect(await errorResponse.json()).toEqual({ error: 'Story prompt generation failed' });
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error?: Error) => (error ? reject(error) : resolve())),
      );
      if (originalJwtSecret === undefined) delete process.env.SUPABASE_JWT_SECRET;
      else process.env.SUPABASE_JWT_SECRET = originalJwtSecret;
    }
  });

  it('returns 503 before Gemini calls when the API key is missing', async () => {
    delete process.env.GEMINI_API_KEY;

    const res = await postJson({ title: 'Kind of Blue' });

    expect(res.statusCode).toBe(503);
    expect(res.body).toEqual({ error: 'GEMINI_API_KEY is not configured' });
    expect(generateContentMock).not.toHaveBeenCalled();
  });
});
