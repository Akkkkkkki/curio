import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
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

app.use(express.json({ limit: '15mb' }));
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', process.env.CORS_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  return next();
});

const apiKey = process.env.GEMINI_API_KEY;
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

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

app.post('/api/gemini/analyze', async (req, res) => {
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
      model: 'gemini-3-flash-preview',
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

app.post('/api/gemini/enhance', async (req, res) => {
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
    // Use Gemini's image generation model with editing capability
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash-exp-image-generation',
      contents: {
        parts: [{ inlineData: { mimeType: 'image/jpeg', data: imageBase64 } }, { text: prompt }],
      },
      config: {
        responseModalities: ['Text', 'Image'],
      },
    });

    // Extract the generated image from the response
    const parts = response?.candidates?.[0]?.content?.parts || [];
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
      return res.status(500).json({
        error: 'Enhancement failed - no image generated',
        details: responseText || 'Unknown error',
      });
    }

    return res.json({
      enhancedImageBase64,
      metadata: {
        model: 'gemini-2.0-flash-exp-image-generation',
        strength,
        promptVersion: 1,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Image Enhancement Failed:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ error: 'Image enhancement failed', details: errorMessage });
  }
});

const isDirectRun = process.argv[1] === fileURLToPath(import.meta.url);
if (isDirectRun) {
  app.listen(port, () => {
    console.log(`Gemini proxy listening on :${port}`);
  });
}

export default app;
