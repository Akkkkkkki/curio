const MAX_INPUT_DIMENSION = 4096;
const MAX_INPUT_FILE_SIZE = 20 * 1024 * 1024; // 20MB

// Vision models don't benefit from >~1500px; this keeps the request body
// well under platform proxy limits (Vercel rewrites ≈ 4.5MB body cap).
const AI_ANALYZE_MAX_DIM = 1536;
const AI_ANALYZE_QUALITY = 0.85;

export class ImageProcessingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ImageProcessingError';
  }
}

const dataUrlToBlob = async (dataUrl: string): Promise<Blob> => {
  const res = await fetch(dataUrl);
  return await res.blob();
};

const loadImageFromBlob = async (blob: Blob): Promise<HTMLImageElement> => {
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Image load failed'));
      img.src = url;
    });
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
};

const jpegFromImage = (
  img: HTMLImageElement,
  opts: { maxDim?: number; quality: number },
): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const { maxDim, quality } = opts;
    let width = img.width;
    let height = img.height;

    if (typeof maxDim === 'number' && maxDim > 0) {
      const largest = Math.max(width, height);
      if (largest > maxDim) {
        const scale = maxDim / largest;
        width = Math.max(1, Math.round(width * scale));
        height = Math.max(1, Math.round(height * scale));
      }
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return reject(new Error('Canvas context failed'));

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);

    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('toBlob failed'))),
      'image/jpeg',
      quality,
    );
  });
};

const blobToBase64 = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('FileReader did not return a string'));
        return;
      }
      const idx = result.indexOf(',');
      resolve(idx >= 0 ? result.slice(idx + 1) : result);
    };
    reader.onerror = () => reject(new Error('FileReader failed'));
    reader.readAsDataURL(blob);
  });

const rawBase64FromDataUrl = (dataUrl: string): string => {
  const idx = dataUrl.indexOf(',');
  return idx >= 0 ? dataUrl.slice(idx + 1) : dataUrl;
};

/**
 * Compress a data-URL image into a smaller JPEG base64 suitable for sending
 * to the AI analysis proxy. Returns the bare base64 string (no data: prefix).
 *
 * Large camera photos can exceed Vercel's ~4.5MB request body cap, surfacing
 * as a 413 on `/api/gemini/analyze`. Downscaling client-side keeps the call
 * within budget without losing useful detail (vision models don't benefit
 * from > ~1500px).
 *
 * Never throws: if anything in the canvas pipeline fails — e.g. an
 * undecodable format like HEIC, a canvas-context error on a constrained
 * mobile browser, or an oversized source — we return the original base64
 * and let the proxy decide. That preserves the prior behavior in failure
 * cases instead of turning a payload problem into a hard "analysis failed".
 */
export const compressImageForAi = async (dataUrl: string): Promise<string> => {
  try {
    const blob = dataUrl.startsWith('data:')
      ? await dataUrlToBlob(dataUrl)
      : await (await fetch(dataUrl)).blob();

    if (blob.size > MAX_INPUT_FILE_SIZE) {
      // Don't refuse here — let the caller send the raw payload and surface
      // the upstream 413 with its actual error message.
      console.warn(
        `compressImageForAi: source ${(blob.size / 1024 / 1024).toFixed(1)}MB exceeds ${MAX_INPUT_FILE_SIZE / 1024 / 1024}MB cap; sending raw.`,
      );
      return rawBase64FromDataUrl(dataUrl);
    }

    const img = await loadImageFromBlob(blob);
    const compressed = await jpegFromImage(img, {
      maxDim: AI_ANALYZE_MAX_DIM,
      quality: AI_ANALYZE_QUALITY,
    });
    return blobToBase64(compressed);
  } catch (err) {
    console.warn('compressImageForAi: compression failed, falling back to raw base64:', err);
    return rawBase64FromDataUrl(dataUrl);
  }
};

/**
 * Processes an image into:
 * - **original**: preserved if input is already JPEG data-url; otherwise transcoded to JPEG (no resize) at high quality.
 *   Capped at {@link MAX_INPUT_DIMENSION}px to prevent OOM on mobile.
 * - **display**: one downsampled JPEG for UI display (good quality).
 */
export const processImage = async (
  input: string,
  displayMax: number = 2000,
): Promise<{ original: Blob; display: Blob }> => {
  const inputBlob = input.startsWith('data:')
    ? await dataUrlToBlob(input)
    : await (await fetch(input)).blob();

  if (inputBlob.size > MAX_INPUT_FILE_SIZE) {
    throw new ImageProcessingError(
      `Image is too large (${(inputBlob.size / 1024 / 1024).toFixed(1)}MB). Maximum is ${MAX_INPUT_FILE_SIZE / 1024 / 1024}MB.`,
    );
  }

  const img = await loadImageFromBlob(inputBlob);

  const needsDownscale = img.width > MAX_INPUT_DIMENSION || img.height > MAX_INPUT_DIMENSION;

  const original =
    inputBlob.type === 'image/jpeg' && !needsDownscale
      ? inputBlob
      : await jpegFromImage(img, {
          maxDim: MAX_INPUT_DIMENSION,
          quality: 0.95,
        });

  const display = await jpegFromImage(img, {
    maxDim: displayMax,
    quality: 0.92,
  });

  return { original, display };
};
