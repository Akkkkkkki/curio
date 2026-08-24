import { FieldDefinition, EnhancementStrength } from '../types';
import { supabase } from './supabase';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
const AI_ENABLED_ENV = import.meta.env.VITE_AI_ENABLED;
const AI_ENABLED = AI_ENABLED_ENV === undefined ? null : AI_ENABLED_ENV === 'true';
const AI_IMAGE_EDIT_ENABLED_ENV = import.meta.env.VITE_AI_IMAGE_EDIT_ENABLED;
const AI_IMAGE_EDIT_ENABLED =
  AI_IMAGE_EDIT_ENABLED_ENV === undefined ? null : AI_IMAGE_EDIT_ENABLED_ENV === 'true';
const REQUEST_TIMEOUT_MS = 30000;
const ENHANCEMENT_TIMEOUT_MS = 60000; // Longer timeout for image generation
let aiEnabledCache: boolean | null = AI_ENABLED;
let aiImageEditEnabledCache: boolean | null = AI_IMAGE_EDIT_ENABLED;
let aiEnabledPromise: Promise<boolean> | null = null;
let aiImageEditEnabledPromise: Promise<boolean> | null = null;

/**
 * Error thrown when an AI proxy request returns a non-OK HTTP status. Carries
 * the status code so callers can tell a transient failure (retry likely helps)
 * from a hard one (retrying the same request won't).
 */
export class AiRequestError extends Error {
  readonly status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = 'AiRequestError';
    this.status = status;
  }
}

// The only 4xx client errors a plain retry of the same request can fix:
// 408 Request Timeout, 425 Too Early, and 429 Too Many Requests. Every other
// 4xx (bad/blocked/oversized/auth) is hard by default.
const RETRYABLE_CLIENT_STATUSES = new Set([408, 425, 429]);

/**
 * Whether a failed AI request is worth retrying. Server (5xx), the three
 * retryable 4xx statuses above, timeouts, and unknown/network failures are
 * treated as transient; all other client (4xx) errors are hard.
 */
export const isRetryableAiError = (error: unknown): boolean => {
  if (error instanceof AiRequestError && typeof error.status === 'number') {
    // Any non-allowlisted 4xx is a hard client error — retrying the same
    // request won't help.
    if (error.status >= 400 && error.status < 500) {
      return RETRYABLE_CLIENT_STATUSES.has(error.status);
    }
    // 5xx and any other status are treated as transient.
    return true;
  }
  // Timeouts, dropped connections, and unclassified failures are usually
  // transient, so default to offering a retry.
  return true;
};

const postJson = async <T>(
  path: string,
  body: unknown,
  timeoutMs = REQUEST_TIMEOUT_MS,
): Promise<T> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  // Build headers with optional auth token
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  if (supabase) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`;
    }
  }

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!response.ok) {
      const errorPayload = await response.json().catch(() => ({}));
      const details = errorPayload?.details ? `: ${errorPayload.details}` : '';
      const message = errorPayload?.error
        ? `${errorPayload.error}${details}`
        : `AI request failed (${response.status})`;
      throw new AiRequestError(message, response.status);
    }
    return response.json() as Promise<T>;
  } finally {
    clearTimeout(timer);
  }
};

const fetchAiHealth = async (): Promise<boolean> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/health`);
    if (!response.ok) return false;
    const payload = await response.json().catch(() => ({}));
    return Boolean(payload?.geminiConfigured);
  } catch {
    return false;
  }
};

export const refreshAiEnabled = async (): Promise<boolean> => {
  if (aiEnabledCache !== null) return aiEnabledCache;
  if (aiEnabledPromise) return aiEnabledPromise;
  aiEnabledPromise = fetchAiHealth()
    .then((enabled) => {
      aiEnabledCache = enabled;
      return enabled;
    })
    .finally(() => {
      aiEnabledPromise = null;
    });
  return aiEnabledPromise;
};

export const isAiEnabled = () => aiEnabledCache === true;

// Image editing is enabled if: AI is enabled AND the feature flag is not explicitly false
export const refreshAiImageEditEnabled = async (): Promise<boolean> => {
  if (aiImageEditEnabledCache !== null) return aiImageEditEnabledCache;
  if (AI_IMAGE_EDIT_ENABLED === false) {
    aiImageEditEnabledCache = false;
    return false;
  }
  if (aiImageEditEnabledPromise) return aiImageEditEnabledPromise;
  aiImageEditEnabledPromise = fetchAiHealth()
    .then((enabled) => {
      aiImageEditEnabledCache = enabled;
      return enabled;
    })
    .finally(() => {
      aiImageEditEnabledPromise = null;
    });
  return aiImageEditEnabledPromise;
};

export const isAiImageEditEnabled = () => aiImageEditEnabledCache === true;

type CollectionContext = {
  name?: string;
  description?: string;
};

export type AnalyzeResult =
  | {
      status: 'success';
      title: string;
      data: Record<string, any>;
      aiDescription: string;
      /** @deprecated Mirrors aiDescription. Will be removed once CUR-13 settles. */
      notes: string;
    }
  | { status: 'disabled' }
  | { status: 'error'; message: string; retryable: boolean };

export const analyzeImage = async (
  base64Image: string,
  fields: FieldDefinition[],
  options: { collectionContext?: CollectionContext; locale?: string } = {},
): Promise<AnalyzeResult> => {
  try {
    if (!(await refreshAiEnabled())) {
      return { status: 'disabled' };
    }
    const result = await postJson<{
      title: string;
      data: Record<string, any>;
      aiDescription?: string;
      notes?: string;
    }>('/api/gemini/analyze', {
      imageBase64: base64Image,
      fields,
      collectionContext: options.collectionContext,
      locale: options.locale,
    });
    const aiDescription = result.aiDescription ?? result.notes ?? '';
    return {
      status: 'success',
      title: result.title,
      data: result.data ?? {},
      aiDescription,
      notes: aiDescription,
    };
  } catch (error) {
    console.warn('AI analysis failed:', error);
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'AI analysis failed',
      retryable: isRetryableAiError(error),
    };
  }
};

const STORY_PROMPTS_TIMEOUT_MS = 3000;

export interface StoryPromptsRequest {
  title: string;
  collectionContext?: CollectionContext;
  aiDescription?: string;
  knownFields?: Record<string, string | number>;
  locale?: string;
}

/**
 * Fetch 3 short, object-specific story prompts from the proxy. Returns
 * `{ prompts: [] }` on any failure — prompts are an enhancement and must
 * never block the capture flow (PRODUCT_DESIGN §2.4).
 */
export const fetchStoryPrompts = async (
  req: StoryPromptsRequest,
): Promise<{ prompts: string[] }> => {
  try {
    if (!(await refreshAiEnabled())) {
      return { prompts: [] };
    }
    const result = await postJson<{ prompts?: unknown }>(
      '/api/gemini/story-prompts',
      req,
      STORY_PROMPTS_TIMEOUT_MS,
    );
    const prompts = Array.isArray(result?.prompts)
      ? result.prompts.filter((p): p is string => typeof p === 'string' && p.trim().length > 0)
      : [];
    return { prompts };
  } catch (error) {
    console.warn('Story prompts fetch failed:', error);
    return { prompts: [] };
  }
};

export const suggestCollectionFields = async (
  description: string,
  locale?: string,
): Promise<string[] | null> => {
  try {
    if (!(await refreshAiEnabled())) {
      return null;
    }
    const result = await postJson<{ fields: string[] }>('/api/gemini/suggest-fields', {
      description,
      locale,
    });
    if (!result || !Array.isArray(result.fields)) {
      return null;
    }
    return result.fields;
  } catch (error) {
    console.warn('Field suggestions failed:', error);
    return null;
  }
};

export interface EnhanceImageResult {
  enhancedImageBase64: string;
  metadata: {
    strength: EnhancementStrength;
    promptVersion: number;
    timestamp: string;
  };
}

export const enhanceImage = async (
  base64Image: string,
  strength: EnhancementStrength = 'subtle',
): Promise<EnhanceImageResult | null> => {
  // Graceful degradation: return null if AI image editing is disabled or on any failure
  try {
    if (!(await refreshAiImageEditEnabled())) {
      console.warn('AI image editing is disabled');
      return null;
    }
    return await postJson<EnhanceImageResult>(
      '/api/gemini/enhance',
      { imageBase64: base64Image, strength },
      ENHANCEMENT_TIMEOUT_MS,
    );
  } catch (error) {
    console.warn('Image enhancement failed:', error);
    throw error; // Re-throw so UI can show error message
  }
};
