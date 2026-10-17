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
});
