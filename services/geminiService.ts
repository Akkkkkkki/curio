import { FieldDefinition, UserCollection } from "../types";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
const AI_ENABLED = import.meta.env.VITE_AI_ENABLED === 'true';
const VOICE_GUIDE_ENABLED = import.meta.env.VITE_VOICE_GUIDE_ENABLED === 'true';
const REQUEST_TIMEOUT_MS = 30000;

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

export const isAiEnabled = () => AI_ENABLED;
export const isVoiceGuideEnabled = () => AI_ENABLED && VOICE_GUIDE_ENABLED;

export const analyzeImage = async (
  base64Image: string,
  fields: FieldDefinition[]
): Promise<{ title: string; data: Record<string, any>; notes: string }> => {
  if (!AI_ENABLED) {
    throw new Error('AI is disabled');
  }
  return postJson('/api/gemini/analyze', { imageBase64: base64Image, fields });
};

export const connectMuseumGuide = async (_col: UserCollection, _cb: any, _inst?: string) => {
  if (!isVoiceGuideEnabled()) {
    throw new Error('Voice guide is disabled');
  }
  throw new Error('Voice guide is not available in this build');
};
