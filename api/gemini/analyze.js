import { GoogleGenAI, Type } from '@google/genai';
import { attachMetrics } from '../_metrics.js';
import { attachRequestLogger, recordApiError } from '../_requestLogging.js';

// Model for metadata extraction (vision/text analysis)
const GEMINI_ANALYZE_MODEL = process.env.GEMINI_ANALYZE_MODEL || 'gemini-2.5-flash';

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

export default async function handler(req, res) {
  attachRequestLogger(req, res, {
    route: '/api/gemini/analyze',
    provider: 'google',
    model: GEMINI_ANALYZE_MODEL,
  });
  attachMetrics(req, res, '/api/gemini/analyze');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    recordApiError(res, { name: 'MethodNotAllowed', message: 'Method Not Allowed' });
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    recordApiError(res, { name: 'MissingApiKey', message: 'GEMINI_API_KEY is not configured' });
    return res.status(503).json({ error: 'GEMINI_API_KEY is not configured' });
  }

  const { imageBase64, fields, locale = 'en' } = req.body || {};
  if (!imageBase64 || !Array.isArray(fields)) {
    recordApiError(res, { name: 'BadRequest', message: 'Missing imageBase64 or fields' });
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
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: GEMINI_ANALYZE_MODEL,
      contents: {
        parts: [
          { inlineData: { mimeType: 'image/jpeg', data: imageBase64 } },
          {
            text: `Analyze this image of a collectible item. Extract metadata based on the provided schema.
            
            IMPORTANT RULES:
            1. Output ALL text (title, notes, field values) in the "${locale}" language.
            2. Be precise. If a field cannot be determined from the image, leave it null.
            3. For the "title", provide a descriptive name (e.g., "Qing Dynasty Coin", "Vintage Kodak Camera").
            4. For "notes", summarize visual observations. If the image is blurry or the item is unrecognizable, state that clearly in the notes.
            `,
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
    return res.status(200).json({
      title: title || 'New Item',
      notes: notes || '',
      data: data || {},
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'AI analysis failed';
    recordApiError(res, {
      name: error instanceof Error && error.name ? error.name : 'AIAnalysisFailed',
      message: errorMessage,
    });
    console.error('AI Analysis Failed:', error);
    return res.status(500).json({ error: 'AI analysis failed' });
  }
}
