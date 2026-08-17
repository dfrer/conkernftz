// Node environment by default (the Electron main-process tests); React component tests
// under src/renderer-next run in happy-dom. The React plugin handles JSX/TSX transform.
module.exports = async function config() {
  const { default: react } = await import('@vitejs/plugin-react');
  return {
    plugins: [react()],
    test: {
      // Vitest 4 removed environmentMatchGlobs. Keep the former split explicit so
      // Electron main-process tests run in Node and renderer tests run in happy-dom.
      projects: [
        {
          extends: true,
          test: {
            name: 'node',
            environment: 'node',
            include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
            exclude: ['src/renderer-next/**'],
          },
        },
        {
          extends: true,
          test: {
            name: 'renderer',
            environment: 'happy-dom',
            include: ['src/renderer-next/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
          },
        },
      ],
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
        // Vitest 4's AST-based V8 remapping reports ~46% lines / 44% statements /
        // 38% branches / 42% functions. Keep floors a few points below that baseline.
        thresholds: { lines: 42, statements: 40, branches: 34, functions: 38 },
      },
    },
  };
};
