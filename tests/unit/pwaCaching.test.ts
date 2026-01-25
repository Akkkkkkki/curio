import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('service worker caching strategy', () => {
  it('uses network-first for HTML navigation to avoid stale shells', () => {
    const swPath = resolve(process.cwd(), 'public', 'sw.js');
    const swContents = readFileSync(swPath, 'utf-8');

    expect(swContents).toContain('isHtmlNavigation');
    expect(swContents).toContain('fetch(event.request)');
    expect(swContents).toContain('cache.put(event.request');
  });
});
