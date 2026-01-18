import { GoogleGenAI } from '@google/genai';

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
    // gemini-2.5-flash-image is GA and recommended for production
    // Reference: https://ai.google.dev/gemini-api/docs/image-generation
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-preview-image-generation',
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
        model: 'gemini-2.5-flash-preview-image-generation',
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
}
