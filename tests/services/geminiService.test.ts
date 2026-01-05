/**
 * Phase 3.1: services/geminiService.ts — AI Analysis Tests
 *
 * Tests for the Gemini AI service that handles image analysis.
 *
 * Note: The current implementation throws errors on failure. The roadmap suggests
 * graceful degradation (returning null), but this isn't implemented yet. These tests
 * verify the actual behavior. Graceful degradation is tracked as a future enhancement.
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

  it('happy path: posts image + field schema to /gemini/analyze and returns {title, notes, data}', async () => {
    /**
     * Verifies the typical AI analysis request:
     * - Uses the correct API route (/gemini/analyze - not /api/gemini/analyze)
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

  it('throws when AI is disabled', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(createOkJsonResponse({ geminiConfigured: false })),
    );
    const mod = await importGeminiServiceFresh({ aiEnabled: 'false' });

    await expect(mod.analyzeImage('BASE64', fields)).rejects.toThrow('AI is disabled');
  });

  it('throws on network failure (fetch rejects)', async () => {
    /**
     * Current behavior: network failures throw errors.
     * The caller (UI) should catch and handle gracefully.
     */
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
    await expect(mod.analyzeImage('BASE64', fields)).rejects.toThrow('Network down');
  });

  it('throws on non-OK response (401, 429, etc)', async () => {
    /**
     * Current behavior: non-OK HTTP responses throw errors with the error message.
     */
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
    await expect(mod.analyzeImage('BASE64', fields)).rejects.toThrow('Invalid API key');
  });

  it('aborts request after 30s timeout', async () => {
    /**
     * Verifies the timeout behavior:
     * - The request is aborted after 30 seconds
     * - An AbortError is thrown
     */
    vi.useFakeTimers();

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

    // Capture the rejection before advancing timers to avoid unhandled rejection warning
    let error: Error | undefined;
    promise.catch((e) => {
      error = e;
    });

    // Advance past the 30s timeout
    await vi.advanceTimersByTimeAsync(30_000);

    // Wait for the promise to settle
    await expect(promise).rejects.toThrow();
    expect(error).toBeDefined();
  });

  it('throws on malformed JSON response', async () => {
    /**
     * Current behavior: if response.json() fails, the error propagates.
     */
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('/health')) {
          return createOkJsonResponse({ geminiConfigured: true });
        }
        const res = new Response('not valid json', { status: 200 });
        return res;
      }),
    );

    const mod = await importGeminiServiceFresh();
    await expect(mod.analyzeImage('BASE64', fields)).rejects.toThrow();
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
