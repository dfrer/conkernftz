const { resolve } = require('node:path');

// Make the built HTML load from a plain file:// double-click, not just http. ES-module
// scripts (`type="module"`) are CORS-blocked from file:// (opaque origin) in browsers, so we
// emit a single classic (IIFE) bundle and rewrite the entry tag to a non-module script. CSS
// (<link>) and @font-face url() both load fine from file://, so only the JS needs this.
function staticFriendlyHtml() {
  return {
    name: 'static-friendly-html',
    transformIndexHtml(html) {
      return (
        html
          .replace(/\s+crossorigin/g, '')
          // Classic (non-module) script so it loads from file://, but `defer` so it still runs
          // AFTER the DOM is parsed (module scripts defer implicitly; classic ones don't —
          // without this the script runs in <head> before #root exists and nothing mounts).
          .replace(/<script type="module"/g, '<script defer')
          .replace(/\s*<link[^>]+rel="modulepreload"[^>]*>/g, '')
      );
    },
  };
}

// Builds the standalone static mint-site template (src/site-template) into dist/site-template.
// The generator copies this output and drops a site-data.js (window.__CONKER_SITE__) beside
// it. `base: './'` + a classic IIFE bundle keep it host-anywhere — any static host, IPFS, or a
// double-clicked file://.
module.exports = async function config() {
  const { default: react } = await import('@vitejs/plugin-react');
  return {
    root: resolve(__dirname, 'src/site-template'),
    base: './',
    plugins: [react(), staticFriendlyHtml()],
    resolve: {
      alias: {
        '@conkernftz/chain-evm': resolve(__dirname, 'src/renderer-next/lib/chainEvmBrowser.mjs'),
      },
    },
    build: {
      outDir: resolve(__dirname, 'dist/site-template'),
      emptyOutDir: true,
      sourcemap: true,
      rolldownOptions: {
        output: {
          format: 'iife',
          codeSplitting: false,
          entryFileNames: 'assets/[name].js',
          chunkFileNames: 'assets/[name].js',
          assetFileNames: 'assets/[name][extname]',
        },
      },
    },
  };
};
