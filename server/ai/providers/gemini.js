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

export const createGeminiProvider = ({ apiKey, model, client: injectedClient }) => {
  const client = injectedClient || new GoogleGenAI({ apiKey });
  const generateStructured = async ({ parts, schema }) => {
    const response = await client.models.generateContent({
      model,
      contents: { parts },
      config: {
        responseMimeType: 'application/json',
        responseSchema: toGeminiSchema(schema),
      },
    });
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
