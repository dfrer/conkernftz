import * as electron from 'electron';
import path from 'path';
import fs from 'node:fs/promises';
import fssync from 'node:fs';
import { FileManager } from '@foundry/storage/file-manager';

let projectDir: string | null = null;
let fileManager: FileManager | null = null;

export function getProjectDir(): string | null {
  return projectDir;
}

export function setProjectDir(dir: string | null): void {
  projectDir = dir;
  fileManager = dir ? new FileManager(dir) : null;
}

export function getFileManager(): FileManager | null {
  return fileManager;
}

export function setFileManager(fm: FileManager | null): void {
  fileManager = fm;
}

export function initProjectIpc(): void {
  electron.ipcMain.handle('foundry:chooseProjectDir', async () => {
    const res = await electron.dialog.showOpenDialog({ properties: ['openDirectory', 'createDirectory'] });
    if (res.canceled || res.filePaths.length === 0) return { ok: false, error: 'Canceled' };
    setProjectDir(res.filePaths[0] as string);
    return { ok: true, projectDir };
  });

  electron.ipcMain.handle('foundry:getProjectDir', async () => ({ ok: true, projectDir }));

  electron.ipcMain.handle('foundry:setProjectDir', async (_evt, dir: string) => {
    try {
      if (!dir || typeof dir !== 'string') return { ok: false, error: 'Invalid path' };
      const exists = fssync.existsSync(dir);
      if (!exists) return { ok: false, error: 'Path does not exist' };
      setProjectDir(dir);
      return { ok: true, projectDir };
    } catch (e: any) {
      return { ok: false, error: String(e?.message ?? e) };
    }
  });

  electron.ipcMain.handle('foundry:readConfig', async () => {
    try {
      if (!projectDir) return { ok: false, error: 'No project selected' };
      const p = path.join(projectDir, 'foundry.config.json');
      const raw = await fs.readFile(p, 'utf8');
      return { ok: true, json: JSON.parse(raw) };
    } catch (e: any) {
      return { ok: false, error: String(e?.message ?? e) };
    }
  });

  electron.ipcMain.handle('foundry:readConfigAt', async (_evt, dir: string) => {
    try {
      if (!dir || typeof dir !== 'string') return { ok: false, error: 'Invalid path' };
      const p = path.join(dir, 'foundry.config.json');
      const raw = await fs.readFile(p, 'utf8');
      return { ok: true, json: JSON.parse(raw) };
    } catch (e: any) {
      return { ok: false, error: String(e?.message ?? e) };
    }
  });

  electron.ipcMain.handle('foundry:writeConfig', async (_evt, json: unknown) => {
    try {
      if (!projectDir) return { ok: false, error: 'No project selected' };
      const p = path.join(projectDir, 'foundry.config.json');
      await fs.writeFile(p, JSON.stringify(json, null, 2));
      return { ok: true };
    } catch (e: any) {
      return { ok: false, error: String(e?.message ?? e) };
    }
  });

  electron.ipcMain.handle('foundry:chooseDirInsideProject', async () => {
    try {
      if (!projectDir) return { ok: false, error: 'No project selected' };
      const res = await electron.dialog.showOpenDialog({ title: 'Choose directory', defaultPath: projectDir, properties: ['openDirectory', 'createDirectory'] });
      if (res.canceled || res.filePaths.length === 0) return { ok: false, error: 'Canceled' };
      const p = res.filePaths[0] as string;
      if (!p.startsWith(projectDir)) return { ok: false, error: 'Must be inside the project directory' };
      return { ok: true, path: path.relative(projectDir, p) };
    } catch (e: any) {
      return { ok: false, error: String(e?.message ?? e) };
    }
  });

  electron.ipcMain.handle('foundry:readFile', async (_evt, relativePath: string) => {
    try {
      if (!projectDir) return { ok: false, error: 'No project selected' };
      const p = path.join(projectDir, relativePath);
      const content = await fs.readFile(p, 'utf8');
      return { ok: true, content };
    } catch (e: any) {
      return { ok: false, error: String(e?.message ?? e) };
    }
  });

  electron.ipcMain.handle('foundry:ensureDirs', async (_evt, relativePaths: string[]) => {
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

  electron.ipcMain.handle('foundry:listImages', async (_evt, relativePath: string) => {
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

  electron.ipcMain.handle('foundry:openInExplorer', async (_evt, relativePath: string) => {
    try {
      const dir = path.isAbsolute(relativePath || '') ? (relativePath || '') : (projectDir ? path.join(projectDir, relativePath || '') : (relativePath || ''));
      if (!fssync.existsSync(dir)) return { ok: false, error: 'Path does not exist' };
      await electron.shell.openPath(dir);
      return { ok: true };
    } catch (e: any) {
      return { ok: false, error: String(e?.message ?? e) };
    }
  });

  electron.ipcMain.handle('foundry:openExternal', async (_evt, url: string) => {
    try {
      if (!url || typeof url !== 'string') return { ok: false, error: 'Invalid URL' };
      await electron.shell.openExternal(url);
      return { ok: true };
    } catch (e: any) {
      return { ok: false, error: String(e?.message ?? e) };
    }
  });

  electron.ipcMain.handle('foundry:listDir', async (_evt, relativePath: string) => {
    try {
      if (!projectDir) return { ok: false, error: 'No project selected' };
      if (!fileManager) fileManager = new FileManager(projectDir);
      const entries = await fileManager.listDir(relativePath || '.');
      const items = entries.map((e) => (e.isDir ? e.name + '/' : e.name));
      return { ok: true, items };
    } catch (e: any) {
      return { ok: false, error: String(e?.message ?? e) };
    }
  });

  // Delete a file or directory (recursive) inside the project
  electron.ipcMain.handle('foundry:deletePath', async (_evt, relativePath: string) => {
    try {
      if (!projectDir) return { ok: false, error: 'No project selected' };
      if (!relativePath || typeof relativePath !== 'string') return { ok: false, error: 'Invalid path' };
      if (!fileManager) fileManager = new FileManager(projectDir);
      await fileManager.deletePath(relativePath);
      return { ok: true };
    } catch (e: any) {
      return { ok: false, error: String(e?.message ?? e) };
    }
  });

  electron.ipcMain.handle('foundry:renameFiles', async (_evt, pairs: { from: string; to: string }[]) => {
    try {
      if (!Array.isArray(pairs) || pairs.length === 0) return { ok: true, renamed: 0 };
      const toAbs = (p: string) => (path.isAbsolute(p) ? p : (projectDir ? path.join(projectDir, p) : p));
      const isInsideProject = (p: string) => {
        if (!projectDir) return true;
        const rel = path.relative(projectDir, p);
        return !!rel && !rel.startsWith('..') && !path.isAbsolute(rel);
      };
      let renamed = 0;
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
      return { ok: true, renamed };
    } catch (e: any) {
      return { ok: false, error: String(e?.message ?? e) };
    }
  });
}
