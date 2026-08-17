const { resolve } = require('node:path');

// Electron loads the built renderer over file://. Vite adds `crossorigin` to its module
// <script>/<link> tags, which forces CORS mode and fails for file:// (opaque origin) —
// the legacy renderer's hand-written module script works precisely because it has no
// crossorigin. Strip it so the Vite bundle loads the same way.
function stripCrossorigin() {
  return {
    name: 'strip-crossorigin',
    transformIndexHtml(html) {
      return html.replace(/\s+crossorigin/g, '');
    },
  };
}

// Builds the React renderer (src/renderer-next) into dist/renderer-next. `base: './'`
// keeps asset URLs relative so the bundle can be loaded over file:// by Electron. This is
// the only renderer — Electron's main process loads dist/renderer-next/index.html directly.
module.exports = async function config() {
  const { default: react } = await import('@vitejs/plugin-react');
  return {
    root: resolve(__dirname, 'src/renderer-next'),
    base: './',
    plugins: [react(), stripCrossorigin()],
    resolve: {
      alias: {
        '@conkernftz/chain-evm': resolve(__dirname, 'src/renderer-next/lib/chainEvmBrowser.mjs'),
      },
    },
    server: { port: 5179, strictPort: true },
    build: {
      outDir: resolve(__dirname, 'dist/renderer-next'),
      emptyOutDir: true,
      sourcemap: true,
    },
  };
};
