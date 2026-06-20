import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    environment: 'node',
    // Generous timeout: the Candy-Guard merkle test is heavy and flaked at the 5s default under
    // parallel `pnpm -w test` CPU contention (passes in ~6s solo).
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
