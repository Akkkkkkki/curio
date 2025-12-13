import { GoogleGenAI, Type } from "@google/genai";
import { FieldDefinition } from "../types";

const getClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API Key not found");
  }
  return new GoogleGenAI({ apiKey });
};

// Map internal field types to Gemini Schema Types
const mapFieldTypeToSchemaType = (type: string): Type => {
  switch (type) {
    case 'number': return Type.NUMBER;
    case 'boolean': return Type.BOOLEAN;
    case 'text':
    case 'long_text':
    case 'select':
    case 'date':
    default:
      return Type.STRING;
  }
};

export const analyzeImage = async (
  base64Image: string,
  fields: FieldDefinition[]
): Promise<{ title: string; data: Record<string, any>; notes: string }> => {
  try {
    const ai = getClient();
    
    // Construct dynamic schema based on fields
    const properties: Record<string, any> = {
      title: { type: Type.STRING, description: "A short, descriptive title for the item." },
      notes: { type: Type.STRING, description: "A brief summary of visual observations about the item." },
    };

    fields.forEach(field => {
      properties[field.id] = {
        type: mapFieldTypeToSchemaType(field.type),
        description: `Value for ${field.label}.`,
        nullable: true,
      };
      if (field.type === 'select' && field.options) {
        properties[field.id].description += ` Must be one of: ${field.options.join(', ')}`;
      }
    });

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: {
        parts: [
          { inlineData: { mimeType: "image/jpeg", data: base64Image } },
          { text: "Analyze this image of a collectible item. Extract metadata based on the provided schema. Be precise. If a field cannot be determined from the image, leave it null." }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: properties,
        }
      }
    });

    if (!response.text) {
        throw new Error("No response from AI");
    }

    const result = JSON.parse(response.text);
    
    // Separate core fields from dynamic data
    const { title, notes, ...data } = result;

    return {
      title: title || "New Item",
      notes: notes || "",
      data: data || {}
    };

  } catch (error) {
    console.error("AI Analysis Failed:", error);
    // Fallback or rethrow
    throw error;
  }
};
