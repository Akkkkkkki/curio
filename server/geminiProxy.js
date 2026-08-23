import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import express from 'express';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import {
  analyzeItem,
  GEMINI_ANALYZE_MODEL,
  storyPrompts,
  suggestFields,
} from './ai/operations.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
if (process.env.NODE_ENV !== 'production') {
  dotenv.config({ path: path.join(ROOT_DIR, '.env') });
}

const app = express();
const port = process.env.PORT || 8787;
const isProduction = process.env.NODE_ENV === 'production';
const apiKey = process.env.GEMINI_API_KEY;
const JWT_SECRET = process.env.SUPABASE_JWT_SECRET;
const GEMINI_IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image';
const MAX_IMAGE_BASE64_LENGTH = 20 * 1024 * 1024;
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
  if (!metrics.has(route)) metrics.set(route, { count: 0, errorCount: 0, durations: [] });
  return metrics.get(route);
};

const recordMetric = (route, status, durationMs) => {
  const metric = ensureMetric(route);
  metric.count += 1;
  if (status >= 400) metric.errorCount += 1;
  metric.durations.push(durationMs);
  if (metric.durations.length > MAX_LATENCY_SAMPLES) metric.durations.shift();
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
      latencyMs: { p50: percentile(value.durations, 50), p95: percentile(value.durations, 95) },
    };
  });
  return summary;
};

export const resetMetrics = () => metrics.clear();

app.set('trust proxy', 1);
app.use(express.json({ limit: '15mb' }));

app.use((req, res, next) => {
  req.id = randomUUID().slice(0, 8);
  res.setHeader('x-request-id', req.id);
  const start = Date.now();
  res.on('finish', () => {
    const durationMs = Date.now() - start;
    if (req.method !== 'OPTIONS' && METRICS_ROUTES.has(req.path)) {
      recordMetric(req.path, res.statusCode, durationMs);
    }
    console.log(
      JSON.stringify({
        event: 'api_request',
        ts: new Date().toISOString(),
        route: req.path,
        method: req.method,
        status: res.statusCode,
        durationMs,
        ok: res.statusCode < 400,
        requestId: req.id,
        deployment: process.env.NODE_ENV || 'unknown',
        commitSha: process.env.VERCEL_GIT_COMMIT_SHA || null,
        userId: req.user?.sub || null,
        ip: req.ip,
      }),
    );
  });
  next();
});

const ALLOWED_ORIGINS = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (ALLOWED_ORIGINS.length > 0) {
    if (origin && ALLOWED_ORIGINS.includes(origin)) res.setHeader('Access-Control-Allow-Origin', origin);
    else if (origin) return res.status(403).json({ error: 'Origin not allowed' });
  } else if (!isProduction) {
    res.setHeader('Access-Control-Allow-Origin', '*');
  } else if (origin) {
    return res.status(403).json({ error: 'CORS not configured for production' });
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Vary', 'Origin');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  return next();
});

const requireAuth = (req, res, next) => {
  if (!JWT_SECRET) {
    if (isProduction) return res.status(503).json({ error: 'Auth not configured' });
    return next();
  }
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing authorization token' });
  }
  try {
    req.user = jwt.verify(authHeader.slice(7), JWT_SECRET, { algorithms: ['HS256'] });
    return next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

const userLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  keyGenerator: (req) => req.user?.sub || req.ip,
  message: { error: 'Rate limit exceeded. Please wait before trying again.' },
  standardHeaders: true,
  legacyHeaders: false,
});
const ipLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 50,
  keyGenerator: (req) => req.ip,
  message: { error: 'Too many requests from this IP.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const requireApiKey = (res) => {
  if (apiKey) return false;
  res.status(503).json({ error: 'GEMINI_API_KEY is not configured' });
  return true;
};

const operationHandler = (operation, errorLabel) => async (req, res) => {
  if (requireApiKey(res)) return;
  try {
    const result = await operation({ apiKey, ...(req.body || {}) });
    return res.json(result);
  } catch (error) {
    const statusCode = error?.statusCode || 500;
    if (statusCode >= 500) console.error(`${errorLabel}:`, error);
    return res.status(statusCode).json({
      error: statusCode === 400 ? error.message : errorLabel,
    });
  }
};

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, geminiConfigured: Boolean(apiKey), analyzeModel: GEMINI_ANALYZE_MODEL });
});
app.get('/api/metrics', requireAuth, (_req, res) => {
  res.json({ generatedAt: new Date().toISOString(), routes: summarizeMetrics() });
});
app.post('/api/gemini/analyze', ipLimiter, requireAuth, userLimiter, operationHandler(analyzeItem, 'AI analysis failed'));
app.post('/api/gemini/suggest-fields', ipLimiter, requireAuth, userLimiter, operationHandler(suggestFields, 'Field suggestion failed'));
app.post('/api/gemini/story-prompts', ipLimiter, requireAuth, userLimiter, operationHandler(storyPrompts, 'Story prompt generation failed'));

const ENHANCEMENT_PROMPTS = {
  subtle: `Enhance this photo to look cleaner and more presentable while preserving its original character.\n\nRequirements:\n- Preserve the subject's identity, angle, and proportions exactly\n- Do NOT alter, recreate, or modify any text, logos, labels, barcodes, or serial numbers\n- Improve lighting to be more even; reduce harsh shadows and glare\n- Make the background less distracting by reducing visual clutter (do NOT replace the background entirely)\n- Keep colors accurate and natural\n- Do NOT over-process or add artificial effects\n- Maintain the authentic look of the item\n\nThis should look like the same photo, just better lit and cleaner.`,
  beautified: `Transform this photo into a polished, studio-quality product image.\n\nRequirements:\n- Preserve the subject's identity, angle, and proportions exactly\n- Do NOT alter, recreate, or modify any text, logos, labels, barcodes, or serial numbers\n- Create professional, flattering lighting (like a product photography studio)\n- Significantly tidy the background to create a clean, minimal look (but keep some context)\n- Enhance colors to be vibrant but still accurate\n- Reduce any glare, reflections, or imperfections\n- The result should look like a high-quality catalog or advertisement photo\n\nMake it beautiful while keeping the item 100% recognizable.`,
};

app.post('/api/gemini/enhance', ipLimiter, requireAuth, userLimiter, async (req, res) => {
  if (requireApiKey(res)) return;
  const { imageBase64, strength = 'subtle' } = req.body || {};
  if (typeof imageBase64 !== 'string' || !imageBase64.length) {
    return res.status(400).json({ error: 'imageBase64 must be a non-empty string' });
  }
  if (imageBase64.length > MAX_IMAGE_BASE64_LENGTH) {
    return res.status(400).json({ error: 'Image too large (max ~15MB)' });
  }
  if (!Object.hasOwn(ENHANCEMENT_PROMPTS, strength)) {
    return res.status(400).json({ error: 'Invalid strength. Must be "subtle" or "beautified"' });
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: GEMINI_IMAGE_MODEL,
      contents: [
        { text: ENHANCEMENT_PROMPTS[strength] },
        { inlineData: { mimeType: 'image/jpeg', data: imageBase64 } },
      ],
      config: { responseModalities: ['TEXT', 'IMAGE'] },
    });
    const parts = response.candidates?.[0]?.content?.parts || [];
    const imagePart = parts.find((part) => part.inlineData?.data);
    if (!imagePart) {
      return res.status(500).json({ error: 'Enhancement failed - no image generated' });
    }
    return res.json({
      enhancedImageBase64: imagePart.inlineData.data,
      metadata: { strength, promptVersion: 1, timestamp: new Date().toISOString() },
    });
  } catch (error) {
    console.error('Image Enhancement Failed:', error);
    return res.status(500).json({ error: 'Image enhancement failed' });
  }
});

const isDirectRun = process.argv[1] === fileURLToPath(import.meta.url);
if (isDirectRun) {
  if (isProduction && !apiKey) {
    console.error('FATAL: GEMINI_API_KEY is required in production. Exiting.');
    process.exit(1);
  }
  if (!apiKey) console.warn('Warning: GEMINI_API_KEY is not set. AI endpoints will return 503.');
  app.listen(port, () => console.log(`Gemini proxy listening on :${port}`));
}

export default app;
