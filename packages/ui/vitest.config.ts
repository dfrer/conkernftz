import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Node environment by default (the Electron main-process tests); React component tests
// under src/renderer-next run in happy-dom. The React plugin handles JSX/TSX transform.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    environmentMatchGlobs: [['src/renderer-next/**', 'happy-dom']],
    setupFiles: ['./vitest.setup.ts'],
    passWithNoTests: true,
    // Generous timeout so heavier suites don't flake under parallel `pnpm -w test` CPU contention.
    testTimeout: 30000,
    hookTimeout: 30000,
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'json-summary'],
      include: ['src/**/*.{ts,tsx}'],
      // Exclude tests, type decls, and non-unit-testable entrypoints (Electron bootstrap, the
      // standalone site-template bundle, the renderer mount, and the dev screenshot harness).
      exclude: [
        'src/**/__tests__/**',
        'src/**/*.test.*',
        'src/**/*.d.ts',
        'src/main.ts',
        'src/preload.ts',
        'src/preload.cjs',
        'src/site-template/**',
        'src/renderer-next/main.tsx',
        'scripts/**',
      ],
      // Regression-guard floors (a few points below current: ~69% lines / 73% branches / 56%
      // functions). Raise as coverage grows; don't let it drop.
      thresholds: { lines: 64, statements: 64, branches: 66, functions: 50 },
    },
  },
});
