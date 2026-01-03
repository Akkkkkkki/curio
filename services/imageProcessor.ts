/**
 * Processes an image into:
 * - **original**: preserved if input is already JPEG data-url; otherwise transcoded to JPEG (no resize) at high quality.
 * - **display**: one downsampled JPEG for UI display (good quality).
 *
 * NOTE: This is intentionally minimal: original + one display size (no tiny thumb).
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
      img.crossOrigin = "anonymous";
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("Image load failed"));
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

      if (typeof maxDim === "number" && maxDim > 0) {
        const largest = Math.max(width, height);
        if (largest > maxDim) {
          const scale = maxDim / largest;
          width = Math.max(1, Math.round(width * scale));
          height = Math.max(1, Math.round(height * scale));
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d", { alpha: false });
      if (!ctx) return reject(new Error("Canvas context failed"));

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("toBlob failed"))),
        "image/jpeg",
        quality,
      );
    });
  };

  const inputBlob = input.startsWith("data:")
    ? await dataUrlToBlob(input)
    : await (await fetch(input)).blob();

  const img = await loadImageFromBlob(inputBlob);

  const original =
    inputBlob.type === "image/jpeg"
      ? inputBlob
      : await jpegFromImage(img, { quality: 0.95 });

  const display = await jpegFromImage(img, {
    maxDim: displayMax,
    quality: 0.92,
  });

  return { original, display };
};
