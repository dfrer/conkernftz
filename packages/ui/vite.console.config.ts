const { resolve } = require('node:path');

// Builds the standalone "Launch console" (src/launch-console) into dist/launch-console. The app
// serves it over http://127.0.0.1 so it runs in the user's real browser, where an injected wallet
// (MetaMask extension) is available — something the Electron app itself cannot reach. Served
// over http (not file://), so a normal ES-module build with relative base is fine.
module.exports = {
  root: resolve(__dirname, 'src/launch-console'),
  base: './',
  resolve: {
    alias: {
      '@conkernftz/chain-evm': resolve(__dirname, 'src/renderer-next/lib/chainEvmBrowser.mjs'),
    },
  },
  build: {
    outDir: resolve(__dirname, 'dist/launch-console'),
    emptyOutDir: true,
    sourcemap: true,
    rolldownOptions: {
      output: {
        codeSplitting: false,
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name][extname]',
      },
    },
  },
};
