import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));

// Builds the new React renderer (src/renderer-next) into dist/renderer-next. `base: './'`
// keeps asset URLs relative so the bundle can be loaded over file:// by Electron later.
// This is a parallel app: the legacy renderer (src/renderer, built by tsc) remains the
// default entry until the O6 cutover.
export default defineConfig({
  root: resolve(here, 'src/renderer-next'),
  base: './',
  plugins: [react()],
  server: { port: 5179, strictPort: true },
  build: {
    outDir: resolve(here, 'dist/renderer-next'),
    emptyOutDir: true,
    sourcemap: true,
  },
});
