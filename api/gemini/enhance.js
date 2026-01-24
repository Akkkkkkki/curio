import { GoogleGenAI } from '@google/genai';
import { attachMetrics } from '../_metrics.js';

// Model for image generation/enhancement
const GEMINI_IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image';

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

export default async function handler(req, res) {
  attachMetrics(req, res, '/api/gemini/enhance');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
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

    if (error instanceof Error) {
      errorMessage = error.message;

      // Check for specific Gemini API errors
      if (error.message.includes('API key')) {
        errorMessage = 'Invalid or missing API key';
        statusCode = 503;
      } else if (error.message.includes('quota') || error.message.includes('rate')) {
        errorMessage = 'API rate limit exceeded. Please try again later.';
        statusCode = 429;
      } else if (error.message.includes('safety') || error.message.includes('blocked')) {
        errorMessage = 'Image was blocked by safety filters. Try a different photo.';
        statusCode = 400;
      } else if (error.message.includes('not found') || error.message.includes('404')) {
        errorMessage =
          'Model not available. The image generation model may not be enabled for this API key.';
        statusCode = 503;
      }
    }

    return res.status(statusCode).json({
      error: 'Image enhancement failed',
      details: errorMessage,
    });
  }
}
