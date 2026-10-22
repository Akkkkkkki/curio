import { afterEach, describe, expect, it, vi } from 'vitest';
import healthHandler from '../../api/health.js';
import enhanceHandler from '../../api/gemini/enhance.js';

// AI photo enhancement transmits a private photo to a third-party model, so it
// is disabled by default and only turns on when the server opts in explicitly
// (CUR-183). These cover the server source of truth: the capability health
// signal and the endpoint guard.

const makeRes = () => {
  const res = {
    statusCode: 200,
    body: null as unknown,
    headers: {} as Record<string, string>,
    locals: {} as Record<string, unknown>,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      return this;
    },
    setHeader(name: string, value: string) {
      this.headers[name] = value;
    },
    on() {
      return this;
    },
  };
  return res;
};

const withLocalProxy = async (callback: (baseUrl: string) => Promise<void>) => {
  vi.resetModules();
  vi.stubEnv('GEMINI_API_KEY', 'test-key');
  vi.stubEnv('SUPABASE_JWT_SECRET', '');
  vi.spyOn(console, 'log').mockImplementation(() => {});

  const { default: localApp } = await import('../../server/geminiProxy.js');
  const server = localApp.listen(0);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Expected local proxy to bind to a TCP port');
  }

  try {
    await callback(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error?: Error) => (error ? reject(error) : resolve())),
    );
  }
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe('AI photo enhancement disabled by default (CUR-183)', () => {
  it('health reports imageEditingAvailable:false when the server flag is unset', () => {
    vi.stubEnv('GEMINI_API_KEY', 'test-key');
    vi.stubEnv('AI_IMAGE_EDIT_ENABLED', undefined as unknown as string);
    const res = makeRes();

    healthHandler({ method: 'GET', headers: {} }, res);

    expect(res.statusCode).toBe(200);
    const body = res.body as Record<string, boolean>;
    expect(body.imageEditingAvailable).toBe(false);
    // Metadata analysis is unaffected — only enhancement is gated.
    expect(body.metadataAnalysisAvailable).toBe(true);
    expect(body.storyPromptsAvailable).toBe(true);
  });

  it('health reports imageEditingAvailable:true only when the server flag opts in', () => {
    vi.stubEnv('GEMINI_API_KEY', 'test-key');
    vi.stubEnv('AI_IMAGE_EDIT_ENABLED', 'true');
    const res = makeRes();

    healthHandler({ method: 'GET', headers: {} }, res);

    expect((res.body as Record<string, boolean>).imageEditingAvailable).toBe(true);
  });

  it('enhance endpoint refuses with 503 before any work when the flag is unset', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'test-key');
    vi.stubEnv('AI_IMAGE_EDIT_ENABLED', undefined as unknown as string);
    const res = makeRes();

    await enhanceHandler(
      { method: 'POST', headers: {}, body: { imageBase64: 'BASE64', strength: 'subtle' } },
      res,
    );

    expect(res.statusCode).toBe(503);
    expect(res.body).toEqual({ error: 'Image enhancement is disabled' });
  });

  it('enhance endpoint still rejects non-POST methods with 405', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'test-key');
    vi.stubEnv('AI_IMAGE_EDIT_ENABLED', 'true');
    const res = makeRes();

    await enhanceHandler({ method: 'GET', headers: {} }, res);

    expect(res.statusCode).toBe(405);
  });

  it('local Express proxy health also reports image editing unavailable by default', async () => {
    vi.stubEnv('AI_IMAGE_EDIT_ENABLED', undefined as unknown as string);

    await withLocalProxy(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/health`);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.imageEditingAvailable).toBe(false);
      expect(body.metadataAnalysisAvailable).toBe(true);
    });
  });

  it('local Express proxy enhance endpoint refuses with 503 when the flag is unset', async () => {
    vi.stubEnv('AI_IMAGE_EDIT_ENABLED', undefined as unknown as string);

    await withLocalProxy(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/gemini/enhance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: 'BASE64', strength: 'subtle' }),
      });

      await expect(response.json()).resolves.toEqual({ error: 'Image enhancement is disabled' });
      expect(response.status).toBe(503);
    });
  });
});
