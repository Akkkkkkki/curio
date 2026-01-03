/**
 * Canvas API mock for image processing tests (Phase 1)
 *
 * Note: For Node.js environment, we use the 'canvas' package which provides
 * a real Canvas implementation. This file provides additional utilities and
 * mocks for test scenarios.
 */

import { vi } from 'vitest';

/**
 * Mock HTMLCanvasElement.toBlob for testing
 * The canvas package doesn't implement toBlob, so we mock it
 */
export function mockCanvasToBlob() {
  if (typeof HTMLCanvasElement !== 'undefined') {
    HTMLCanvasElement.prototype.toBlob = function (callback, type = 'image/png', quality = 0.92) {
      // Convert canvas to data URL then to blob
      const dataUrl = this.toDataURL(type, quality);
      const arr = dataUrl.split(',');
      const mime = arr[0].match(/:(.*?);/)?.[1] || type;
      const bstr = atob(arr[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
      }
      const blob = new Blob([u8arr], { type: mime });
      callback(blob);
    };
  }
}

/**
 * Create a mock image file for testing
 */
export function createMockImageFile(
  name = 'test-image.jpg',
  type = 'image/jpeg',
  size = 1024,
): File {
  const blob = new Blob(['x'.repeat(size)], { type });
  return new File([blob], name, { type });
}

/**
 * Create a mock canvas element with specific dimensions
 */
export function createMockCanvas(width = 100, height = 100): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

/**
 * Create a test image bitmap
 */
export async function createTestImageBitmap(width = 100, height = 100): Promise<ImageBitmap> {
  const canvas = createMockCanvas(width, height);
  const ctx = canvas.getContext('2d')!;

  // Draw a simple test pattern
  ctx.fillStyle = 'red';
  ctx.fillRect(0, 0, width / 2, height / 2);
  ctx.fillStyle = 'blue';
  ctx.fillRect(width / 2, 0, width / 2, height / 2);
  ctx.fillStyle = 'green';
  ctx.fillRect(0, height / 2, width / 2, height / 2);
  ctx.fillStyle = 'yellow';
  ctx.fillRect(width / 2, height / 2, width / 2, height / 2);

  // Create ImageBitmap from canvas
  return await createImageBitmap(canvas);
}

/**
 * Initialize canvas mocks for tests
 * Call this in your test setup
 */
export function setupCanvasMocks() {
  mockCanvasToBlob();

  // Mock Image constructor if needed
  if (typeof Image === 'undefined') {
    (global as any).Image = class MockImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      src = '';
      width = 0;
      height = 0;

      constructor() {
        setTimeout(() => {
          this.width = 100;
          this.height = 100;
          if (this.onload) this.onload();
        }, 0);
      }
    };
  }
}
