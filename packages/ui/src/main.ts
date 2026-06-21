import * as electron from 'electron';
import path from 'path';
import { initProjectIpc } from './main/ipc-project.js';
import { initStorageIpc } from './main/ipc-storage.js';
import { initPacksIpc } from './main/ipc-packs.js';
import { initCliRunner } from './main/cli-runner.js';
import { initLaunchRunner } from './main/launch-runner.js';
import { initSolanaLaunchRunner } from './main/launch-runner-solana.js';

const appDir = __dirname;

initProjectIpc();
initStorageIpc();
initPacksIpc();
initCliRunner();
initLaunchRunner();
initSolanaLaunchRunner();

function createWindow(): void {
  const win = new electron.BrowserWindow({
    width: 1100,
    height: 800,
    icon: path.join(appDir, 'assets', 'logo-512.png'),
    webPreferences: {
      // Use CommonJS preload to avoid ESM import error in Electron
      preload: path.join(appDir, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
    },
  });
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('did-fail-load', (_e, code, desc) => {
    console.error('Failed to load UI:', code, desc);
  });
  win.loadFile(path.join(appDir, 'renderer-next', 'index.html'));
}

electron.app.whenReady().then(() => {
  createWindow();
  electron.app.on('activate', () => {
    if (electron.BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

electron.app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') electron.app.quit();
});
