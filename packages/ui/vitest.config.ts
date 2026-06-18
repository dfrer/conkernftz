import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Node environment by default (the Electron main-process tests); React component tests
// under src/renderer-next run in happy-dom. The React plugin handles JSX/TSX transform.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    environmentMatchGlobs: [['src/renderer-next/**', 'happy-dom']],
    setupFiles: ['./vitest.setup.ts'],
    passWithNoTests: true,
  },
});
