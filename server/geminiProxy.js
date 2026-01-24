import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import express from 'express';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { GoogleGenAI, Type } from '@google/genai';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const ENV_FILES = ['.env.local', '.env'];

const loadEnvFile = (filePath) => {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, 'utf8');
  content.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const idx = trimmed.indexOf('=');
    if (idx === -1) return;
    const key = trimmed.slice(0, idx).trim();
    if (!key || process.env[key] !== undefined) return;
    let value = trimmed.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  });
};

const shouldLoadEnvFiles = process.env.NODE_ENV !== 'production';
if (shouldLoadEnvFiles) {
  // Load .env.local for the proxy since Node doesn't read Vite env files automatically.
  ENV_FILES.forEach((file) => loadEnvFile(path.join(ROOT_DIR, file)));
}

const app = express();
const port = process.env.PORT || 8787;

const MAX_LATENCY_SAMPLES = 1000;
const METRICS_ROUTES = new Set(['/api/health', '/api/gemini/analyze', '/api/gemini/enhance']);
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

// Model configuration (can be overridden via environment variables)
const GEMINI_ANALYZE_MODEL = process.env.GEMINI_ANALYZE_MODEL || 'gemini-2.5-flash';
const GEMINI_IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image';

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

app.get('/api/metrics', (_req, res) => {
  res.json({
    generatedAt: new Date().toISOString(),
    routes: summarizeMetrics(),
  });
});

app.post('/api/gemini/analyze', ipLimiter, requireAuth, userLimiter, async (req, res) => {
  if (!ai) {
    return res.status(503).json({ error: 'GEMINI_API_KEY is not configured' });
  }

  const { imageBase64, fields } = req.body || {};
  if (!imageBase64 || !Array.isArray(fields)) {
    return res.status(400).json({ error: 'Missing imageBase64 or fields' });
  }

  const properties = {
    title: {
      type: Type.STRING,
      description: 'A short, descriptive title for the item.',
    },
    notes: {
      type: Type.STRING,
      description: 'A brief summary of visual observations about the item.',
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
    const response = await ai.models.generateContent({
      model: GEMINI_ANALYZE_MODEL,
      contents: {
        parts: [
          { inlineData: { mimeType: 'image/jpeg', data: imageBase64 } },
          {
            text: 'Analyze this image of a collectible item. Extract metadata based on the provided schema. Be precise. If a field cannot be determined, leave it null.',
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
    const { title, notes, ...data } = result || {};
    return res.json({
      title: title || 'New Item',
      notes: notes || '',
      data: data || {},
    });
  } catch (error) {
    console.error('AI Analysis Failed:', error);
    return res.status(500).json({ error: 'AI analysis failed' });
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
  if (!imageBase64) {
    return res.status(400).json({ error: 'Missing imageBase64' });
  }

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
        model: GEMINI_IMAGE_MODEL,
        strength,
        promptVersion: 1,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Image Enhancement Failed:', error);

    // Extract detailed error info
    let errorMessage = 'Unknown error';
    let statusCode = 500;

    if (error instanceof Error) {
      errorMessage = error.message;

      // Check for specific Gemini API errors
      if (error.message.includes('API key')) {
        errorMessage = 'Invalid or missing API key';
        statusCode = 503;
      } else if (error.message.includes('quota') || error.message.includes('rate')) {
        errorMessage = 'API rate limit exceeded. Please try again later.';
        statusCode = 429;
      } else if (error.message.includes('safety') || error.message.includes('blocked')) {
        errorMessage = 'Image was blocked by safety filters. Try a different photo.';
        statusCode = 400;
      } else if (error.message.includes('not found') || error.message.includes('404')) {
        errorMessage =
          'Model not available. The image generation model may not be enabled for this API key.';
        statusCode = 503;
      }
    }

    return res.status(statusCode).json({
      error: 'Image enhancement failed',
      details: errorMessage,
    });
  }
});

const isDirectRun = process.argv[1] === fileURLToPath(import.meta.url);
if (isDirectRun) {
  app.listen(port, () => {
    console.log(`Gemini proxy listening on :${port}`);
  });
}

export default app;
