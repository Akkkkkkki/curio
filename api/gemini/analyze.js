import { GoogleGenAI, Type } from '@google/genai';

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
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: 'GEMINI_API_KEY is not configured' });
  }

  const { imageBase64, fields } = req.body || {};
  if (!imageBase64 || !Array.isArray(fields)) {
    return res.status(400).json({ error: 'Missing imageBase64 or fields' });
  }

  const properties = {
    title: { type: Type.STRING, description: 'A short, descriptive title for the item.' },
    notes: { type: Type.STRING, description: 'A brief summary of visual observations about the item.' },
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
    return res.status(200).json({
      title: title || 'New Item',
      notes: notes || '',
      data: data || {},
    });
  } catch (error) {
    console.error('AI Analysis Failed:', error);
    return res.status(500).json({ error: 'AI analysis failed' });
  }
}
