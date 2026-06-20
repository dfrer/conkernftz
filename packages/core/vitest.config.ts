import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    environment: 'node',
    // Heavy suites (compositing / e2e / merkle) pass well under the 5s default solo, but the
    // monorepo `pnpm -w test` runs every package in parallel — CPU contention can push them past
    // 5s and flake. A generous per-test/hook timeout removes that latent CI flakiness.
    testTimeout: 30000,
    hookTimeout: 30000,
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'json-summary'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/__tests__/**', 'src/**/*.test.ts', 'src/**/*.d.ts', 'src/index.ts'],
      // Regression-guard floors (set a few points below the current measured coverage:
      // ~56% lines / 56% branches / 59% functions). Raise as coverage grows; don't let it drop.
      thresholds: { lines: 52, statements: 52, branches: 50, functions: 52 },
    },
  },
});
