import { describe, it, expect, beforeEach } from 'vitest';
import { cropSquareDataUrl, rotateDataUrl } from '@/utils/imageTransforms';
import { createTestImageDataUrl, setupCanvasMocks } from '../utils/canvas-mock';

describe('imageTransforms', () => {
  beforeEach(() => {
    setupCanvasMocks();
  });

  it('crops an image to square data URL', async () => {
    const dataUrl = createTestImageDataUrl(400, 200);
    const result = await cropSquareDataUrl(dataUrl);
    expect(result.startsWith('data:')).toBe(true);
  });

  it('rotates an image to the right', async () => {
    const dataUrl = createTestImageDataUrl(320, 180);
    const result = await rotateDataUrl(dataUrl, 'right');
    expect(result.startsWith('data:')).toBe(true);
  });
});
