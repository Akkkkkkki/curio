import { describe, expect, it } from 'vitest';
import { buildCspPolicy } from '../../vite.config';

// Regression: ISSUE-001 — dev CSP blocked Vercel observability scripts
// Found by /qa on 2026-03-24
// Report: .gstack/qa-reports/qa-report-localhost-2026-03-24.md

describe('buildCspPolicy', () => {
  it('allows Vercel observability scripts in script-src', () => {
    expect(buildCspPolicy()).toContain("script-src 'self' https://va.vercel-scripts.com");
  });

  it('preserves the configured API origin in connect-src', () => {
    expect(buildCspPolicy({ apiBaseUrl: 'https://api.curio.test' })).toContain(
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.curio.test",
    );
  });

  it('allows Google Fonts origins in connect-src so html-to-image can inline fonts on export', () => {
    // Regression: export card "Save image" failed because html-to-image fetches
    // the Google Fonts stylesheet + font files and connect-src blocked them.
    const policy = buildCspPolicy();
    expect(policy).toContain('https://fonts.googleapis.com');
    expect(policy).toContain('https://fonts.gstatic.com');
    const connectDirective = policy.split('; ').find((d) => d.startsWith('connect-src '));
    expect(connectDirective).toContain('https://fonts.googleapis.com');
    expect(connectDirective).toContain('https://fonts.gstatic.com');
  });

  it('allows data: fonts in font-src so exported cards keep their brand fonts', () => {
    // Regression: html-to-image inlines fonts as `data:font/woff2;base64,...`
    // during export; a font-src without `data:` made the browser refuse them,
    // so the rasterized card fell back to system fonts.
    const policy = buildCspPolicy();
    const fontDirective = policy.split('; ').find((d) => d.startsWith('font-src '));
    expect(fontDirective).toContain("'self'");
    expect(fontDirective).toContain('https://fonts.gstatic.com');
    expect(fontDirective).toContain('data:');
  });
});
