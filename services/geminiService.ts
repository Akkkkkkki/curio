
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { FieldDefinition, UserCollection } from "../types";

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
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const properties: Record<string, any> = {
      title: { type: Type.STRING, description: "A short, descriptive title for the item." },
      notes: { type: Type.STRING, description: "A brief summary of visual observations about the item." },
    };

    fields.forEach(field => {
      properties[field.id] = {
        type: mapFieldTypeToSchemaType(field.type),
        description: `Value for ${field.label}.`,
      };
      if (field.type === 'select' && field.options) {
        properties[field.id].description += ` Must be one of: ${field.options.join(', ')}`;
      }
    });

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: {
        parts: [
          { inlineData: { mimeType: "image/jpeg", data: base64Image } },
          { text: "Analyze this image of a collectible item. Extract metadata based on the provided schema. Be precise. If a field cannot be determined, leave it null." }
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
    const { title, notes, ...data } = result;

    return {
      title: title || "New Item",
      notes: notes || "",
      data: data || {}
    };

  } catch (error) {
    console.error("AI Analysis Failed:", error);
    throw error;
  }
};

export const connectMuseumGuide = async (collection: UserCollection, callbacks: any, customInstruction?: string) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const itemsContext = collection.items.map(item => ({
    title: item.title,
    rating: item.rating,
    notes: item.notes,
    details: item.data
  }));

  const systemInstruction = customInstruction || `
    You are the "Curio Museum Guide", a sophisticated and enthusiastic expert in ${collection.name}.
    You are helping the user enjoy and explore their collection.
    
    Collection Context:
    ${JSON.stringify(itemsContext, null, 2)}

    Your tone: Elegant, knowledgeable, and slightly whimsical, like a high-end gallery curator.
    Your goal: Help users appreciate their items. Suggest things to look at, talk about history, or just chat about the hobby.
    Keep responses concise and conversational for audio.
  `;

  return ai.live.connect({
    model: 'gemini-2.5-flash-native-audio-preview-09-2025',
    callbacks,
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
      },
      systemInstruction,
    },
  });
};
