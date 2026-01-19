import path from 'path';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

/**
 * Live integration ("smoke") tests.
 *
 * These tests are allowed to call real services (Gemini proxy, etc.), so they are:
 * - opt-in (run via `npm run test:live`)
 * - slower and potentially flaky vs unit tests
 * - may require credentials and can incur API cost
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@tests': path.resolve(__dirname, './tests'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/live/**/*.live.test.{ts,tsx}'],
    // Keep deterministic ordering; live endpoints can rate-limit.
    maxWorkers: 1,
    sequence: {
      concurrent: false,
    },
  },
});

