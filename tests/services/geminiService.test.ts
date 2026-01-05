/**
 * Phase 3.1: services/geminiService.ts — AI Analysis Tests
 *
 * Success criteria (from docs/TESTING_ROADMAP.md):
 * - Non-blocking failures: UI remains functional if AI fails
 * - Timeout handling: User can proceed without AI (timeout returns null)
 * - Schema validation: Response matches FieldDefinition[] structure
 *
 * IMPORTANT: Per product requirements, analyzeImage returns null on any failure
 * to ensure graceful degradation and non-blocking UX.
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

  it('happy path: posts image + field schema to /gemini/analyze and returns {title, notes, data}', async () => {
    /**
     * Verifies the typical AI analysis request:
     * - Uses the correct API route (/gemini/analyze)
     * - Sends { imageBase64, fields } in the JSON body
     * - Returns the expected response shape for downstream UI usage
     */
    const fetchSpy = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url =
        typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      if (url.endsWith('/gemini/analyze')) {
        expect(init?.method).toBe('POST');
        const body = JSON.parse(String(init?.body ?? 'null'));
        expect(body).toMatchObject({ imageBase64: 'BASE64', fields });
        return createOkJsonResponse({
          title: 'Analyzed Item',
          notes: 'AI notes',
          data: { artist: 'Miles Davis' },
        });
      }
      // Health check
      return createOkJsonResponse({ geminiConfigured: true });
    });
    vi.stubGlobal('fetch', fetchSpy);

    const mod = await importGeminiServiceFresh();
    const result = await mod.analyzeImage('BASE64', fields);

    expect(result).toEqual({
      title: 'Analyzed Item',
      notes: 'AI notes',
      data: { artist: 'Miles Davis' },
    });
  });

  it('graceful degradation: returns null when AI is disabled', async () => {
    /**
     * Per product requirements: AI failures should not block the UI.
     * When AI is disabled, analyzeImage returns null so users can proceed manually.
     */
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(createOkJsonResponse({ geminiConfigured: false })),
    );
    const mod = await importGeminiServiceFresh({ aiEnabled: 'false' });

    const result = await mod.analyzeImage('BASE64', fields);
    expect(result).toBeNull();
  });

  it('graceful degradation: returns null on network failure', async () => {
    /**
     * Per product requirements: Network failures should not block the UI.
     * analyzeImage catches errors and returns null.
     */
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('/health')) {
          return createOkJsonResponse({ geminiConfigured: true });
        }
        throw new Error('Network down');
      }),
    );

    const mod = await importGeminiServiceFresh();
    const result = await mod.analyzeImage('BASE64', fields);

    expect(result).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith('AI analysis failed:', expect.any(Error));

    warnSpy.mockRestore();
  });

  it('graceful degradation: returns null on non-OK response (401, 429, etc)', async () => {
    /**
     * Per product requirements: API errors should not block the UI.
     */
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('/health')) {
          return createOkJsonResponse({ geminiConfigured: true });
        }
        return new Response(JSON.stringify({ error: 'Invalid API key' }), { status: 401 });
      }),
    );

    const mod = await importGeminiServiceFresh();
    const result = await mod.analyzeImage('BASE64', fields);

    expect(result).toBeNull();
    warnSpy.mockRestore();
  });

  it('graceful degradation: returns null after 30s timeout', async () => {
    /**
     * Per product requirements: "Timeout: Returns null after 30s (non-blocking)"
     * Users can proceed without AI if the request takes too long.
     */
    vi.useFakeTimers();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const fetchSpy = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.includes('/health')) {
        return createOkJsonResponse({ geminiConfigured: true });
      }
      return new Promise<Response>((_resolve, reject) => {
        const signal = init?.signal as AbortSignal | undefined;
        if (signal) {
          signal.addEventListener(
            'abort',
            () => reject(new DOMException('Aborted', 'AbortError')),
            { once: true },
          );
        }
      });
    });
    vi.stubGlobal('fetch', fetchSpy);

    const mod = await importGeminiServiceFresh();

    const promise = mod.analyzeImage('BASE64', fields);

    // Capture result
    let result: unknown;
    promise.then((r) => {
      result = r;
    });

    // Advance past the 30s timeout
    await vi.advanceTimersByTimeAsync(30_000);

    // Wait for all timers and promises to settle
    await vi.runAllTimersAsync();

    expect(result).toBeNull();
    warnSpy.mockRestore();
  });

  it('graceful degradation: returns null on malformed JSON response', async () => {
    /**
     * Per product requirements: Schema mismatch should not crash the app.
     */
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('/health')) {
          return createOkJsonResponse({ geminiConfigured: true });
        }
        return new Response('not valid json', { status: 200 });
      }),
    );

    const mod = await importGeminiServiceFresh();
    const result = await mod.analyzeImage('BASE64', fields);

    expect(result).toBeNull();
    warnSpy.mockRestore();
  });
});

describe('services/geminiService.ts - AI availability', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('isAiEnabled returns cached value when VITE_AI_ENABLED is set', async () => {
    // When VITE_AI_ENABLED=true is set, the module caches it at load time
    const mod = await importGeminiServiceFresh({ aiEnabled: 'true' });

    // Should return true immediately without health check
    const result = await mod.refreshAiEnabled();
    expect(result).toBe(true);
    expect(mod.isAiEnabled()).toBe(true);
  });

  it('isAiEnabled returns true when VITE_AI_ENABLED=true without health check', async () => {
    const mod = await importGeminiServiceFresh({ aiEnabled: 'true' });
    expect(mod.isAiEnabled()).toBe(true);
  });

  it('isVoiceGuideEnabled requires both AI enabled and VOICE_GUIDE_ENABLED', async () => {
    const mod = await importGeminiServiceFresh({ aiEnabled: 'true' });
    // Voice guide is disabled by default
    expect(mod.isVoiceGuideEnabled()).toBe(false);
  });
});
