import { EventEmitter } from 'node:events';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { requireAiAccess } from '../../api/_aiSecurity.js';
import { attachRequestLogger } from '../../api/_requestLogging.js';
import { buildAnalysisPrompt } from '../../api/gemini/analyze.js';

const makeRes = () => {
  const res = {
    statusCode: 200,
    body: null as unknown,
    headers: {} as Record<string, string>,
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
  };
  return res;
};

const configureSupabase = () => {
  vi.stubEnv('SUPABASE_URL', 'https://example.supabase.co');
  vi.stubEnv('SUPABASE_ANON_KEY', 'anon-key');
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
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
    configureSupabase();
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({ ok: false, status: 401 } as Response);
    const res = makeRes();

    await requireAiAccess(
      { headers: { authorization: 'Bearer bad-token' } },
      res,
      '/api/gemini/analyze',
    );

    expect(res.statusCode).toBe(401);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('returns 503 when Supabase Auth is unavailable', async () => {
    configureSupabase();
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({ ok: false, status: 503 } as Response);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = makeRes();

    await requireAiAccess(
      { headers: { authorization: 'Bearer good-token' } },
      res,
      '/api/gemini/analyze',
    );

    expect(res.statusCode).toBe(503);
    expect(res.body).toEqual({ error: 'AI auth service unavailable' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('returns a stable 429 shape when the persistent quota is exhausted', async () => {
    configureSupabase();
    vi.spyOn(Date, 'now').mockReturnValue(1_200_000);
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'user-1' }) } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ allowed: false, remaining: 0, reset_at: 1234 }),
      } as Response);
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
    expect(res.headers['RateLimit-Reset']).toBe('34');
    expect(res.headers['Retry-After']).toBe('34');
  });

  it('allows authenticated requests within quota and keeps policy out of the client-callable RPC', async () => {
    configureSupabase();
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'user-1' }) } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ allowed: true, remaining: 9, reset_at: 1234 }),
      } as Response);
    const req = { headers: { authorization: 'Bearer good-token' } } as {
      headers: Record<string, string>;
      user?: { id?: string; sub?: string | null };
    };
    const res = makeRes();

    const result = await requireAiAccess(req, res, '/api/gemini/analyze');

    expect(result).toBeNull();
    expect(req.user).toEqual({ id: 'user-1', sub: 'user-1' });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(fetchMock.mock.calls[1][1]?.body as string)).toEqual({
      p_route: '/api/gemini/analyze',
    });
  });

  it('accepts the repository canonical Supabase publishable key', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY', 'publishable-key');
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'user-1' }) } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ allowed: true, remaining: 9, reset_at: 1234 }),
      } as Response);
    const res = makeRes();

    await requireAiAccess(
      { headers: { authorization: 'Bearer good-token' } },
      res,
      '/api/gemini/analyze',
    );

    expect(res.statusCode).toBe(200);
    expect(fetchMock.mock.calls[0][1]?.headers).toMatchObject({ apikey: 'publishable-key' });
  });
});

describe('AI request logging', () => {
  it('reads authenticated identity at response completion', () => {
    const emitter = new EventEmitter();
    const req = {
      headers: {},
      method: 'POST',
      user: undefined as { id?: string; sub?: string } | undefined,
    };
    const res = {
      statusCode: 200,
      locals: {},
      setHeader: vi.fn(),
      on(eventName: string, listener: () => void) {
        emitter.on(eventName, listener);
        return this;
      },
    };
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    attachRequestLogger(req, res, {
      route: '/api/gemini/analyze',
      provider: 'gemini',
      model: 'gemini-2.5-flash',
    });
    req.user = { id: 'user-1' };
    emitter.emit('finish');

    const payload = JSON.parse(logSpy.mock.calls[0][0] as string);
    expect(payload.userId).toBe('user-1');
  });
});

describe('AI rate-limit SQL policy', () => {
  it('fixes the quota policy server-side and only accepts supported routes', () => {
    const sql = readFileSync(join(process.cwd(), 'supabase/4_ai_rate_limit.sql'), 'utf8');

    expect(sql).toContain('v_limit constant integer := 10');
    expect(sql).toContain('v_window_seconds constant integer := 60');
    expect(sql).toContain('if p_route not in (');
    expect(sql).toContain("'/api/gemini/analyze'");
    expect(sql).toContain("'/api/gemini/enhance'");
    expect(sql).toContain("'/api/gemini/story-prompts'");
    expect(sql).toContain("'/api/gemini/suggest-fields'");
    expect(sql).not.toContain('p_limit');
    expect(sql).not.toContain('p_window_seconds');
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
