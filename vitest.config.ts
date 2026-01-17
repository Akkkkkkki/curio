import path from 'path';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

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
    environment: 'happy-dom',
    setupFiles: './tests/setup.ts',
    include: ['tests/**/*.test.{ts,tsx}'],
    // IndexedDB-heavy integration tests (Phase 2) use a fixed DB name in production code.
    // Running test files in parallel can cause delete/open blocking across suites.
    // Keep the suite deterministic by running with a single worker.
    maxWorkers: 1,
    sequence: {
      concurrent: false,
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/services/**/*.ts', 'src/hooks/**/*.ts', 'src/components/**/*.tsx'],
      exclude: [
        'node_modules/',
        'tests/',
        '**/*.test.{ts,tsx}',
        '**/types.ts',
        '**/constants.ts',
        '**/i18n.ts',
      ],
      thresholds: {
        'src/services/**/*.ts': {
          lines: 90,
          functions: 90,
          branches: 90,
          statements: 90,
        },
        'src/hooks/**/*.ts': {
          lines: 80,
          functions: 80,
          branches: 80,
          statements: 80,
        },
        'src/components/**/*.tsx': {
          lines: 70,
          functions: 70,
          branches: 70,
          statements: 70,
        },
      },
    },
  },
});
