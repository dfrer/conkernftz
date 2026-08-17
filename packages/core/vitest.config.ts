import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    environment: 'node',
    // Only collect source tests. A prior build leaves compiled test copies under dist,
    // which Vitest 4 otherwise discovers and runs a second time.
    include: ['src/**/*.test.ts'],
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
      // Vitest 4's AST-based V8 remapping reports ~50% lines / 47% statements /
      // 34% branches / 54% functions. Keep floors a few points below that baseline.
      thresholds: { lines: 46, statements: 43, branches: 30, functions: 52 },
    },
  },
});
