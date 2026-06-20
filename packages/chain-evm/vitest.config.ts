import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    environment: 'node',
    // Generous timeout so heavy work doesn't flake under parallel `pnpm -w test` CPU contention.
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
