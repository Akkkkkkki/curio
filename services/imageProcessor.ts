/**
 * Industry standard image processing for mobile-first apps.
 * Optimized for "Master" storage: High enough for 300DPI prints,
 * but compressed enough for efficient mobile storage.
 */
export const processImage = async (dataUrl: string, maxDimension: number = 2000): Promise<{ blob: Blob; previewUrl: string }> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let width = img.width;
      let height = img.height;

      // Calculate new dimensions (High-res Master target)
      if (width > height) {
        if (width > maxDimension) {
          height *= maxDimension / width;
          width = maxDimension;
        }
      } else {
        if (height > maxDimension) {
          width *= maxDimension / height;
          height = maxDimension;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }

      // Use better image smoothing for the downscale
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, width, height);

      // Convert to compressed JPEG Blob
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve({
              blob,
              previewUrl: canvas.toDataURL('image/jpeg', 0.9) // 90% is "High Quality" for printing
            });
          } else {
            reject(new Error('Canvas toBlob failed'));
          }
        },
        'image/jpeg',
        0.9 // High quality sweet spot for export
      );
    };
    img.onerror = () => reject(new Error('Image load failed'));
    img.src = dataUrl;
  });
};

export const dataUrlToBlob = async (dataUrl: string): Promise<Blob> => {
    const res = await fetch(dataUrl);
    return await res.blob();
};
