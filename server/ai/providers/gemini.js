import { GoogleGenAI, Type } from '@google/genai';

const TYPE_MAP = {
  string: Type.STRING,
  number: Type.NUMBER,
  boolean: Type.BOOLEAN,
  object: Type.OBJECT,
  array: Type.ARRAY,
};

const toGeminiSchema = (schema) => {
  if (!schema || typeof schema !== 'object') return schema;
  const converted = { ...schema, type: TYPE_MAP[schema.type] || schema.type };
  if (schema.properties) {
    converted.properties = Object.fromEntries(
      Object.entries(schema.properties).map(([key, value]) => [key, toGeminiSchema(value)]),
    );
  }
  if (schema.items) converted.items = toGeminiSchema(schema.items);
  return converted;
};

// The vision call is the product's headline path ("snap a photo, Curio
// suggests the details"), and its most common production failure is a
// transient upstream 5xx — Gemini returning "503 model overloaded" or a
// gateway deadline. Retry those a bounded number of times so a brief blip
// doesn't force every capture onto the manual path (CUR/#433). Only
// transient errors are retried; auth, safety, and bad-request (4xx) failures
// surface immediately, and callers keep their manual fallback either way.
const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_BASE_DELAY_MS = 300;
// Kept in sync with the client-side classifier (src/services/aiService.ts):
// 408 Request Timeout and 425 Too Early are transient, plus 429 and the 5xx
// family. A numeric status decides on its own (see isRetryableError), so a
// timeout that arrives as a status code must be listed here to be retried.
const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);
// `@google/genai` wraps a failed underlying fetch (socket reset, DNS blip,
// dropped connection) into a generic "fetch failed" / "socket hang up"
// TypeError with no numeric status and the nested Undici code discarded, so
// those forms are listed explicitly alongside the status-bearing messages.
const RETRYABLE_MESSAGE =
  /overload|unavailable|try again|temporarily|deadline exceeded|timeout|econnreset|etimedout|fetch failed|socket hang up|network error|503|502|504/i;

// Google GenAI surfaces the HTTP status as a number on the error, or embeds it
// in the message; a 429 here is Gemini rate-limiting us, distinct from the
// gateway's own per-user limiter.
const getErrorStatus = (error) => {
  const direct = error?.status ?? error?.statusCode ?? error?.code;
  if (typeof direct === 'number') return direct;
  return undefined;
};

const isRetryableError = (error) => {
  // A definitive numeric status decides on its own: a non-retryable 4xx (auth,
  // safety, bad request) must surface immediately even when its human-readable
  // message happens to contain heuristic wording like "try again". Fall back to
  // message matching only when no numeric status is available.
  const status = getErrorStatus(error);
  if (status !== undefined) return RETRYABLE_STATUS.has(status);
  // No numeric status: match on the message plus the wrapped `cause` chain,
  // where the SDK often preserves the original transport code/message.
  const text = [error?.status, error?.message, error?.cause?.code, error?.cause?.message]
    .filter(Boolean)
    .join(' ');
  return RETRYABLE_MESSAGE.test(text);
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const withRetry = async (fn, { attempts, baseDelayMs, sleep }) => {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      if (attempt >= attempts || !isRetryableError(error)) throw error;
      // Exponential backoff (300ms, 600ms, …) with jitter, kept small so the
      // manual-entry fallback stays responsive when retries ultimately fail.
      const backoff = baseDelayMs * 2 ** (attempt - 1) + Math.floor(Math.random() * baseDelayMs);
      await sleep(backoff);
    }
  }
};

export const createGeminiProvider = ({ apiKey, model, client: injectedClient, retry } = {}) => {
  const client = injectedClient || new GoogleGenAI({ apiKey });
  const retryOptions = {
    attempts: retry?.attempts ?? DEFAULT_MAX_ATTEMPTS,
    baseDelayMs: retry?.baseDelayMs ?? DEFAULT_BASE_DELAY_MS,
    sleep: retry?.sleep ?? wait,
  };
  const generateStructured = async ({ parts, schema }) => {
    const response = await withRetry(
      () =>
        client.models.generateContent({
          model,
          contents: { parts },
          config: {
            responseMimeType: 'application/json',
            responseSchema: toGeminiSchema(schema),
          },
        }),
      retryOptions,
    );
    return JSON.parse(response.text || '{}');
  };

  return {
    name: 'gemini',
    model,
    analyzeImage: ({ imageBase64, prompt, schema }) =>
      generateStructured({
        parts: [{ inlineData: { mimeType: 'image/jpeg', data: imageBase64 } }, { text: prompt }],
        schema,
      }),
    generateStructuredText: ({ prompt, schema }) =>
      generateStructured({ parts: [{ text: prompt }], schema }),
  };
};
