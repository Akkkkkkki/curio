import { FieldDefinition, EnhancementStrength } from '../types';
import { supabase } from './supabase';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
const AI_ENABLED_ENV = import.meta.env.VITE_AI_ENABLED;
const AI_ENABLED = AI_ENABLED_ENV === undefined ? null : AI_ENABLED_ENV === 'true';
const AI_IMAGE_EDIT_ENABLED_ENV = import.meta.env.VITE_AI_IMAGE_EDIT_ENABLED;
const AI_IMAGE_EDIT_ENABLED =
  AI_IMAGE_EDIT_ENABLED_ENV === undefined ? null : AI_IMAGE_EDIT_ENABLED_ENV === 'true';
const REQUEST_TIMEOUT_MS = 30000;
const ENHANCEMENT_TIMEOUT_MS = 60000;
let aiEnabledCache: boolean | null = AI_ENABLED;
let aiImageEditEnabledCache: boolean | null = AI_IMAGE_EDIT_ENABLED;
let aiEnabledPromise: Promise<boolean> | null = null;
let aiImageEditEnabledPromise: Promise<boolean> | null = null;

export class AiRequestError extends Error {
  readonly status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = 'AiRequestError';
    this.status = status;
  }
}

const RETRYABLE_CLIENT_STATUSES = new Set([408, 425, 429]);

export const isRetryableAiError = (error: unknown): boolean => {
  if (error instanceof AiRequestError && typeof error.status === 'number') {
    if (error.status >= 400 && error.status < 500) {
      return RETRYABLE_CLIENT_STATUSES.has(error.status);
    }
    return true;
  }
  return true;
};

const postJson = async <T>(
  path: string,
  body: unknown,
  timeoutMs = REQUEST_TIMEOUT_MS,
): Promise<T> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  if (supabase) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;
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

interface AiCapabilities {
  metadataAnalysisAvailable: boolean;
  fieldSuggestionsAvailable: boolean;
  storyPromptsAvailable: boolean;
  imageEditingAvailable: boolean;
}

const fetchAiCapabilities = async (): Promise<AiCapabilities> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/health`);
    if (!response.ok) throw new Error('AI health unavailable');
    const payload = await response.json().catch(() => ({}));
    const fallback = Boolean(payload?.geminiConfigured);
    return {
      metadataAnalysisAvailable: payload?.metadataAnalysisAvailable ?? fallback,
      fieldSuggestionsAvailable: payload?.fieldSuggestionsAvailable ?? fallback,
      storyPromptsAvailable: payload?.storyPromptsAvailable ?? fallback,
      imageEditingAvailable: payload?.imageEditingAvailable ?? fallback,
    };
  } catch {
    return {
      metadataAnalysisAvailable: false,
      fieldSuggestionsAvailable: false,
      storyPromptsAvailable: false,
      imageEditingAvailable: false,
    };
  }
};

export const refreshAiEnabled = async (): Promise<boolean> => {
  if (aiEnabledCache !== null) return aiEnabledCache;
  if (aiEnabledPromise) return aiEnabledPromise;
  aiEnabledPromise = fetchAiCapabilities()
    .then((capabilities) => {
      aiEnabledCache = capabilities.metadataAnalysisAvailable;
      return aiEnabledCache;
    })
    .finally(() => {
      aiEnabledPromise = null;
    });
  return aiEnabledPromise;
};

export const isAiEnabled = () => aiEnabledCache === true;

export const refreshAiImageEditEnabled = async (): Promise<boolean> => {
  if (aiImageEditEnabledCache !== null) return aiImageEditEnabledCache;
  if (AI_IMAGE_EDIT_ENABLED === false) {
    aiImageEditEnabledCache = false;
    return false;
  }
  if (aiImageEditEnabledPromise) return aiImageEditEnabledPromise;
  aiImageEditEnabledPromise = fetchAiCapabilities()
    .then((capabilities) => {
      aiImageEditEnabledCache = capabilities.imageEditingAvailable;
      return aiImageEditEnabledCache;
    })
    .finally(() => {
      aiImageEditEnabledPromise = null;
    });
  return aiImageEditEnabledPromise;
};

export const isAiImageEditEnabled = () => aiImageEditEnabledCache === true;

type CollectionContext = { name?: string; description?: string };

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
    if (!(await refreshAiEnabled())) return { status: 'disabled' };
    const result = await postJson<{
      title: string;
      data: Record<string, any>;
      aiDescription?: string;
      notes?: string;
    }>('/api/ai/analyze-item', {
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

export const fetchStoryPrompts = async (
  req: StoryPromptsRequest,
): Promise<{ prompts: string[] }> => {
  try {
    if (!(await refreshAiEnabled())) return { prompts: [] };
    const result = await postJson<{ prompts?: unknown }>(
      '/api/ai/story-prompts',
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
    if (!(await refreshAiEnabled())) return null;
    const result = await postJson<{ fields: string[] }>('/api/ai/suggest-fields', {
      description,
      locale,
    });
    return result && Array.isArray(result.fields) ? result.fields : null;
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
    throw error;
  }
};
