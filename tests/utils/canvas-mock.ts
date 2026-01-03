/**
 * Canvas API mock for image processing tests (Phase 1)
 *
 * Note: For Node.js environment, we use the 'canvas' package which provides
 * a real Canvas implementation. This file provides additional utilities and
 * mocks for test scenarios.
 */

import { vi } from 'vitest';

/**
 * Track toBlob calls for quality verification
 */
export interface ToBlobCall {
  type: string;
  quality: number;
  width: number;
  height: number;
}

export const toBlobCalls: ToBlobCall[] = [];

/**
 * Clear toBlob call history
 */
export function clearToBlobCalls() {
  toBlobCalls.length = 0;
}

/**
 * Mock HTMLCanvasElement.toBlob for testing
 * The canvas package doesn't implement toBlob, so we mock it
 */
export function mockCanvasToBlob() {
  if (typeof HTMLCanvasElement !== 'undefined') {
    HTMLCanvasElement.prototype.toBlob = function (callback, type = 'image/png', quality = 0.92) {
      // Track the call for verification
      toBlobCalls.push({
        type,
        quality,
        width: this.width,
        height: this.height,
      });

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
 * Create a minimal valid JPEG data URL for testing
 * Uses a 1x1 red pixel JPEG as a base, since happy-dom doesn't support Canvas 2D context
 */
function createMinimalJpegBase64(): string {
  // This is a minimal valid 1x1 red JPEG image in base64
  return '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBEQCEAPwCoAB//9k=';
}

/**
 * Create a minimal valid PNG data URL for testing
 */
function createMinimalPngBase64(): string {
  // This is a minimal valid 1x1 red PNG image in base64
  return 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';
}

/**
 * Create a test image data URL with specific dimensions
 * For happy-dom compatibility, we create a synthetic data URL that will be
 * interpreted as having the specified dimensions when loaded
 */
export function createTestImageDataUrl(
  width: number,
  height: number,
  type: 'image/jpeg' | 'image/png' = 'image/jpeg',
  quality = 0.92,
): string {
  // Store dimensions in a lookup map that our mocked Image can use
  const base64 = type === 'image/jpeg' ? createMinimalJpegBase64() : createMinimalPngBase64();
  const dataUrl = `data:${type};base64,${base64}`;

  // Register this data URL with its intended dimensions
  registerTestImage(dataUrl, width, height);

  return dataUrl;
}

/**
 * Map to store test image dimensions
 */
const testImageDimensions = new Map<string, { width: number; height: number }>();

/**
 * Register a test image with its dimensions
 */
export function registerTestImage(src: string, width: number, height: number): void {
  testImageDimensions.set(src, { width, height });
}

/**
 * Get registered dimensions for a test image
 */
export function getTestImageDimensions(src: string): { width: number; height: number } | undefined {
  return testImageDimensions.get(src);
}

/**
 * Clear all registered test images
 */
export function clearTestImages(): void {
  testImageDimensions.clear();
}

/**
 * Create a test PNG data URL (for format conversion tests)
 */
export function createTestPngDataUrl(width: number, height: number): string {
  return createTestImageDataUrl(width, height, 'image/png');
}

/**
 * Create a test JPEG data URL (for passthrough tests)
 */
export function createTestJpegDataUrl(width: number, height: number, quality = 0.92): string {
  return createTestImageDataUrl(width, height, 'image/jpeg', quality);
}

/**
 * Create a Blob from a data URL
 */
export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const response = await fetch(dataUrl);
  return response.blob();
}

/**
 * Get image dimensions from a Blob
 */
export async function getImageDimensions(blob: Blob): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.width, height: img.height });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image for dimension check'));
    };
    img.src = url;
  });
}

/**
 * Initialize canvas mocks for tests
 * Call this in your test setup
 */
export function setupCanvasMocks() {
  mockCanvasToBlob();
  clearToBlobCalls();
  clearTestImages();

  // Store the original Image constructor
  const OriginalImage = global.Image;

  // Create a properly mocked Image that respects registered dimensions
  class MockImage extends (OriginalImage || EventTarget) {
    private _src = '';
    private _width = 0;
    private _height = 0;
    private _crossOrigin: string | null = null;
    onload: (() => void) | null = null;
    onerror: ((error: any) => void) | null = null;

    constructor() {
      super();
    }

    get src() {
      return this._src;
    }

    set src(value: string) {
      this._src = value;

      // Check if this is a registered test image
      const dims = getTestImageDimensions(value);
      if (dims) {
        this._width = dims.width;
        this._height = dims.height;
      } else if (value.startsWith('blob:')) {
        // For blob URLs, use default dimensions
        this._width = 100;
        this._height = 100;
      } else {
        // Default dimensions
        this._width = 100;
        this._height = 100;
      }

      // Trigger onload asynchronously
      setTimeout(() => {
        if (this.onload) {
          this.onload();
        }
      }, 0);
    }

    get width() {
      return this._width;
    }

    get height() {
      return this._height;
    }

    get crossOrigin() {
      return this._crossOrigin;
    }

    set crossOrigin(value: string | null) {
      this._crossOrigin = value;
    }
  }

  // Replace global Image
  (global as any).Image = MockImage;

  // Mock document.createElement to return proper mocked canvases
  const originalCreateElement = document.createElement.bind(document);
  document.createElement = ((tagName: string) => {
    if (tagName.toLowerCase() === 'canvas') {
      const canvas = originalCreateElement(tagName) as HTMLCanvasElement;

      // Override getContext to return a mock 2D context
      const originalGetContext = canvas.getContext.bind(canvas);
      (canvas as any).getContext = (contextId: string, options?: any) => {
        if (contextId === '2d') {
          // Create a mock 2D context
          return createMockCanvasContext(canvas);
        }
        return originalGetContext(contextId, options);
      };

      return canvas;
    }
    return originalCreateElement(tagName);
  }) as typeof document.createElement;
}

/**
 * Create a mock Canvas 2D context for happy-dom
 */
function createMockCanvasContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx: Partial<CanvasRenderingContext2D> = {
    canvas,
    fillStyle: '#000000',
    strokeStyle: '#000000',
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
    imageSmoothingEnabled: true,
    imageSmoothingQuality: 'low',
    lineWidth: 1,
    lineCap: 'butt',
    lineJoin: 'miter',
    miterLimit: 10,
    lineDashOffset: 0,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    shadowBlur: 0,
    shadowColor: 'rgba(0, 0, 0, 0)',
    font: '10px sans-serif',
    textAlign: 'start',
    textBaseline: 'alphabetic',
    direction: 'ltr',

    fillRect: vi.fn(),
    clearRect: vi.fn(),
    strokeRect: vi.fn(),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    arc: vi.fn(),
    arcTo: vi.fn(),
    bezierCurveTo: vi.fn(),
    quadraticCurveTo: vi.fn(),
    rect: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    clip: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    scale: vi.fn(),
    rotate: vi.fn(),
    translate: vi.fn(),
    transform: vi.fn(),
    setTransform: vi.fn(),
    resetTransform: vi.fn(),
    drawImage: vi.fn(),
    createImageData: vi
      .fn()
      .mockReturnValue({ width: 1, height: 1, data: new Uint8ClampedArray(4) }),
    getImageData: vi.fn().mockReturnValue({ width: 1, height: 1, data: new Uint8ClampedArray(4) }),
    putImageData: vi.fn(),
    createLinearGradient: vi.fn().mockReturnValue({
      addColorStop: vi.fn(),
    }),
    createRadialGradient: vi.fn().mockReturnValue({
      addColorStop: vi.fn(),
    }),
    createPattern: vi.fn().mockReturnValue(null),
    measureText: vi.fn().mockReturnValue({
      width: 0,
      actualBoundingBoxAscent: 0,
      actualBoundingBoxDescent: 0,
      actualBoundingBoxLeft: 0,
      actualBoundingBoxRight: 0,
      fontBoundingBoxAscent: 0,
      fontBoundingBoxDescent: 0,
    }),
    fillText: vi.fn(),
    strokeText: vi.fn(),
    getLineDash: vi.fn().mockReturnValue([]),
    setLineDash: vi.fn(),
    isPointInPath: vi.fn().mockReturnValue(false),
    isPointInStroke: vi.fn().mockReturnValue(false),
    getContextAttributes: vi.fn().mockReturnValue({
      alpha: true,
      colorSpace: 'srgb',
      desynchronized: false,
      willReadFrequently: false,
    }),
  };

  return ctx as CanvasRenderingContext2D;
}
