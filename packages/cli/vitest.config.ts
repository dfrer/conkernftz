import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    environment: 'node',
    // Only collect source tests. A prior build leaves compiled test copies under dist,
    // which Vitest 4 otherwise discovers and runs a second time.
    include: ['src/**/*.test.ts'],
    // Generous timeout: the e2e-build test does a real seeded build (sharp compositing) and flaked
    // at the 5s default under parallel `pnpm -w test` CPU contention (passes in ~22s solo).
    testTimeout: 60000,
    hookTimeout: 60000,
  },
});
