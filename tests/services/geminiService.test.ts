/**
 * Phase 3.1: services/geminiService.ts — AI Analysis Tests
 *
 * Success criteria (from docs/TESTING_ROADMAP.md Phase 3):
 * - AI service degrades gracefully on all failure modes (non-blocking)
 * - Schema validation: response matches expected shape
 * - Timeout handling: user can proceed without AI (timeout returns null)
 *
 * IMPORTANT (TDD): Do not modify production implementations while writing these tests.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { FieldDefinition } from '@/types';

async function importGeminiServiceFresh(env: { aiEnabled?: string; apiBaseUrl?: string } = {}) {
  vi.resetModules();
  if (env.aiEnabled !== undefined) vi.stubEnv('VITE_AI_ENABLED', env.aiEnabled);
  if (env.apiBaseUrl !== undefined) vi.stubEnv('VITE_API_BASE_URL', env.apiBaseUrl);
  return await import('@/services/geminiService');
}

function createOkJsonResponse(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('services/geminiService.ts - analyzeImage (Phase 3.1)', () => {
  const fields: FieldDefinition[] = [
    { id: 'artist', label: 'Artist', type: 'text' } as FieldDefinition,
  ];

  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.stubEnv('VITE_API_BASE_URL', 'http://localhost:8787');
    vi.stubEnv('VITE_AI_ENABLED', 'true');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('happy path: posts image + field schema to /api/gemini/analyze and returns {title, notes, data}', async () => {
    /**
     * Verifies the typical AI analysis request:
     * - Uses the correct API route (the proxy/server exposes /api/gemini/analyze)
     * - Sends { imageBase64, fields } in the JSON body
     * - Returns the expected response shape for downstream UI usage
     */
    const fetchSpy = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      if (!url.endsWith('/api/gemini/analyze')) {
        throw new Error(`Unexpected endpoint: ${url}`);
      }
      expect(init?.method).toBe('POST');
      const body = JSON.parse(String(init?.body ?? 'null'));
      expect(body).toMatchObject({ imageBase64: 'BASE64', fields });
      return createOkJsonResponse({
        title: 'Analyzed Item',
        notes: 'AI notes',
        data: { artist: 'Miles Davis' },
      });
    });
    vi.stubGlobal('fetch', fetchSpy);

    const mod = await importGeminiServiceFresh();
    const result = await mod.analyzeImage('BASE64', fields);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      title: 'Analyzed Item',
      notes: 'AI notes',
      data: { artist: 'Miles Davis' },
    });
  });

  it('edge case: rejects invalid inputs (empty base64 or non-array fields) with a clear error', async () => {
    /**
     * Verifies input validation for boundary/empty inputs.
     * The AI layer should fail fast with a helpful error instead of sending bad requests.
     */
    vi.stubGlobal('fetch', vi.fn());
    const mod = await importGeminiServiceFresh();

    // Empty base64 string
    // Expectation: should throw (or otherwise clearly reject) due to invalid input.
    await expect(mod.analyzeImage('', fields)).rejects.toThrow();

    // Fields must be an array
    await expect(mod.analyzeImage('BASE64', null as any)).rejects.toThrow();
  });

  it('timeout: returns null after ~30s when the request does not complete (non-blocking)', async () => {
    /**
     * Verifies non-blocking timeout behavior:
     * - If the fetch never resolves, the request is aborted around 30 seconds
     * - The function should resolve to null (caller can continue manually)
     *
     * NOTE: Uses fake timers to avoid waiting 30 real seconds.
     */
    vi.useFakeTimers();

    const hangingFetch = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        const signal = init?.signal as AbortSignal | undefined;
        if (signal) {
          signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), {
            once: true,
          });
        }
      });
    });
    vi.stubGlobal('fetch', hangingFetch);

    const mod = await importGeminiServiceFresh();

    const promise = mod.analyzeImage('BASE64', fields) as unknown as Promise<any>;

    // Attach handlers BEFORE advancing timers so AbortError never becomes "temporarily unhandled".
    let resolvedValue: unknown;
    let rejectedError: unknown;
    const settled = promise.then((v) => (resolvedValue = v)).catch((e) => (rejectedError = e));

    await vi.advanceTimersByTimeAsync(30_000);
    await settled;

    expect(rejectedError).toBeUndefined();
    expect(resolvedValue).toBeNull();
  });

  it('error cases: network failures / 401 / 429 return null (graceful degradation)', async () => {
    /**
     * Verifies that common failure modes do not hard-block the UI:
     * - transport/network error
     * - invalid API key (401)
     * - rate limiting (429)
     *
     * Expected behavior: return null so callers can fall back to manual entry.
     */
    const mod = await importGeminiServiceFresh();

    // Network failure (fetch throws)
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new Error('Network down'))));
    {
      const p = mod.analyzeImage('BASE64', fields);
      let value: unknown;
      let err: unknown;
      await p.then((v) => (value = v)).catch((e) => (err = e));
      expect(err).toBeUndefined();
      expect(value).toBeNull();
    }

    // 401
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ error: 'Invalid API key' }), { status: 401 })),
    );
    {
      const p = mod.analyzeImage('BASE64', fields);
      let value: unknown;
      let err: unknown;
      await p.then((v) => (value = v)).catch((e) => (err = e));
      expect(err).toBeUndefined();
      expect(value).toBeNull();
    }

    // 429
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ error: 'Rate limit' }), { status: 429 })),
    );
    {
      const p = mod.analyzeImage('BASE64', fields);
      let value: unknown;
      let err: unknown;
      await p.then((v) => (value = v)).catch((e) => (err = e));
      expect(err).toBeUndefined();
      expect(value).toBeNull();
    }
  });

  it('malformed JSON / schema mismatch: returns null (does not throw)', async () => {
    /**
     * Verifies robustness to unexpected server responses:
     * - response.json() throws (malformed JSON)
     * - missing required keys (schema mismatch)
     *
     * Expected behavior: return null and allow manual flow.
     */
    const mod = await importGeminiServiceFresh();

    // Malformed JSON: response.json throws
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        const res = createOkJsonResponse({ ok: true });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (res as any).json = () => Promise.reject(new Error('Invalid JSON'));
        return res;
      }),
    );
    {
      const p = mod.analyzeImage('BASE64', fields);
      let value: unknown;
      let err: unknown;
      await p.then((v) => (value = v)).catch((e) => (err = e));
      expect(err).toBeUndefined();
      expect(value).toBeNull();
    }

    // Schema mismatch: missing title/notes/data
    vi.stubGlobal('fetch', vi.fn(async () => createOkJsonResponse({ title: 123 })));
    {
      const p = mod.analyzeImage('BASE64', fields);
      let value: unknown;
      let err: unknown;
      await p.then((v) => (value = v)).catch((e) => (err = e));
      expect(err).toBeUndefined();
      expect(value).toBeNull();
    }
  });
});


