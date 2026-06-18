import * as electron from 'electron';
import path from 'path';
import { initProjectIpc } from './main/ipc-project.js';
import { initStorageIpc } from './main/ipc-storage.js';
import { initCliRunner } from './main/cli-runner.js';

const appDir = __dirname;

initProjectIpc();
initStorageIpc();
initCliRunner();

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
  // Opt-in preview of the new React renderer (Phase O1+). Defaults to the legacy
  // renderer until the O6 cutover. Enable with CONKERNFTZ_NEXT=1 (or `pnpm start:next`).
  const useNext = process.env.CONKERNFTZ_NEXT === '1';
  const indexHtml = useNext ? path.join(appDir, 'renderer-next', 'index.html') : path.join(appDir, 'index.html');
  win.loadFile(indexHtml);
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
