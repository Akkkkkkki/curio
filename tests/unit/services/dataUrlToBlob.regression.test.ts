import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { dataUrlToBlob, ImageProcessingError } from '@/services/imageProcessor';

// Regression test for the production CSP outage: connect-src does not allow
// data:, so any fetch(dataUrl) is blocked by the browser and "save item with
// photo" fails with "Could not save image". dataUrlToBlob must therefore
// decode data URLs without ever touching fetch.
describe('dataUrlToBlob (CSP regression)', () => {
  const realFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = vi.fn(() => {
      throw new TypeError('Failed to fetch (blocked by connect-src CSP)');
    }) as unknown as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it('decodes a base64 data URL without calling fetch', async () => {
    // 1x1 transparent PNG
    const base64 =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
    const blob = await dataUrlToBlob(`data:image/png;base64,${base64}`);

    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(blob.type).toBe('image/png');
    const bytes = new Uint8Array(await blob.arrayBuffer());
    // PNG signature: 89 50 4E 47
    expect([...bytes.slice(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
  });

  it('decodes a URL-encoded (non-base64) data URL', async () => {
    const blob = await dataUrlToBlob('data:text/plain,hello%20world');
    expect(blob.type).toBe('text/plain');
    expect(await blob.text()).toBe('hello world');
  });

  it('rejects non-data URLs instead of falling back to fetch', async () => {
    await expect(dataUrlToBlob('https://example.com/a.jpg')).rejects.toBeInstanceOf(
      ImageProcessingError,
    );
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});
