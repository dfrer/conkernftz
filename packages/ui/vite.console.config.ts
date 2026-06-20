import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));

// Builds the standalone "Launch console" (src/launch-console) into dist/launch-console. The app
// serves it over http://127.0.0.1 so it runs in the user's real browser, where an injected wallet
// (MetaMask extension) is available — something the Electron app itself cannot reach. Served
// over http (not file://), so a normal ES-module build with relative base is fine.
export default defineConfig({
  root: resolve(here, 'src/launch-console'),
  base: './',
  build: {
    outDir: resolve(here, 'dist/launch-console'),
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name][extname]',
      },
    },
  },
});
