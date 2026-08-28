import { EventEmitter } from 'node:events';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import analyzeHandler from '../../api/gemini/analyze.js';
import storyPromptsHandler from '../../api/gemini/story-prompts.js';
import suggestFieldsHandler from '../../api/gemini/suggest-fields.js';

const { generateContentMock, googleGenAIMock, requireAiAccessMock } = vi.hoisted(() => {
  const generateContentMock = vi.fn();
  return {
    generateContentMock,
    googleGenAIMock: vi.fn(function GoogleGenAI() {
      return {
        models: {
          generateContent: generateContentMock,
        },
      };
    }),
    requireAiAccessMock: vi.fn(),
  };
});

vi.mock('../../api/_aiSecurity.js', () => ({
  requireAiAccess: requireAiAccessMock,
}));

vi.mock('@google/genai', () => ({
  Type: {
    ARRAY: 'ARRAY',
    BOOLEAN: 'BOOLEAN',
    NUMBER: 'NUMBER',
    OBJECT: 'OBJECT',
    STRING: 'STRING',
  },
  GoogleGenAI: googleGenAIMock,
}));

type Handler = (
  req: Record<string, unknown>,
  res: ReturnType<typeof createMockResponse>,
) => Promise<unknown>;

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

const postJson = async (handler: Handler, body: Record<string, unknown>) => {
  const req = {
    body,
    headers: {},
    method: 'POST',
  };
  const res = createMockResponse();

  await handler(req, res);

  return res;
};

const unsafeRequestBody = {
  apiKey: 'client-supplied-key',
  client: {
    models: {
      generateContent: 'client-controlled-provider',
    },
  },
};

const endpointCases = [
  {
    body: {
      imageBase64: 'abc123',
      fields: [{ id: 'year', label: 'Year', type: 'number' }],
    },
    expectedBody: {
      title: 'Leica M6',
      aiDescription: 'Black rangefinder.',
      notes: 'Black rangefinder.',
      data: { year: 1984 },
    },
    handler: analyzeHandler,
    name: 'analyze',
    providerPayload: { title: 'Leica M6', aiDescription: 'Black rangefinder.', year: 1984 },
  },
  {
    body: {
      description: 'vintage cameras',
      locale: 'en',
    },
    expectedBody: { fields: ['Year', 'Brand'] },
    handler: suggestFieldsHandler,
    name: 'suggest fields',
    providerPayload: { fields: ['Year', 'Brand'] },
  },
  {
    body: {
      title: 'Blue mug',
      locale: 'en',
    },
    expectedBody: { prompts: ['Where did you find it?'] },
    handler: storyPromptsHandler,
    name: 'story prompts',
    providerPayload: { prompts: ['Where did you find it?'] },
  },
];

describe('AI endpoint request sanitization', () => {
  beforeEach(() => {
    generateContentMock.mockReset();
    googleGenAIMock.mockClear();
    requireAiAccessMock.mockReset();
    requireAiAccessMock.mockResolvedValue(null);
    vi.stubEnv('GEMINI_API_KEY', 'server-side-gemini-key');
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it.each(endpointCases)(
    'ignores client-controlled provider input for the Vercel $name endpoint',
    async ({ body, expectedBody, handler, providerPayload }) => {
      generateContentMock.mockResolvedValueOnce({ text: JSON.stringify(providerPayload) });

      const res = await postJson(handler, {
        ...body,
        ...unsafeRequestBody,
      });

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual(expectedBody);
      expect(googleGenAIMock).toHaveBeenCalledWith({ apiKey: 'server-side-gemini-key' });
      expect(generateContentMock).toHaveBeenCalledTimes(1);
    },
  );

  it('ignores client-controlled provider input in the local Express proxy', async () => {
    vi.resetModules();
    delete process.env.SUPABASE_JWT_SECRET;
    generateContentMock.mockResolvedValueOnce({
      text: JSON.stringify({
        title: 'Leica M6',
        aiDescription: 'Black rangefinder.',
        year: 1984,
      }),
    });

    const { default: localApp } = await import('../../server/geminiProxy.js');
    const server = localApp.listen(0);
    await new Promise<void>((resolve) => server.once('listening', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') {
      throw new Error('Expected local proxy to bind to a TCP port');
    }

    try {
      const response = await fetch(`http://127.0.0.1:${address.port}/api/gemini/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: 'abc123',
          fields: [{ id: 'year', label: 'Year', type: 'number' }],
          ...unsafeRequestBody,
        }),
      });

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({
        title: 'Leica M6',
        aiDescription: 'Black rangefinder.',
        notes: 'Black rangefinder.',
        data: { year: 1984 },
      });
      expect(googleGenAIMock).toHaveBeenCalledWith({ apiKey: 'server-side-gemini-key' });
      expect(generateContentMock).toHaveBeenCalledTimes(1);
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error?: Error) => (error ? reject(error) : resolve())),
      );
    }
  });
});
