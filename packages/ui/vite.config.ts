import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));

// Electron loads the built renderer over file://. Vite adds `crossorigin` to its module
// <script>/<link> tags, which forces CORS mode and fails for file:// (opaque origin) —
// the legacy renderer's hand-written module script works precisely because it has no
// crossorigin. Strip it so the Vite bundle loads the same way.
function stripCrossorigin() {
  return {
    name: 'strip-crossorigin',
    transformIndexHtml(html: string): string {
      return html.replace(/\s+crossorigin/g, '');
    },
  };
}

// Builds the new React renderer (src/renderer-next) into dist/renderer-next. `base: './'`
// keeps asset URLs relative so the bundle can be loaded over file:// by Electron.
// This is a parallel app: the legacy renderer (src/renderer, built by tsc) remains the
// default entry until the O6 cutover; the new UI is opt-in via CONKERNFTZ_NEXT=1.
export default defineConfig({
  root: resolve(here, 'src/renderer-next'),
  base: './',
  plugins: [react(), stripCrossorigin()],
  server: { port: 5179, strictPort: true },
  build: {
    outDir: resolve(here, 'dist/renderer-next'),
    emptyOutDir: true,
    sourcemap: true,
  },
});
