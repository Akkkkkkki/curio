import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import express from 'express';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');

if (process.env.NODE_ENV !== 'production') {
  dotenv.config({ path: path.join(ROOT_DIR, '.env') });
}

const app = express();
const port = process.env.PORT || 8787;

const MAX_LATENCY_SAMPLES = 1000;
const METRICS_ROUTES = new Set([
  '/api/health',
  '/api/gemini/analyze',
  '/api/gemini/enhance',
  '/api/gemini/suggest-fields',
  '/api/gemini/story-prompts',
]);
const metrics = new Map();

const ensureMetric = (route) => {
  if (!metrics.has(route)) {
    metrics.set(route, {
      count: 0,
      errorCount: 0,
      durations: [],
    });
  }
  return metrics.get(route);
};

const recordMetric = (route, status, durationMs) => {
  const metric = ensureMetric(route);
  metric.count += 1;
  if (status >= 400) {
    metric.errorCount += 1;
  }
  metric.durations.push(durationMs);
  if (metric.durations.length > MAX_LATENCY_SAMPLES) {
    metric.durations.shift();
  }
};

const percentile = (values, percentileValue) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((percentileValue / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
};

export const summarizeMetrics = () => {
  const summary = {};
  metrics.forEach((value, route) => {
    summary[route] = {
      requestCount: value.count,
      errorCount: value.errorCount,
      errorRate: value.count ? value.errorCount / value.count : 0,
      latencyMs: {
        p50: percentile(value.durations, 50),
        p95: percentile(value.durations, 95),
      },
    };
  });
  return summary;
};

export const resetMetrics = () => {
  metrics.clear();
};

// Security configuration
const ALLOWED_ORIGINS = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);
const JWT_SECRET = process.env.SUPABASE_JWT_SECRET;
const isProduction = process.env.NODE_ENV === 'production';

// Trust proxy for accurate IP in rate limiting (required for Cloud Run, Vercel, etc.)
app.set('trust proxy', 1);

app.use(express.json({ limit: '15mb' }));

// Request ID and structured logging middleware
app.use((req, res, next) => {
  req.id = randomUUID().slice(0, 8);
  res.setHeader('x-request-id', req.id);
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    if (req.method !== 'OPTIONS' && METRICS_ROUTES.has(req.path)) {
      recordMetric(req.path, res.statusCode, duration);
    }
    const log = {
      event: 'api_request',
      ts: new Date().toISOString(),
      route: req.path,
      method: req.method,
      status: res.statusCode,
      durationMs: duration,
      ok: res.statusCode < 400,
      requestId: req.id,
      deployment: process.env.NODE_ENV || 'unknown',
      commitSha: process.env.VERCEL_GIT_COMMIT_SHA || null,
      userId: req.user?.sub || null,
      ip: req.ip,
    };
    console.log(JSON.stringify(log));
  });

  next();
});

// CORS middleware with allowlist support
app.use((req, res, next) => {
  const origin = req.headers.origin;

  if (ALLOWED_ORIGINS.length > 0) {
    // Production: strict allowlist
    if (origin && ALLOWED_ORIGINS.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    } else if (origin) {
      // Origin not in allowlist
      return res.status(403).json({ error: 'Origin not allowed' });
    }
    // No origin header (same-origin or non-browser request) - allow through
  } else if (!isProduction) {
    // Development: allow any origin
    res.setHeader('Access-Control-Allow-Origin', '*');
  } else {
    // Production without CORS_ORIGINS configured: reject cross-origin
    if (origin) {
      return res.status(403).json({ error: 'CORS not configured for production' });
    }
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Vary', 'Origin');

  if (req.method === 'OPTIONS') return res.sendStatus(204);
  return next();
});

// JWT authentication middleware
const requireAuth = (req, res, next) => {
  // Skip auth in development if no JWT secret configured
  if (!JWT_SECRET) {
    if (isProduction) {
      return res.status(503).json({ error: 'Auth not configured' });
    }
    return next(); // Allow in dev without auth
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing authorization token' });
  }

  try {
    const token = authHeader.slice(7);
    const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
    req.user = decoded; // { sub: userId, email, aud, exp, iat }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

// Rate limiting: per-user (10 requests/minute)
const userLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  keyGenerator: (req) => req.user?.sub || req.ip,
  message: { error: 'Rate limit exceeded. Please wait before trying again.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiting: per-IP blast protection (50 requests/minute)
const ipLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 50,
  keyGenerator: (req) => req.ip,
  message: { error: 'Too many requests from this IP.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const apiKey = process.env.GEMINI_API_KEY;
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

const GEMINI_ANALYZE_MODEL = process.env.GEMINI_ANALYZE_MODEL || 'gemini-2.5-flash';
const GEMINI_IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image';

const MAX_IMAGE_BASE64_LENGTH = 20 * 1024 * 1024; // ~15MB decoded
const MAX_FIELDS_COUNT = 30;

const validateImageBase64 = (imageBase64) => {
  if (typeof imageBase64 !== 'string') return 'imageBase64 must be a string';
  if (imageBase64.length > MAX_IMAGE_BASE64_LENGTH) return 'Image too large (max ~15MB)';
  if (imageBase64.length === 0) return 'imageBase64 is empty';
  return null;
};

const validateFields = (fields) => {
  if (!Array.isArray(fields)) return 'fields must be an array';
  if (fields.length > MAX_FIELDS_COUNT) return `Too many fields (max ${MAX_FIELDS_COUNT})`;
  for (const field of fields) {
    if (!field.id || typeof field.id !== 'string') return 'Each field must have a string id';
    if (!field.type || typeof field.type !== 'string') return 'Each field must have a string type';
  }
  return null;
};

const sanitizeErrorMessage = (error) => {
  if (!(error instanceof Error)) return 'An internal error occurred';
  const msg = error.message;
  if (msg.includes('API key')) return 'AI service authentication failed';
  if (msg.includes('quota') || msg.includes('rate')) return 'AI service rate limit exceeded';
  if (msg.includes('safety') || msg.includes('blocked'))
    return 'Content was blocked by safety filters';
  if (msg.includes('not found') || msg.includes('404')) return 'AI model is currently unavailable';
  return 'AI processing failed';
};

const mapFieldTypeToSchemaType = (type) => {
  switch (type) {
    case 'number':
      return Type.NUMBER;
    case 'boolean':
      return Type.BOOLEAN;
    case 'text':
    case 'long_text':
    case 'select':
    case 'date':
    default:
      return Type.STRING;
  }
};

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, geminiConfigured: Boolean(apiKey) });
});

app.get('/api/metrics', requireAuth, (_req, res) => {
  res.json({
    generatedAt: new Date().toISOString(),
    routes: summarizeMetrics(),
  });
});

app.post('/api/gemini/analyze', ipLimiter, requireAuth, userLimiter, async (req, res) => {
  if (!ai) {
    return res.status(503).json({ error: 'GEMINI_API_KEY is not configured' });
  }

  const { imageBase64, fields, collectionContext, locale } = req.body || {};

  const imageErr = validateImageBase64(imageBase64);
  if (imageErr) return res.status(400).json({ error: imageErr });

  const fieldsErr = validateFields(fields);
  if (fieldsErr) return res.status(400).json({ error: fieldsErr });

  const properties = {
    title: {
      type: Type.STRING,
      description: 'A short, descriptive title for the item.',
    },
    aiDescription: {
      type: Type.STRING,
      description:
        'A factual, neutral visual observation of the item (1-2 sentences). This is hidden metadata; it must NOT attempt to tell a story, infer emotional meaning, or speculate about the owner. Describe only what is visible.',
    },
  };

  fields.forEach((field) => {
    properties[field.id] = {
      type: mapFieldTypeToSchemaType(field.type),
      description: `Value for ${field.label}.`,
    };
    if (field.type === 'select' && field.options) {
      properties[field.id].description += ` Must be one of: ${field.options.join(', ')}`;
    }
  });

  try {
    const contextLines = [];
    if (collectionContext?.name) {
      contextLines.push(`- Name: "${collectionContext.name}"`);
    }
    if (collectionContext?.description) {
      contextLines.push(`- User's description: "${collectionContext.description}"`);
    }
    if (locale) {
      contextLines.push(`- Language: ${locale}`);
    }
    const contextBlock = contextLines.length
      ? `\n\nCollection context:\n${contextLines.join('\n')}`
      : '';

    const response = await ai.models.generateContent({
      model: GEMINI_ANALYZE_MODEL,
      contents: {
        parts: [
          { inlineData: { mimeType: 'image/jpeg', data: imageBase64 } },
          {
            text: `Analyze this image of a collectible item.${contextBlock}\n\nExtract metadata for the provided fields. Match the user's language and style when possible. If a field cannot be determined, leave it null.`,
          },
        ],
      },
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties,
        },
      },
    });

    const result = JSON.parse(response.text || '{}');
    const { title, aiDescription, ...data } = result || {};
    const description = aiDescription || '';
    return res.json({
      title: title || 'New Item',
      aiDescription: description,
      // Backwards-compatible alias for clients still reading `notes` from this
      // endpoint. Remove after the CUR-13 rollout settles (CUR-13 commit E).
      notes: description,
      data: data || {},
    });
  } catch (error) {
    console.error('AI Analysis Failed:', error);
    return res.status(500).json({ error: sanitizeErrorMessage(error) });
  }
});

app.post('/api/gemini/suggest-fields', ipLimiter, requireAuth, userLimiter, async (req, res) => {
  if (!ai) {
    return res.status(503).json({ error: 'GEMINI_API_KEY is not configured' });
  }

  const { description, locale = 'en' } = req.body || {};
  if (!description || typeof description !== 'string') {
    return res.status(400).json({ error: 'Missing description' });
  }

  const maxFields = 6;

  try {
    const response = await ai.models.generateContent({
      model: GEMINI_ANALYZE_MODEL,
      contents: {
        parts: [
          {
            text: `You are helping suggest metadata fields for a personal collection app.\n\nUser's language: ${locale}\nThe user wants to collect: "${description}"\n\nSuggest 4–6 short field names that would be useful for cataloging these items.\n\nRules:\n- Use simple, everyday labels (e.g., "Year" not "Year of Manufacture")\n- Match the user's language (${locale})\n- Focus on attributes a collector would actually track\n- NEVER suggest: "Notes", "Description", "Title", "Name", "Rating", "Diary", "Comments"\n\nReturn JSON: { \"fields\": [...] }`,
          },
        ],
      },
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            fields: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
          },
        },
      },
    });

    const result = JSON.parse(response.text || '{}');
    const rawFields = Array.isArray(result?.fields) ? result.fields : [];
    const fields = [];
    const seen = new Set();
    for (const raw of rawFields) {
      if (typeof raw !== 'string') continue;
      const cleaned = raw.trim().replace(/^[-*•\\d.\\s]+/, '');
      if (!cleaned) continue;
      const key = cleaned.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      fields.push(cleaned.slice(0, 32));
      if (fields.length >= maxFields) break;
    }

    return res.json({ fields });
  } catch (error) {
    console.error('Field suggestion failed:', error);
    return res.status(500).json({ error: sanitizeErrorMessage(error) });
  }
});

app.post('/api/gemini/story-prompts', ipLimiter, requireAuth, userLimiter, async (req, res) => {
  if (!ai) {
    return res.status(503).json({ error: 'GEMINI_API_KEY is not configured' });
  }

  const { title, collectionContext, aiDescription, knownFields, locale = 'en' } = req.body || {};

  if (!title || typeof title !== 'string') {
    return res.status(400).json({ error: 'Missing title' });
  }

  const contextLines = [`- Title: "${title}"`];
  if (collectionContext?.name) contextLines.push(`- Collection: "${collectionContext.name}"`);
  if (collectionContext?.description)
    contextLines.push(`- Collection description: "${collectionContext.description}"`);
  if (aiDescription) contextLines.push(`- Visual observation: "${aiDescription}"`);
  if (knownFields && typeof knownFields === 'object') {
    const knownEntries = Object.entries(knownFields)
      .filter(([, v]) => v !== null && v !== undefined && v !== '')
      .slice(0, 8)
      .map(([k, v]) => `  - ${k}: ${v}`);
    if (knownEntries.length) {
      contextLines.push(`- Known facts:\n${knownEntries.join('\n')}`);
    }
  }

  const systemPrompt = `You are a thoughtful curator helping a collector reflect on an object. Given the object's title and known facts, produce 3 short open-ended questions (max 12 words each) that would help the owner write a personal story about it.

Rules:
- Questions must be specific to the object — mention details from the title or fields where possible.
- Never include the answer.
- Never narrate. Never speculate about feelings.
- Match the user's language: ${locale}.

Context:
${contextLines.join('\n')}

Return only the questions as a JSON object of the schema { "prompts": [string, string, string] }.`;

  try {
    const response = await ai.models.generateContent({
      model: GEMINI_ANALYZE_MODEL,
      contents: { parts: [{ text: systemPrompt }] },
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            prompts: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
          },
        },
      },
    });

    const result = JSON.parse(response.text || '{}');
    const raw = Array.isArray(result?.prompts) ? result.prompts : [];
    const prompts = [];
    const seen = new Set();
    for (const candidate of raw) {
      if (typeof candidate !== 'string') continue;
      const cleaned = candidate.trim().replace(/^[-*•\d.\s]+/, '');
      if (!cleaned) continue;
      const key = cleaned.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      // Cap each prompt at ~12 words; if longer, truncate gracefully.
      const words = cleaned.split(/\s+/);
      const capped = words.length > 14 ? words.slice(0, 12).join(' ') + '…' : cleaned;
      prompts.push(capped);
      if (prompts.length >= 3) break;
    }

    return res.json({ prompts });
  } catch (error) {
    console.error('Story prompt generation failed:', error);
    return res.status(500).json({ error: sanitizeErrorMessage(error) });
  }
});

// Prompt templates for image enhancement
const ENHANCEMENT_PROMPTS = {
  subtle: `Enhance this photo to look cleaner and more presentable while preserving its original character.

Requirements:
- Preserve the subject's identity, angle, and proportions exactly
- Do NOT alter, recreate, or modify any text, logos, labels, barcodes, or serial numbers
- Improve lighting to be more even; reduce harsh shadows and glare
- Make the background less distracting by reducing visual clutter (do NOT replace the background entirely)
- Keep colors accurate and natural
- Do NOT over-process or add artificial effects
- Maintain the authentic look of the item

This should look like the same photo, just better lit and cleaner.`,

  beautified: `Transform this photo into a polished, studio-quality product image.

Requirements:
- Preserve the subject's identity, angle, and proportions exactly
- Do NOT alter, recreate, or modify any text, logos, labels, barcodes, or serial numbers
- Create professional, flattering lighting (like a product photography studio)
- Significantly tidy the background to create a clean, minimal look (but keep some context)
- Enhance colors to be vibrant but still accurate
- Reduce any glare, reflections, or imperfections
- The result should look like a high-quality catalog or advertisement photo

Make it beautiful while keeping the item 100% recognizable.`,
};

app.post('/api/gemini/enhance', ipLimiter, requireAuth, userLimiter, async (req, res) => {
  if (!ai) {
    return res.status(503).json({ error: 'GEMINI_API_KEY is not configured' });
  }

  const { imageBase64, strength = 'subtle' } = req.body || {};

  const imageErr = validateImageBase64(imageBase64);
  if (imageErr) return res.status(400).json({ error: imageErr });

  const validStrengths = ['subtle', 'beautified'];
  if (!validStrengths.includes(strength)) {
    return res.status(400).json({ error: 'Invalid strength. Must be "subtle" or "beautified"' });
  }

  const prompt = ENHANCEMENT_PROMPTS[strength];

  try {
    // Use Gemini's image generation model for image editing
    // Reference: https://ai.google.dev/gemini-api/docs/image-generation
    const response = await ai.models.generateContent({
      model: GEMINI_IMAGE_MODEL,
      contents: [
        { text: prompt },
        {
          inlineData: {
            mimeType: 'image/jpeg',
            data: imageBase64,
          },
        },
      ],
      config: {
        responseModalities: ['TEXT', 'IMAGE'],
      },
    });

    // Extract the generated image from the response
    const parts = response.candidates?.[0]?.content?.parts || [];
    let enhancedImageBase64 = null;
    let responseText = null;

    for (const part of parts) {
      if (part.inlineData?.data) {
        enhancedImageBase64 = part.inlineData.data;
      }
      if (part.text) {
        responseText = part.text;
      }
    }

    if (!enhancedImageBase64) {
      console.error('No image in response. Response text:', responseText);
      console.error('Full response:', JSON.stringify(response, null, 2));
      return res.status(500).json({
        error: 'Enhancement failed - no image generated',
        details: responseText || 'The model did not return an image. Try a different photo.',
      });
    }

    return res.json({
      enhancedImageBase64,
      metadata: {
        strength,
        promptVersion: 1,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Image Enhancement Failed:', error);

    let statusCode = 500;
    if (error instanceof Error) {
      if (error.message.includes('API key')) statusCode = 503;
      else if (error.message.includes('quota') || error.message.includes('rate')) statusCode = 429;
      else if (error.message.includes('safety') || error.message.includes('blocked'))
        statusCode = 400;
      else if (error.message.includes('not found') || error.message.includes('404'))
        statusCode = 503;
    }

    return res.status(statusCode).json({
      error: 'Image enhancement failed',
      details: sanitizeErrorMessage(error),
    });
  }
});

const isDirectRun = process.argv[1] === fileURLToPath(import.meta.url);
if (isDirectRun) {
  if (isProduction && !apiKey) {
    console.error('FATAL: GEMINI_API_KEY is required in production. Exiting.');
    process.exit(1);
  }
  if (!apiKey) {
    console.warn('Warning: GEMINI_API_KEY is not set. AI endpoints will return 503.');
  }
  app.listen(port, () => {
    console.log(`Gemini proxy listening on :${port}`);
  });
}

export default app;
