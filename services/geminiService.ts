import { FieldDefinition, UserCollection } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
const AI_ENABLED_ENV = import.meta.env.VITE_AI_ENABLED;
const AI_ENABLED = AI_ENABLED_ENV === undefined ? null : AI_ENABLED_ENV === 'true';
const VOICE_GUIDE_ENABLED = import.meta.env.VITE_VOICE_GUIDE_ENABLED === 'true';
const REQUEST_TIMEOUT_MS = 30000;
let aiEnabledCache: boolean | null = AI_ENABLED;
let aiEnabledPromise: Promise<boolean> | null = null;

const postJson = async <T>(path: string, body: unknown): Promise<T> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!response.ok) {
      const errorPayload = await response.json().catch(() => ({}));
      const message = errorPayload?.error || `AI request failed (${response.status})`;
      throw new Error(message);
    }
    return response.json() as Promise<T>;
  } finally {
    clearTimeout(timer);
  }
};

const fetchAiHealth = async (): Promise<boolean> => {
  try {
    const response = await fetch(`${API_BASE_URL}/health`);
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
    return await postJson('/gemini/analyze', { imageBase64: base64Image, fields });
  } catch (error) {
    // Log for debugging but don't block the user
    console.warn('AI analysis failed:', error);
    return null;
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
