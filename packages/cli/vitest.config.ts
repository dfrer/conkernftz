import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    environment: 'node',
    // Generous timeout: the e2e-build test does a real seeded build (sharp compositing) and flaked
    // at the 5s default under parallel `pnpm -w test` CPU contention (passes in ~22s solo).
    testTimeout: 60000,
    hookTimeout: 60000,
  },
});
