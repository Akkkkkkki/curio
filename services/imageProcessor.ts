
/**
 * Processes an image into a high-res master and a small thumbnail.
 * Can handle DataURLs or standard URLs/Paths.
 */
export const processImage = async (
  input: string, 
  masterMax: number = 1600, 
  thumbMax: number = 400
): Promise<{ master: Blob; thumb: Blob }> => {
  const createBlobFromImage = (img: HTMLImageElement, maxDim: number, quality: number): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > maxDim) {
          height *= maxDim / width;
          width = maxDim;
        }
      } else {
        if (height > maxDim) {
          width *= maxDim / height;
          height = maxDim;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d', { alpha: false });
      if (!ctx) return reject(new Error('Canvas context failed'));

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(b => b ? resolve(b) : reject(new Error('toBlob failed')), 'image/jpeg', quality);
    });
  };

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = async () => {
      try {
        const [master, thumb] = await Promise.all([
          createBlobFromImage(img, masterMax, 0.85),
          createBlobFromImage(img, thumbMax, 0.7)
        ]);
        resolve({ master, thumb });
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = () => reject(new Error('Image load failed'));
    
    // If it's a relative path/standard URL, we don't need to do anything special.
    // If it's a data URL, it works as is.
    img.src = input;
  });
};
