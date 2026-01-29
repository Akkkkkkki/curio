import { GoogleGenAI } from '@google/genai';
import { attachMetrics } from '../_metrics.js';
import { attachRequestLogger, recordApiError } from '../_requestLogging.js';

// Model for image generation/enhancement
const GEMINI_IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image';

// Prompt templates for image enhancement
const ENHANCEMENT_PROMPTS = {
  subtle: `Enhance this photo of a collectible item to improve clarity and lighting while STRICTLY preserving its historical authenticity and physical condition.

Requirements:
- CRITICAL: Do NOT remove scratches, patina, rust, dents, wear marks, or signs of age. These are essential to the item's value.
- CRITICAL: Do NOT alter any text, inscriptions, mint marks, or logos.
- Improve the lighting to reveal details that might be hidden in shadow.
- Sharpen the image slightly to make details clearer.
- Neutralize color cast (e.g., remove yellow indoor lighting tint) but keep the item's actual color.
- Reduce background noise/clutter if possible, but prioritize the item's integrity.

The goal is a "documentary" style enhancement: clearer and better lit, but brutally honest about the item's condition.`,

  beautified: `Transform this photo into a high-quality catalog image, but maintain the item's physical reality.

Requirements:
- Create professional, soft studio lighting.
- Clean up the BACKGROUND significantly (make it uniform or blurred).
- Enhance the item's presence and contrast.
- You MAY reduce minor digital noise or temporary dust.
- Do NOT repair physical damage to the item (cracks, chips, patina) unless it looks like temporary dirt.
- Keep text and markings legible and unaltered.

The goal is a "museum catalog" look: beautiful presentation of the artifact as it exists today.`,
};

export default async function handler(req, res) {
  attachRequestLogger(req, res, {
    route: '/api/gemini/enhance',
    provider: 'google',
    model: GEMINI_IMAGE_MODEL,
  });
  attachMetrics(req, res, '/api/gemini/enhance');
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

  const { imageBase64, strength = 'subtle' } = req.body || {};
  if (!imageBase64) {
    recordApiError(res, { name: 'BadRequest', message: 'Missing imageBase64' });
    return res.status(400).json({ error: 'Missing imageBase64' });
  }

  const validStrengths = ['subtle', 'beautified'];
  if (!validStrengths.includes(strength)) {
    recordApiError(res, { name: 'BadRequest', message: 'Invalid strength' });
    return res.status(400).json({ error: 'Invalid strength. Must be "subtle" or "beautified"' });
  }

  const prompt = ENHANCEMENT_PROMPTS[strength];

  try {
    const ai = new GoogleGenAI({ apiKey });
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

    return res.status(200).json({
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
    let errorName = 'ImageEnhancementFailed';

    if (error instanceof Error) {
      errorMessage = error.message;
      if (error.name) {
        errorName = error.name;
      }

      // Check for specific Gemini API errors
      if (error.message.includes('API key')) {
        errorMessage = 'Invalid or missing API key';
        statusCode = 503;
        errorName = 'InvalidApiKey';
      } else if (error.message.includes('quota') || error.message.includes('rate')) {
        errorMessage = 'API rate limit exceeded. Please try again later.';
        statusCode = 429;
        errorName = 'RateLimitExceeded';
      } else if (error.message.includes('safety') || error.message.includes('blocked')) {
        errorMessage = 'Image was blocked by safety filters. Try a different photo.';
        statusCode = 400;
        errorName = 'SafetyBlocked';
      } else if (error.message.includes('not found') || error.message.includes('404')) {
        errorMessage =
          'Model not available. The image generation model may not be enabled for this API key.';
        statusCode = 503;
        errorName = 'ModelNotAvailable';
      }
    }

    recordApiError(res, { name: errorName, message: errorMessage });
    return res.status(statusCode).json({
      error: 'Image enhancement failed',
      details: errorMessage,
    });
  }
}
