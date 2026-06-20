import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    environment: 'node',
    // Heavy suites (compositing / e2e / merkle) pass well under the 5s default solo, but the
    // monorepo `pnpm -w test` runs every package in parallel — CPU contention can push them past
    // 5s and flake. A generous per-test/hook timeout removes that latent CI flakiness.
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
