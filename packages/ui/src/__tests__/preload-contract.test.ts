import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { FOUNDRY_METHODS } from '../shared/ipc.js';

// Guards against drift between the typed contract (FoundryApi / FOUNDRY_METHODS) and
// the hand-written runtime preload.cjs. Before O0, readFileBase64 and saveJson were
// added to preload.ts/preload.d.ts but missed in preload.cjs (the file Electron
// actually loads), silently breaking the Studio's image/animation previews. This test
// makes that class of bug a hard CI failure.

// __dirname is valid under the package's CommonJS module type, and Vitest provides it.
const here = __dirname;

function readPreload(name: string): string {
  return fs.readFileSync(path.resolve(here, '..', name), 'utf8');
}

function expectExactRenameChannel(code: string): void {
  expect(code).toMatch(
    /\brenameFileExact\s*:\s*\([^)]*\)\s*=>\s*ipcRenderer\.invoke\(\s*['"]foundry:renameFileExact['"]\s*,\s*from\s*,\s*to\s*\)/,
  );
}

describe('preload contract', () => {
  it('preload.cjs (the runtime bridge) exposes every FoundryApi method', () => {
    const code = readPreload('preload.cjs');
    for (const method of FOUNDRY_METHODS) {
      expect(code, `preload.cjs is missing the "${method}" method`).toMatch(new RegExp(`\\b${method}\\s*:`));
    }
  });

  it('preload.ts (the typed mirror) exposes every FoundryApi method', () => {
    const code = readPreload('preload.ts');
    for (const method of FOUNDRY_METHODS) {
      expect(code, `preload.ts is missing the "${method}" method`).toMatch(new RegExp(`\\b${method}\\s*:`));
    }
  });

  it('routes exact single-file renames through the dedicated IPC channel', () => {
    expectExactRenameChannel(readPreload('preload.cjs'));
    expectExactRenameChannel(readPreload('preload.ts'));
  });
});
