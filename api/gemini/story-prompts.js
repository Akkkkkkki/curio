import { GoogleGenAI, Type } from '@google/genai';
import { attachMetrics } from '../_metrics.js';
import { attachRequestLogger, recordApiError } from '../_requestLogging.js';

// Model for prompt generation (text-only)
const GEMINI_ANALYZE_MODEL = process.env.GEMINI_ANALYZE_MODEL || 'gemini-2.5-flash';

export default async function handler(req, res) {
  attachRequestLogger(req, res, {
    route: '/api/gemini/story-prompts',
    provider: 'google',
    model: GEMINI_ANALYZE_MODEL,
  });
  attachMetrics(req, res, '/api/gemini/story-prompts');
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

  const { title, collectionContext, aiDescription, knownFields, locale = 'en' } = req.body || {};

  // Title is the primary signal for prompt specificity, but treat its absence
  // as a soft signal — fall back to collection context + AI observation
  // rather than hard-rejecting. Users who tap the prompt button before AI
  // analysis finishes deserve something useful, not a 400.
  const safeTitle = typeof title === 'string' ? title.trim() : '';

  const contextLines = [];
  if (safeTitle) contextLines.push(`- Title: "${safeTitle}"`);
  if (collectionContext?.name) contextLines.push(`- Collection: "${collectionContext.name}"`);
  if (collectionContext?.description)
    contextLines.push(`- Collection description: "${collectionContext.description}"`);
  if (typeof aiDescription === 'string' && aiDescription.trim())
    contextLines.push(`- Visual observation: "${aiDescription.trim()}"`);
  if (knownFields && typeof knownFields === 'object') {
    const knownEntries = Object.entries(knownFields)
      .filter(([, v]) => v !== null && v !== undefined && v !== '')
      .slice(0, 8)
      .map(([k, v]) => `  - ${k}: ${v}`);
    if (knownEntries.length) {
      contextLines.push(`- Known facts:\n${knownEntries.join('\n')}`);
    }
  }

  // If we have no usable context at all, return a curated fallback rather
  // than calling Gemini with nothing — the model would either refuse or
  // produce generic filler. These match the spec's curatorial tone.
  if (contextLines.length === 0) {
    const fallback =
      locale === 'zh'
        ? ['你是在哪儿遇到它的？', '是谁让你认识它的？', '它让你想起了什么？']
        : [
            'Where were you when you got this?',
            'Who introduced you to it?',
            'What does it remind you of?',
          ];
    return res.status(200).json({ prompts: fallback });
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
    const ai = new GoogleGenAI({ apiKey });
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

    return res.status(200).json({ prompts });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Story prompt generation failed';
    recordApiError(res, {
      name: error instanceof Error && error.name ? error.name : 'StoryPromptGenerationFailed',
      message: errorMessage,
    });
    console.error('Story prompt generation failed:', error);
    return res.status(500).json({ error: 'Story prompt generation failed' });
  }
}
