const MAX_INPUT_DIMENSION = 4096;
const MAX_INPUT_FILE_SIZE = 20 * 1024 * 1024; // 20MB

export class ImageProcessingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ImageProcessingError';
  }
}

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

  const inputBlob = input.startsWith('data:')
    ? await dataUrlToBlob(input)
    : await (await fetch(input)).blob();

  if (inputBlob.size > MAX_INPUT_FILE_SIZE) {
    throw new ImageProcessingError(
      `Image is too large (${(inputBlob.size / 1024 / 1024).toFixed(1)}MB). Maximum is ${MAX_INPUT_FILE_SIZE / 1024 / 1024}MB.`,
    );
  }

  const img = await loadImageFromBlob(inputBlob);

  const needsDownscale =
    img.width > MAX_INPUT_DIMENSION || img.height > MAX_INPUT_DIMENSION;

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
