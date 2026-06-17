import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // Only run TypeScript tests from src. The package emits a dual ESM/CJS build, and
    // vitest's default exclude covers `dist` but not `dist-cjs`, so without this it would
    // also collect the compiled copies under dist-cjs/__tests__.
    include: ['src/**/*.test.ts'],
  },
});
