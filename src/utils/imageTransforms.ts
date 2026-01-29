const loadImage = (dataUrl: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Image load failed'));
    img.src = dataUrl;
  });

const toJpegDataUrl = (canvas: HTMLCanvasElement, fallback: string) => {
  const result = canvas.toDataURL('image/jpeg', 0.92);
  return result && result.startsWith('data:') ? result : fallback;
};

export const cropSquareDataUrl = async (dataUrl: string) => {
  const image = await loadImage(dataUrl);
  const side = Math.min(image.width, image.height);
  const sx = Math.max(0, (image.width - side) / 2);
  const sy = Math.max(0, (image.height - side) / 2);
  const canvas = document.createElement('canvas');
  canvas.width = side;
  canvas.height = side;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');
  ctx.drawImage(image, sx, sy, side, side, 0, 0, side, side);
  return toJpegDataUrl(canvas, dataUrl);
};

export const rotateDataUrl = async (dataUrl: string, direction: 'left' | 'right') => {
  const image = await loadImage(dataUrl);
  const canvas = document.createElement('canvas');
  canvas.width = image.height;
  canvas.height = image.width;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');
  const angle = direction === 'right' ? Math.PI / 2 : -Math.PI / 2;
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate(angle);
  ctx.drawImage(image, -image.width / 2, -image.height / 2);
  return toJpegDataUrl(canvas, dataUrl);
};
