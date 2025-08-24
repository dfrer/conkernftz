import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import path from 'path';
import fs from 'node:fs/promises';
import { execFile, fork } from 'node:child_process';
import { promisify } from 'node:util';
import fssync from 'node:fs';
import { shell } from 'electron';

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1100,
    height: 800,
    icon: path.join(__dirname, 'assets', 'logo-512.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
    },
  });
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('did-fail-load', (_e, code, desc) => {
    console.error('Failed to load UI:', code, desc);
  });
  win.loadFile(path.join(__dirname, 'index.html'));
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

let projectDir: string | null = null;

ipcMain.handle('foundry:chooseProjectDir', async () => {
  const res = await dialog.showOpenDialog({ properties: ['openDirectory', 'createDirectory'] });
  if (res.canceled || res.filePaths.length === 0) return { ok: false, error: 'Canceled' };
  projectDir = res.filePaths[0] as string;
  return { ok: true, projectDir };
});

ipcMain.handle('foundry:getProjectDir', async () => ({ ok: true, projectDir }));

ipcMain.handle('foundry:setProjectDir', async (_evt, dir: string) => {
  try {
    if (!dir || typeof dir !== 'string') return { ok: false, error: 'Invalid path' };
    const exists = fssync.existsSync(dir);
    if (!exists) return { ok: false, error: 'Path does not exist' };
    projectDir = dir;
    return { ok: true, projectDir };
  } catch (e: any) {
    return { ok: false, error: String(e?.message ?? e) };
  }
});

ipcMain.handle('foundry:readConfig', async () => {
  try {
    if (!projectDir) return { ok: false, error: 'No project selected' };
    const p = path.join(projectDir, 'foundry.config.json');
    const raw = await fs.readFile(p, 'utf8');
    return { ok: true, json: JSON.parse(raw) };
  } catch (e: any) {
    return { ok: false, error: String(e?.message ?? e) };
  }
});

ipcMain.handle('foundry:readConfigAt', async (_evt, dir: string) => {
  try {
    if (!dir || typeof dir !== 'string') return { ok: false, error: 'Invalid path' };
    const p = path.join(dir, 'foundry.config.json');
    const raw = await fs.readFile(p, 'utf8');
    return { ok: true, json: JSON.parse(raw) };
  } catch (e: any) {
    return { ok: false, error: String(e?.message ?? e) };
  }
});

ipcMain.handle('foundry:writeConfig', async (_evt, json: unknown) => {
  try {
    if (!projectDir) return { ok: false, error: 'No project selected' };
    const p = path.join(projectDir, 'foundry.config.json');
    await fs.writeFile(p, JSON.stringify(json, null, 2));
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: String(e?.message ?? e) };
  }
});

// Simple bridge to call CLI
const execFileAsync = promisify(execFile);

async function runPnpm(args: string[], cwd: string): Promise<{ stdout: string; stderr: string }> {
  const cmd = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
  const { stdout, stderr } = await execFileAsync(cmd, args, { cwd });
  return { stdout: String(stdout ?? ''), stderr: String(stderr ?? '') };
}

async function ensureCliAndDepsBuilt(): Promise<void> {
  // Build only if missing to avoid environment spawn issues
  const uiDistDir = __dirname; // .../packages/ui/dist
  const repoRoot = path.resolve(uiDistDir, '../../..');
  const pkgsDir = path.resolve(uiDistDir, '../..'); // .../packages
  const cliDist = path.join(pkgsDir, 'cli', 'dist', 'bin.js');
  const coreDist = path.join(pkgsDir, 'core', 'dist', 'index.js');
  const storageDist = path.join(pkgsDir, 'storage', 'dist', 'index.js');
  const chainDist = path.join(pkgsDir, 'chain-solana', 'dist', 'index.js');

  const needCore = !fssync.existsSync(coreDist);
  const needStorage = !fssync.existsSync(storageDist);
  const needChain = !fssync.existsSync(chainDist);
  const needCli = !fssync.existsSync(cliDist);

  try {
    if (needCore) await runPnpm(['-C', path.join(pkgsDir, 'core'), 'build'], repoRoot);
    if (needStorage) await runPnpm(['-C', path.join(pkgsDir, 'storage'), 'build'], repoRoot);
    if (needChain) await runPnpm(['-C', path.join(pkgsDir, 'chain-solana'), 'build'], repoRoot);
    if (needCli) await runPnpm(['-C', path.join(pkgsDir, 'cli'), 'build'], repoRoot);
  } catch (e) {
    console.warn('ensureCliAndDepsBuilt: build step failed:', e);
  }
}

function runNodeModule(binPath: string, args: string[], cwd: string): Promise<{ stdout: string; stderr: string; code: number | null }>{
  return new Promise((resolve, reject) => {
    const child = fork(binPath, args, { cwd, stdio: ['ignore', 'pipe', 'pipe', 'ipc'] });
    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (d) => { stdout += String(d); });
    child.stderr?.on('data', (d) => { stderr += String(d); });
    child.on('error', (err) => reject(err));
    child.on('exit', (code) => resolve({ stdout, stderr, code }));
  });
}

ipcMain.handle('foundry:run', async (_evt, args: string[]) => {
  try {
    if (!projectDir) {
      const pick = await dialog.showOpenDialog({ properties: ['openDirectory'] });
      if (pick.canceled || pick.filePaths.length === 0) return { ok: false, error: 'Select a project directory first.' };
      projectDir = pick.filePaths[0] as string;
    }
    // Build prerequisites on-demand if needed
    await ensureCliAndDepsBuilt();

    const root = path.join(__dirname, '../../cli');
    const bin = path.join(root, 'dist', 'bin.js');
    const { stdout, stderr, code } = await runNodeModule(bin, args, projectDir as string);
    if (code !== 0) {
      throw new Error(stderr || `CLI exited with code ${code}`);
    }
    return { ok: true, stdout: String(stdout ?? '') };
  } catch (e: any) {
    return { ok: false, error: String(e?.message ?? e) };
  }
});

// Pick a dir within the currently selected project
ipcMain.handle('foundry:chooseDirInsideProject', async () => {
  try {
    if (!projectDir) return { ok: false, error: 'No project selected' };
    const res = await dialog.showOpenDialog({ title: 'Choose directory', defaultPath: projectDir, properties: ['openDirectory', 'createDirectory'] });
    if (res.canceled || res.filePaths.length === 0) return { ok: false, error: 'Canceled' };
    const p = res.filePaths[0] as string;
    if (!p.startsWith(projectDir)) return { ok: false, error: 'Must be inside the project directory' };
    return { ok: true, path: path.relative(projectDir, p) };
  } catch (e: any) {
    return { ok: false, error: String(e?.message ?? e) };
  }
});

// Read arbitrary text file within project (e.g., show rarity report)
ipcMain.handle('foundry:readFile', async (_evt, relativePath: string) => {
  try {
    if (!projectDir) return { ok: false, error: 'No project selected' };
    const p = path.join(projectDir, relativePath);
    const content = await fs.readFile(p, 'utf8');
    return { ok: true, content };
  } catch (e: any) {
    return { ok: false, error: String(e?.message ?? e) };
  }
});

// Ensure directories exist inside the project
ipcMain.handle('foundry:ensureDirs', async (_evt, relativePaths: string[]) => {
  try {
    if (!projectDir) return { ok: false, error: 'No project selected' };
    for (const rel of relativePaths) {
      if (!rel) continue;
      const p = path.join(projectDir, rel);
      await fs.mkdir(p, { recursive: true });
    }
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: String(e?.message ?? e) };
  }
});

// List images (png/webp/gif) count inside a directory relative to project
ipcMain.handle('foundry:listImages', async (_evt, relativePath: string) => {
  try {
    if (!relativePath) return { ok: true, count: 0 };
    const dir = path.isAbsolute(relativePath) ? relativePath : (projectDir ? path.join(projectDir, relativePath) : relativePath);
    const exists = fssync.existsSync(dir);
    if (!exists) return { ok: true, count: 0 };
    const dirents = await fs.readdir(dir, { withFileTypes: true });
    const count = dirents
      .filter((d) => d.isFile())
      .map((d) => d.name.toLowerCase())
      .filter((n) => n.endsWith('.png') || n.endsWith('.webp') || n.endsWith('.gif'))
      .length;
    return { ok: true, count };
  } catch (e: any) {
    return { ok: false, error: String(e?.message ?? e) };
  }
});

// Open a directory in the OS file explorer
ipcMain.handle('foundry:openInExplorer', async (_evt, relativePath: string) => {
  try {
    const dir = path.isAbsolute(relativePath || '') ? (relativePath || '') : (projectDir ? path.join(projectDir, relativePath || '') : (relativePath || ''));
    if (!fssync.existsSync(dir)) return { ok: false, error: 'Path does not exist' };
    await shell.openPath(dir);
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: String(e?.message ?? e) };
  }
});

ipcMain.handle('foundry:openExternal', async (_evt, url: string) => {
  try {
    if (!url || typeof url !== 'string') return { ok: false, error: 'Invalid URL' };
    await shell.openExternal(url);
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: String(e?.message ?? e) };
  }
});

// List directory (simple helper for debugging paths)
ipcMain.handle('foundry:listDir', async (_evt, relativePath: string) => {
  try {
    const dir = path.isAbsolute(relativePath || '') ? (relativePath || '') : (projectDir ? path.join(projectDir, relativePath || '') : (relativePath || ''));
    const dirents = await fs.readdir(dir, { withFileTypes: true });
    const items = dirents.map((d) => (d.isDirectory() ? d.name + '/' : d.name));
    return { ok: true, items };
  } catch (e: any) {
    return { ok: false, error: String(e?.message ?? e) };
  }
});

// Bulk rename files inside the project. Accepts absolute or project-relative 'from' and 'to' paths
ipcMain.handle('foundry:renameFiles', async (_evt, pairs: { from: string; to: string }[]) => {
  try {
    if (!Array.isArray(pairs) || pairs.length === 0) return { ok: true, renamed: 0 };
    const toAbs = (p: string) => (path.isAbsolute(p) ? p : (projectDir ? path.join(projectDir, p) : p));
    const isInsideProject = (p: string) => {
      if (!projectDir) return true;
      const rel = path.relative(projectDir, p);
      return !!rel && !rel.startsWith('..') && !path.isAbsolute(rel);
    };
    let renamed = 0;
    const renamedPairs: Array<{ from: string; to: string }> = [];
    for (const pair of pairs) {
      if (!pair || !pair.from || !pair.to) continue;
      const src = toAbs(pair.from);
      let dst = toAbs(pair.to);
      const dstDir = path.dirname(dst);
      if (projectDir) {
        if (!isInsideProject(src) || !isInsideProject(dst)) {
          return { ok: false, error: 'Rename paths must be inside the project directory' };
        }
      }
      if (!fssync.existsSync(src)) continue;
      await fs.mkdir(dstDir, { recursive: true });
      // If destination exists, try to find a free incremental suffix
      if (fssync.existsSync(dst)) {
        const ext = path.extname(dst);
        const base = path.join(dstDir, path.basename(dst, ext));
        let i = 1;
        let candidate = `${base}_${i}${ext}`;
        while (fssync.existsSync(candidate)) {
          i++;
          candidate = `${base}_${i}${ext}`;
        }
        dst = candidate;
      }
      await fs.rename(src, dst);
      renamed++;
    }
    // After renames, emit a simple notification to the renderer if needed later
    return { ok: true, renamed };
  } catch (e: any) {
    return { ok: false, error: String(e?.message ?? e) };
  }
});


