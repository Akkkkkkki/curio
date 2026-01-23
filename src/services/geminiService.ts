import { FieldDefinition, UserCollection, EnhancementStrength } from '../types';
import { supabase } from './supabase';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
const AI_ENABLED_ENV = import.meta.env.VITE_AI_ENABLED;
const AI_ENABLED = AI_ENABLED_ENV === undefined ? null : AI_ENABLED_ENV === 'true';
const AI_IMAGE_EDIT_ENABLED_ENV = import.meta.env.VITE_AI_IMAGE_EDIT_ENABLED;
const AI_IMAGE_EDIT_ENABLED =
  AI_IMAGE_EDIT_ENABLED_ENV === undefined ? null : AI_IMAGE_EDIT_ENABLED_ENV === 'true';
const VOICE_GUIDE_ENABLED = import.meta.env.VITE_VOICE_GUIDE_ENABLED === 'true';
const REQUEST_TIMEOUT_MS = 30000;
const ENHANCEMENT_TIMEOUT_MS = 60000; // Longer timeout for image generation
let aiEnabledCache: boolean | null = AI_ENABLED;
let aiImageEditEnabledCache: boolean | null = AI_IMAGE_EDIT_ENABLED;
let aiEnabledPromise: Promise<boolean> | null = null;
let aiImageEditEnabledPromise: Promise<boolean> | null = null;

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
      throw new Error(message);
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
export const isVoiceGuideEnabled = () => isAiEnabled() && VOICE_GUIDE_ENABLED;

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

export const analyzeImage = async (
  base64Image: string,
  fields: FieldDefinition[],
): Promise<{ title: string; data: Record<string, any>; notes: string } | null> => {
  // Graceful degradation: return null if AI is disabled or on any failure
  // This allows the UI to remain functional and let users proceed without AI
  try {
    if (!(await refreshAiEnabled())) {
      return null;
    }
    return await postJson('/api/gemini/analyze', { imageBase64: base64Image, fields });
  } catch (error) {
    // Log for debugging but don't block the user
    console.warn('AI analysis failed:', error);
    return null;
  }
};

export interface EnhanceImageResult {
  enhancedImageBase64: string;
  metadata: {
    model: string;
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

interface MuseumGuideSession {
  sendRealtimeInput: (input: { media: { data: string; mimeType: string } }) => void;
}

export const connectMuseumGuide = async (
  _col: UserCollection,
  _cb: any,
  _inst?: string,
): Promise<MuseumGuideSession> => {
  if (!isVoiceGuideEnabled()) {
    throw new Error('Voice guide is disabled');
  }
  throw new Error('Voice guide is not available in this build');
};
