import { afterEach, describe, expect, it, vi } from 'vitest';
import { requireAiAccess } from './_aiSecurity.js';
import { buildAnalysisPrompt } from './gemini/analyze.js';

const makeRes = () => {
  const res = {
    statusCode: 200,
    body: null,
    headers: {},
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
    setHeader(name, value) {
      this.headers[name] = value;
    },
  };
  return res;
};

const originalEnv = { ...process.env };

afterEach(() => {
  vi.restoreAllMocks();
  process.env = { ...originalEnv };
});

describe('requireAiAccess', () => {
  it('rejects requests without a bearer token', async () => {
    const res = makeRes();
    const result = await requireAiAccess({ headers: {} }, res, '/api/gemini/analyze');

    expect(result).toBe(res);
    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ error: 'Missing authorization token' });
  });

  it('rejects invalid Supabase sessions before checking the quota', async () => {
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'anon-key';
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({ ok: false });
    const res = makeRes();

    await requireAiAccess(
      { headers: { authorization: 'Bearer bad-token' } },
      res,
      '/api/gemini/analyze',
    );

    expect(res.statusCode).toBe(401);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('returns a stable 429 shape when the persistent quota is exhausted', async () => {
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'anon-key';
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'user-1' }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ allowed: false, remaining: 0, reset_at: 1234 }),
      });
    const res = makeRes();

    await requireAiAccess(
      { headers: { authorization: 'Bearer good-token' } },
      res,
      '/api/gemini/analyze',
    );

    expect(res.statusCode).toBe(429);
    expect(res.body).toEqual({
      error: 'Rate limit exceeded. Please wait before trying again.',
    });
    expect(res.headers['RateLimit-Limit']).toBe('10');
    expect(res.headers['RateLimit-Remaining']).toBe('0');
  });

  it('allows authenticated requests within quota and exposes the user', async () => {
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'anon-key';
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'user-1' }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ allowed: true, remaining: 9, reset_at: 1234 }),
      });
    const req = { headers: { authorization: 'Bearer good-token' } };
    const res = makeRes();

    const result = await requireAiAccess(req, res, '/api/gemini/analyze');

    expect(result).toBeNull();
    expect(req.user).toEqual({ id: 'user-1' });
    expect(res.statusCode).toBe(200);
  });
});

describe('buildAnalysisPrompt', () => {
  it('includes collection name, description, and locale in production analysis', () => {
    const prompt = buildAnalysisPrompt({
      collectionContext: { name: 'Film cameras', description: 'Japanese rangefinders' },
      locale: 'zh',
    });

    expect(prompt).toContain('Film cameras');
    expect(prompt).toContain('Japanese rangefinders');
    expect(prompt).toContain('"zh" language');
  });
});
