import { GoogleGenAI, Type } from '@google/genai';
import { attachMetrics } from '../_metrics.js';
import { attachRequestLogger, recordApiError } from '../_requestLogging.js';

// Model for field suggestion (text-only)
const GEMINI_ANALYZE_MODEL = process.env.GEMINI_ANALYZE_MODEL || 'gemini-2.5-flash';

export default async function handler(req, res) {
  attachRequestLogger(req, res, {
    route: '/api/gemini/suggest-fields',
    provider: 'google',
    model: GEMINI_ANALYZE_MODEL,
  });
  attachMetrics(req, res, '/api/gemini/suggest-fields');
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

  const { description, locale = 'en' } = req.body || {};
  if (!description || typeof description !== 'string') {
    recordApiError(res, { name: 'BadRequest', message: 'Missing description' });
    return res.status(400).json({ error: 'Missing description' });
  }

  const maxFields = 6;

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: GEMINI_ANALYZE_MODEL,
      contents: {
        parts: [
          {
            text: `You are helping suggest metadata fields for a personal collection app.\n\nUser's language: ${locale}\nThe user wants to collect: "${description}"\n\nSuggest 4–6 short field names that would be useful for cataloging these items.\n\nRules:\n- Use simple, everyday labels (e.g., "Year" not "Year of Manufacture")\n- Match the user's language (${locale})\n- Focus on attributes a collector would actually track\n- NEVER suggest: "Notes", "Description", "Title", "Name", "Rating", "Diary", "Comments"\n\nReturn JSON: { "fields": [...] }`,
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

    return res.status(200).json({ fields });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Field suggestion failed';
    recordApiError(res, {
      name: error instanceof Error && error.name ? error.name : 'FieldSuggestionFailed',
      message: errorMessage,
    });
    console.error('Field suggestion failed:', error);
    return res.status(500).json({ error: 'Field suggestion failed' });
  }
}
