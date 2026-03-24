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
});
