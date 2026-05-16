/**
 * Phase 3.1: services/geminiService.ts — AI Analysis Tests
 *
 * Success criteria:
 * - Non-blocking failures: UI remains functional if AI fails
 * - Timeout handling: User can proceed without AI (timeout returns null)
 * - Schema validation: Response matches FieldDefinition[] structure
 *
 * IMPORTANT: Per product requirements, analyzeImage returns null on any failure
 * to ensure graceful degradation and non-blocking UX.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { FieldDefinition } from '@/types';

// Mock supabase module to prevent issues with auth.getSession() and fake timers
vi.mock('@/services/supabase', () => ({
  supabase: null,
  isSupabaseConfigured: () => false,
  ensureAuth: async () => null,
  signUpWithEmail: async () => null,
  signInWithEmail: async () => null,
  signOutUser: async () => {},
}));

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

  it('happy path: posts image + field schema to /gemini/analyze and returns {title, aiDescription, notes (alias), data}', async () => {
    const fetchSpy = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url =
        typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      if (url.endsWith('/gemini/analyze')) {
        expect(init?.method).toBe('POST');
        const body = JSON.parse(String(init?.body ?? 'null'));
        expect(body).toMatchObject({ imageBase64: 'BASE64', fields });
        return createOkJsonResponse({
          title: 'Analyzed Item',
          aiDescription: 'A vinyl record with a blue cover.',
          notes: 'A vinyl record with a blue cover.',
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
      status: 'success',
      title: 'Analyzed Item',
      aiDescription: 'A vinyl record with a blue cover.',
      notes: 'A vinyl record with a blue cover.',
      data: { artist: 'Miles Davis' },
    });
  });

  it('falls back to legacy `notes` field when server omits aiDescription', async () => {
    const fetchSpy = vi.fn(async (input: RequestInfo | URL) => {
      const url =
        typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      if (url.endsWith('/gemini/analyze')) {
        return createOkJsonResponse({
          title: 'Legacy server',
          notes: 'Only the old field.',
          data: {},
        });
      }
      return createOkJsonResponse({ geminiConfigured: true });
    });
    vi.stubGlobal('fetch', fetchSpy);

    const mod = await importGeminiServiceFresh();
    const result = await mod.analyzeImage('BASE64', fields);

    expect(result).toMatchObject({
      status: 'success',
      aiDescription: 'Only the old field.',
      notes: 'Only the old field.',
    });
  });

  it('graceful degradation: returns {status:"disabled"} when AI is disabled', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(createOkJsonResponse({ geminiConfigured: false })),
    );
    const mod = await importGeminiServiceFresh({ aiEnabled: 'false' });

    const result = await mod.analyzeImage('BASE64', fields);
    expect(result).toEqual({ status: 'disabled' });
  });

  it('graceful degradation: returns {status:"error"} on network failure', async () => {
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

    expect(result).toEqual({ status: 'error', message: 'Network down' });
    expect(warnSpy).toHaveBeenCalledWith('AI analysis failed:', expect.any(Error));

    warnSpy.mockRestore();
  });

  it('graceful degradation: returns {status:"error"} on non-OK response (401, 429, etc)', async () => {
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

    expect(result.status).toBe('error');
    warnSpy.mockRestore();
  });

  it('graceful degradation: returns {status:"error"} after 30s timeout', async () => {
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

    let result: unknown;
    promise.then((r) => {
      result = r;
    });

    await vi.advanceTimersByTimeAsync(30_000);
    await vi.runAllTimersAsync();

    expect((result as any).status).toBe('error');
    warnSpy.mockRestore();
  });

  it('graceful degradation: returns {status:"error"} on malformed JSON response', async () => {
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

    expect(result.status).toBe('error');
    warnSpy.mockRestore();
  });
});

describe('services/geminiService.ts - suggestCollectionFields', () => {
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

  it('posts description + locale to /gemini/suggest-fields and returns fields', async () => {
    const fetchSpy = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url =
        typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      if (url.endsWith('/gemini/suggest-fields')) {
        expect(init?.method).toBe('POST');
        const body = JSON.parse(String(init?.body ?? 'null'));
        expect(body).toMatchObject({ description: 'Vintage postcards', locale: 'en' });
        return createOkJsonResponse({ fields: ['Era', 'Country'] });
      }
      return createOkJsonResponse({ geminiConfigured: true });
    });
    vi.stubGlobal('fetch', fetchSpy);

    const mod = await importGeminiServiceFresh();
    const result = await mod.suggestCollectionFields('Vintage postcards', 'en');
    expect(result).toEqual(['Era', 'Country']);
  });

  it('returns null when AI is disabled', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(createOkJsonResponse({ geminiConfigured: false })),
    );
    const mod = await importGeminiServiceFresh({ aiEnabled: 'false' });

    const result = await mod.suggestCollectionFields('Vintage postcards', 'en');
    expect(result).toBeNull();
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

describe('services/geminiService.ts - enhanceImage', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.stubEnv('VITE_API_BASE_URL', 'http://localhost:8787');
    vi.stubEnv('VITE_AI_ENABLED', 'true');
    vi.stubEnv('VITE_AI_IMAGE_EDIT_ENABLED', 'true');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('happy path: posts image to /gemini/enhance and returns enhanced image', async () => {
    const fetchSpy = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url =
        typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      if (url.endsWith('/gemini/enhance')) {
        expect(init?.method).toBe('POST');
        const body = JSON.parse(String(init?.body ?? 'null'));
        expect(body).toMatchObject({ imageBase64: 'BASE64_IMAGE', strength: 'subtle' });
        return createOkJsonResponse({
          enhancedImageBase64: 'ENHANCED_BASE64',
          metadata: {
            strength: 'subtle',
            promptVersion: 1,
            timestamp: '2026-01-19T00:00:00.000Z',
          },
        });
      }
      // Health check
      return createOkJsonResponse({ geminiConfigured: true });
    });
    vi.stubGlobal('fetch', fetchSpy);

    const mod = await importGeminiServiceFresh();
    const result = await mod.enhanceImage('BASE64_IMAGE', 'subtle');

    expect(result).toEqual({
      enhancedImageBase64: 'ENHANCED_BASE64',
      metadata: {
        strength: 'subtle',
        promptVersion: 1,
        timestamp: '2026-01-19T00:00:00.000Z',
      },
    });
  });

  it('supports beautified strength option', async () => {
    const fetchSpy = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url =
        typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      if (url.endsWith('/gemini/enhance')) {
        const body = JSON.parse(String(init?.body ?? 'null'));
        expect(body.strength).toBe('beautified');
        return createOkJsonResponse({
          enhancedImageBase64: 'BEAUTIFIED_BASE64',
          metadata: {
            strength: 'beautified',
            promptVersion: 1,
            timestamp: '2026-01-19T00:00:00.000Z',
          },
        });
      }
      return createOkJsonResponse({ geminiConfigured: true });
    });
    vi.stubGlobal('fetch', fetchSpy);

    const mod = await importGeminiServiceFresh();
    const result = await mod.enhanceImage('BASE64_IMAGE', 'beautified');

    expect(result?.metadata.strength).toBe('beautified');
  });

  it('throws error with detailed message on API failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('/health')) {
          return createOkJsonResponse({ geminiConfigured: true });
        }
        return new Response(
          JSON.stringify({
            error: 'Image enhancement failed',
            details: 'Model not available. The image generation model may not be enabled.',
          }),
          { status: 503 },
        );
      }),
    );

    const mod = await importGeminiServiceFresh();

    await expect(mod.enhanceImage('BASE64_IMAGE')).rejects.toThrow(
      'Image enhancement failed: Model not available',
    );
  });

  it('throws error on network failure (unlike analyzeImage which returns null)', async () => {
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

    // enhanceImage throws errors (unlike analyzeImage which returns null)
    // This is intentional so the UI can show specific error messages
    await expect(mod.enhanceImage('BASE64_IMAGE')).rejects.toThrow('Network down');
  });

  it('returns null when AI image editing is explicitly disabled', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // Import with AI_IMAGE_EDIT explicitly disabled
    vi.resetModules();
    vi.stubEnv('VITE_API_BASE_URL', 'http://localhost:8787');
    vi.stubEnv('VITE_AI_ENABLED', 'true');
    vi.stubEnv('VITE_AI_IMAGE_EDIT_ENABLED', 'false');

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(createOkJsonResponse({ geminiConfigured: true })),
    );

    const mod = await import('@/services/geminiService');

    const result = await mod.enhanceImage('BASE64_IMAGE');
    expect(result).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith('AI image editing is disabled');

    warnSpy.mockRestore();
  });
});
