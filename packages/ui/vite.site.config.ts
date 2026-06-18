import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));

// Strip `crossorigin` so the bundle loads over file:// (matches vite.config.ts) — generated
// sites are commonly opened/served as static files.
function stripCrossorigin() {
  return {
    name: 'strip-crossorigin',
    transformIndexHtml(html: string): string {
      return html.replace(/\s+crossorigin/g, '');
    },
  };
}

// Builds the standalone static mint-site template (src/site-template) into dist/site-template.
// The generator copies this output and drops a site-data.js (window.__CONKER_SITE__) beside
// it. `base: './'` keeps asset URLs relative so it deploys to any static host (or file://).
export default defineConfig({
  root: resolve(here, 'src/site-template'),
  base: './',
  plugins: [react(), stripCrossorigin()],
  build: {
    outDir: resolve(here, 'dist/site-template'),
    emptyOutDir: true,
    sourcemap: true,
  },
});
