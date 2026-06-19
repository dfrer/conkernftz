import * as electron from 'electron';
import path from 'node:path';
import fs from 'node:fs/promises';
import fssync from 'node:fs';
import http from 'node:http';
import { FileManager } from '@conkernftz/storage/file-manager';
import * as cliRunner from './cli-runner.js';
import { getEngineClient } from './engine-client.js';
import type { LivePreviewResult, EffectsPreviewResult, PreviewToDiskResult } from './engine-service.js';

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

/**
 * Resolve `relativePath` inside the current project and refuse anything that escapes
 * the project root (covers `..` traversal and absolute paths). Used by the write /
 * delete handlers; read handlers intentionally allow absolute paths so projects can
 * reference layer/asset directories stored outside the project folder.
 */
function resolveInProject(relativePath: string): string | null {
  if (!projectDir) return null;
  const root = path.resolve(projectDir);
  const p = path.resolve(root, relativePath || '');
  if (p !== root && !p.startsWith(root + path.sep)) return null;
  return p;
}

export function initProjectIpc(): void {
  const baseDir = __dirname;

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
    } catch (e) {
      return { ok: false, error: String((e as Error)?.message ?? e) };
    }
  });

  electron.ipcMain.handle('foundry:readConfig', async () => {
    try {
      if (!projectDir) return { ok: false, error: 'No project selected' };
      const p = path.join(projectDir, 'foundry.config.json');
      const raw = await fs.readFile(p, 'utf8');
      return { ok: true, json: JSON.parse(raw) };
    } catch (e) {
      return { ok: false, error: String((e as Error)?.message ?? e) };
    }
  });

  electron.ipcMain.handle('foundry:readConfigAt', async (_evt, dir: string) => {
    try {
      if (!dir || typeof dir !== 'string') return { ok: false, error: 'Invalid path' };
      const p = path.join(dir, 'foundry.config.json');
      const raw = await fs.readFile(p, 'utf8');
      return { ok: true, json: JSON.parse(raw) };
    } catch (e) {
      return { ok: false, error: String((e as Error)?.message ?? e) };
    }
  });

  electron.ipcMain.handle('foundry:writeConfig', async (_evt, json: unknown) => {
    try {
      if (!projectDir) return { ok: false, error: 'No project selected' };
      const p = path.join(projectDir, 'foundry.config.json');
      await fs.writeFile(p, JSON.stringify(json, null, 2));
      return { ok: true };
    } catch (e) {
      return { ok: false, error: String((e as Error)?.message ?? e) };
    }
  });

  electron.ipcMain.handle('foundry:chooseDirInsideProject', async () => {
    try {
      if (!projectDir) return { ok: false, error: 'No project selected' };
      const res = await electron.dialog.showOpenDialog({
        title: 'Choose directory',
        defaultPath: projectDir,
        properties: ['openDirectory', 'createDirectory'],
      });
      if (res.canceled || res.filePaths.length === 0) return { ok: false, error: 'Canceled' };
      const p = res.filePaths[0] as string;
      if (!p.startsWith(projectDir)) return { ok: false, error: 'Must be inside the project directory' };
      return { ok: true, path: path.relative(projectDir, p) };
    } catch (e) {
      return { ok: false, error: String((e as Error)?.message ?? e) };
    }
  });

  electron.ipcMain.handle('foundry:readFile', async (_evt, relativePath: string) => {
    try {
      if (!projectDir) return { ok: false, error: 'No project selected' };
      const p = resolveInProject(relativePath);
      if (!p) return { ok: false, error: 'Path escapes project' };
      const content = await fs.readFile(p, 'utf8');
      return { ok: true, content };
    } catch (e) {
      return { ok: false, error: String((e as Error)?.message ?? e) };
    }
  });

  // Read a binary file under the project as base64 (for inline image/animation previews).
  electron.ipcMain.handle('foundry:readFileBase64', async (_evt, relativePath: string) => {
    try {
      if (!projectDir) return { ok: false, error: 'No project selected' };
      const p = resolveInProject(relativePath);
      if (!p) return { ok: false, error: 'Path escapes project' };
      const buf = await fs.readFile(p);
      const ext = path.extname(p).toLowerCase();
      const mime =
        ext === '.png'
          ? 'image/png'
          : ext === '.webp'
            ? 'image/webp'
            : ext === '.gif'
              ? 'image/gif'
              : ext === '.jpg' || ext === '.jpeg'
                ? 'image/jpeg'
                : ext === '.mp4'
                  ? 'video/mp4'
                  : ext === '.webm'
                    ? 'video/webm'
                    : 'application/octet-stream';
      return { ok: true, base64: buf.toString('base64'), mime };
    } catch (e) {
      return { ok: false, error: String((e as Error)?.message ?? e) };
    }
  });

  electron.ipcMain.handle('foundry:ensureDirs', async (_evt, relativePaths: string[]) => {
    try {
      if (!projectDir) return { ok: false, error: 'No project selected' };
      for (const rel of relativePaths) {
        if (!rel) continue;
        const p = resolveInProject(rel);
        if (!p) return { ok: false, error: 'Path escapes project' };
        await fs.mkdir(p, { recursive: true });
      }
      return { ok: true };
    } catch (e) {
      return { ok: false, error: String((e as Error)?.message ?? e) };
    }
  });

  electron.ipcMain.handle('foundry:listImages', async (_evt, relativePath: string) => {
    try {
      if (!relativePath) return { ok: true, count: 0 };
      // Read-only count; absolute paths allowed so absolute layer dirs work.
      const dir = path.isAbsolute(relativePath)
        ? relativePath
        : projectDir
          ? path.join(projectDir, relativePath)
          : relativePath;
      if (!fssync.existsSync(dir)) return { ok: true, count: 0 };
      const dirents = await fs.readdir(dir, { withFileTypes: true });
      const count = dirents
        .filter((d) => d.isFile())
        .map((d) => d.name.toLowerCase())
        .filter((n) => n.endsWith('.png') || n.endsWith('.webp') || n.endsWith('.gif') || n.endsWith('.svg')).length;
      return { ok: true, count };
    } catch (e) {
      return { ok: false, error: String((e as Error)?.message ?? e) };
    }
  });

  electron.ipcMain.handle('foundry:openInExplorer', async (_evt, relativePath: string) => {
    try {
      // Read-only "reveal in file manager"; absolute paths allowed (build/layer dirs).
      const dir = path.isAbsolute(relativePath || '')
        ? relativePath || ''
        : projectDir
          ? path.join(projectDir, relativePath || '')
          : relativePath || '';
      if (!fssync.existsSync(dir)) return { ok: false, error: 'Path does not exist' };
      await electron.shell.openPath(dir);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: String((e as Error)?.message ?? e) };
    }
  });

  electron.ipcMain.handle('foundry:openExternal', async (_evt, url: string) => {
    try {
      if (!url || typeof url !== 'string') return { ok: false, error: 'Invalid URL' };
      await electron.shell.openExternal(url);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: String((e as Error)?.message ?? e) };
    }
  });

  electron.ipcMain.handle('foundry:listDir', async (_evt, relativePath: string) => {
    try {
      if (!projectDir) return { ok: false, error: 'No project selected' };
      if (!fileManager) fileManager = new FileManager(projectDir);
      const entries = await fileManager.listDir(relativePath || '.');
      const items = entries.map((e) => (e.isDir ? e.name + '/' : e.name));
      return { ok: true, items };
    } catch (e) {
      return { ok: false, error: String((e as Error)?.message ?? e) };
    }
  });

  // Run CLI-based audits (shells the built CLI; chain/IO ops stay in the CLI for now).
  electron.ipcMain.handle('foundry:auditAssets', async () => {
    try {
      if (!projectDir) return { ok: false, error: 'No project selected' };
      const uiDistDir = path.resolve(baseDir, '..');
      const pkgsDir = path.resolve(uiDistDir, '../..');
      await cliRunner.ensureCliAndDepsBuilt().catch(() => {});
      const cliBin = path.join(pkgsDir, 'cli', 'dist', 'bin.js');
      if (!fssync.existsSync(cliBin)) throw new Error('CLI not built. Run build at repo root.');
      const args = ['audit', '--dir', projectDir, '--layers', 'Layers', '--empty-threshold', '99', '--json'];
      const out = await cliRunner.runNodeModule(cliBin, args, projectDir);
      if ((out.code ?? 0) !== 0 && !out.stdout) throw new Error(out.stderr || 'Audit failed');
      const payload = out.stdout && out.stdout.trim().startsWith('{') ? JSON.parse(out.stdout) : { ok: false, error: out.stderr || 'Audit failed' };
      return { ok: true, json: payload };
    } catch (e) {
      return { ok: false, error: String((e as Error)?.message || e) };
    }
  });

  electron.ipcMain.handle('foundry:auditOutputs', async () => {
    try {
      if (!projectDir) return { ok: false, error: 'No project selected' };
      const uiDistDir = path.resolve(baseDir, '..');
      const pkgsDir = path.resolve(uiDistDir, '../..');
      await cliRunner.ensureCliAndDepsBuilt().catch(() => {});
      const cliBin = path.join(pkgsDir, 'cli', 'dist', 'bin.js');
      if (!fssync.existsSync(cliBin)) throw new Error('CLI not built. Run build at repo root.');
      const args = ['dupes', '--dir', projectDir + path.sep + 'build', '--images', '--json'];
      const out = await cliRunner.runNodeModule(cliBin, args, projectDir);
      if ((out.code ?? 0) !== 0 && !out.stdout) throw new Error(out.stderr || 'Dupes failed');
      const payload = out.stdout && out.stdout.trim().startsWith('{') ? JSON.parse(out.stdout) : { ok: false, error: out.stderr || 'Dupes failed' };
      return { ok: true, json: payload };
    } catch (e) {
      return { ok: false, error: String((e as Error)?.message || e) };
    }
  });

  // Single effects preview via the engine service (CPU compositor for fidelity).
  electron.ipcMain.handle('foundry:previewEffects', async (_evt, cfgLike: Record<string, unknown>) => {
    try {
      if (!projectDir) return { ok: false, error: 'No project selected' };
      const { result } = getEngineClient().call<EffectsPreviewResult>('renderEffectsPreview', {
        projectDir,
        configLike: cfgLike,
      });
      const res = await result;
      return { ok: true, format: res.format, b64: res.b64 };
    } catch (e) {
      return { ok: false, error: String((e as Error)?.message ?? e) };
    }
  });

  // Delete a file or directory (recursive) inside the project.
  electron.ipcMain.handle('foundry:deletePath', async (_evt, relativePath: string) => {
    try {
      if (!projectDir) return { ok: false, error: 'No project selected' };
      if (!relativePath || typeof relativePath !== 'string') return { ok: false, error: 'Invalid path' };
      if (!resolveInProject(relativePath)) return { ok: false, error: 'Path escapes project' };
      if (!fileManager) fileManager = new FileManager(projectDir);
      await fileManager.deletePath(relativePath);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: String((e as Error)?.message ?? e) };
    }
  });

  electron.ipcMain.handle('foundry:renameFiles', async (_evt, pairs: { from: string; to: string }[]) => {
    try {
      if (!Array.isArray(pairs) || pairs.length === 0) return { ok: true, renamed: 0 };
      const toAbs = (p: string) => (path.isAbsolute(p) ? p : projectDir ? path.join(projectDir, p) : p);
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
    } catch (e) {
      return { ok: false, error: String((e as Error)?.message ?? e) };
    }
  });

  // Build/preview controllers for pause/resume/stop. The preview controller's flags are
  // mirrored into the engine host (which actually owns the cooperative pause/stop) via
  // engine-client.control(activePreviewId, …); the local flags drive the isPaused display.
  let buildController: { paused: boolean; stopped: boolean } | null = null;
  let previewController: { paused: boolean; stopped: boolean } | null = null;
  let activePreviewId = 0;

  electron.ipcMain.handle('foundry:pauseBuild', async () => {
    if (buildController) buildController.paused = true;
    return { ok: true };
  });
  electron.ipcMain.handle('foundry:resumeBuild', async () => {
    if (buildController) buildController.paused = false;
    return { ok: true };
  });
  electron.ipcMain.handle('foundry:stopBuild', async () => {
    if (buildController) {
      buildController.paused = false;
      buildController.stopped = true;
    }
    return { ok: true };
  });

  electron.ipcMain.handle('foundry:pausePreview', async () => {
    if (previewController) previewController.paused = true;
    if (activePreviewId) getEngineClient().control(activePreviewId, 'pause');
    return { ok: true };
  });
  electron.ipcMain.handle('foundry:resumePreview', async () => {
    if (previewController) previewController.paused = false;
    if (activePreviewId) getEngineClient().control(activePreviewId, 'resume');
    return { ok: true };
  });
  electron.ipcMain.handle('foundry:stopPreview', async () => {
    if (previewController) {
      previewController.paused = false;
      previewController.stopped = true;
    }
    if (activePreviewId) getEngineClient().control(activePreviewId, 'stop');
    return { ok: true };
  });

  // Build the full collection through the engine service.
  electron.ipcMain.handle('foundry:buildWithProgress', async (_evt, count: number) => {
    try {
      if (!projectDir) return { ok: false, error: 'No project selected' };
      buildController = { paused: false, stopped: false };
      const { result } = getEngineClient().call<{ editions: number; outDir: string }>(
        'buildCollection',
        { projectDir, count },
        {
          onProgress: (payload) => {
            const p = payload as { current: number; total: number; message?: string };
            const mainWindow = electron.BrowserWindow.getAllWindows()[0];
            if (mainWindow) {
              const progress = Math.round((p.current / p.total) * 100);
              mainWindow.webContents.send('build-progress', {
                current: p.current,
                total: p.total,
                progress,
                message: p.message || 'Building...',
                isPaused: !!(buildController && buildController.paused),
              });
            }
          },
        },
      );
      const res = await result;
      buildController = null;
      return { ok: true, stdout: `Built ${res.editions} editions to ${res.outDir}` };
    } catch (e) {
      buildController = null;
      return { ok: false, error: String((e as Error)?.message ?? e) };
    }
  });

  // Generate N previews to disk through the engine service, with pause/stop.
  electron.ipcMain.handle('foundry:previewWithProgress', async (_evt, count: number) => {
    try {
      if (!projectDir) return { ok: false, error: 'No project selected' };
      previewController = { paused: false, stopped: false };
      const { id, result } = getEngineClient().call<PreviewToDiskResult>(
        'renderPreviewsToDisk',
        { projectDir, count },
        {
          onProgress: (payload) => {
            const p = payload as { current: number; total: number; message: string };
            const mainWindow = electron.BrowserWindow.getAllWindows()[0];
            if (mainWindow) {
              mainWindow.webContents.send('preview-progress', {
                current: p.current,
                total: p.total,
                progress: Math.round((p.current / p.total) * 100),
                message: p.message,
                isPaused: !!(previewController && previewController.paused),
              });
            }
          },
        },
      );
      activePreviewId = id;
      const res = await result;
      previewController = null;
      activePreviewId = 0;
      if (res.stopped) return { ok: false, error: 'Preview stopped by user' };
      return { ok: true, stdout: `Wrote ${res.written} previews to ${res.outDir}` };
    } catch (e) {
      previewController = null;
      activePreviewId = 0;
      return { ok: false, error: String((e as Error)?.message ?? e) };
    }
  });

  // Live previews returned as base64 (no disk writes).
  electron.ipcMain.handle(
    'foundry:previewLive',
    async (_evt, cfgLike: Record<string, unknown>, count = 4, seed = 'ui-live') => {
      try {
        if (!projectDir) return { ok: false, error: 'No project selected' };
        const { result } = getEngineClient().call<LivePreviewResult>('renderLivePreviews', {
          projectDir,
          configLike: cfgLike,
          count,
          seed,
        });
        const res = await result;
        return { ok: true, format: res.format, images: res.images };
      } catch (e) {
        return { ok: false, error: String((e as Error)?.message ?? e) };
      }
    },
  );

  // Generate the deployable static mint site: copy the prebuilt template (dist/site-template)
  // into <project>/site-export, drop the renderer-supplied site-data.js bundle beside it, and
  // wire it into index.html. The renderer owns the (tested) bundle/script generation; this
  // handler is just the file writer.
  electron.ipcMain.handle('foundry:exportSite', async (_evt, payload: { dataJs?: string; dataFile?: string }) => {
    try {
      if (!projectDir) return { ok: false, error: 'No project selected' };
      const dataFile = typeof payload?.dataFile === 'string' && payload.dataFile ? payload.dataFile : 'site-data.js';
      const dataJs = typeof payload?.dataJs === 'string' ? payload.dataJs : 'window.__CONKER_SITE__ = {};';
      const templateDir = path.resolve(baseDir, '..', 'site-template');
      if (!fssync.existsSync(path.join(templateDir, 'index.html'))) {
        return { ok: false, error: 'Site template not built — run the app build first.' };
      }
      const outDir = path.join(projectDir, 'site-export');
      await fs.rm(outDir, { recursive: true, force: true });
      await fs.cp(templateDir, outDir, { recursive: true });
      await fs.writeFile(path.join(outDir, dataFile), dataJs, 'utf8');
      const indexPath = path.join(outDir, 'index.html');
      let html = await fs.readFile(indexPath, 'utf8');
      const tag = `<script src="./${dataFile}"></script>`;
      if (!html.includes(tag)) {
        const i = html.indexOf('<script type="module"');
        html = i >= 0 ? `${html.slice(0, i)}${tag}\n    ${html.slice(i)}` : html.replace('</head>', `  ${tag}\n  </head>`);
        await fs.writeFile(indexPath, html, 'utf8');
      }
      return { ok: true, outDir };
    } catch (e) {
      return { ok: false, error: String((e as Error)?.message ?? e) };
    }
  });

  // Local preview: serve <project>/site-export over http://127.0.0.1 and open it. http (not
  // file://) means the SPA, iframes, and fonts all behave like a real host — no file:// origin
  // restrictions. Localhost-only, with a path-traversal guard; SPA-fallback to index.html.
  let previewServer: http.Server | null = null;
  const MIME: Record<string, string> = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.map': 'application/json',
  };
  electron.ipcMain.handle('foundry:previewSite', async () => {
    try {
      if (!projectDir) return { ok: false, error: 'No project selected' };
      const dir = path.join(projectDir, 'site-export');
      if (!fssync.existsSync(path.join(dir, 'index.html'))) {
        return { ok: false, error: 'No generated site found — run “Generate site” first.' };
      }
      if (previewServer) {
        previewServer.close();
        previewServer = null;
      }
      const server = http.createServer((req, res) => {
        try {
          const urlPath = decodeURIComponent((req.url || '/').split('?')[0]!);
          const rel = urlPath === '/' ? 'index.html' : urlPath.replace(/^\/+/, '');
          let filePath = path.join(dir, rel);
          if (filePath !== dir && !filePath.startsWith(dir + path.sep)) {
            res.statusCode = 403;
            res.end('forbidden');
            return;
          }
          if (!fssync.existsSync(filePath) || fssync.statSync(filePath).isDirectory()) {
            filePath = path.join(dir, 'index.html');
          }
          res.setHeader('Content-Type', MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream');
          fssync.createReadStream(filePath).pipe(res);
        } catch {
          res.statusCode = 500;
          res.end('error');
        }
      });
      await new Promise<void>((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', () => resolve());
      });
      previewServer = server;
      const addr = server.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      const url = `http://127.0.0.1:${port}/`;
      await electron.shell.openExternal(url);
      return { ok: true, url };
    } catch (e) {
      return { ok: false, error: String((e as Error)?.message ?? e) };
    }
  });

  // Save arbitrary JSON inside the project (constrained to the project root).
  electron.ipcMain.handle('foundry:saveJson', async (_evt, relativePath: string, json: unknown) => {
    try {
      if (!projectDir) return { ok: false, error: 'No project selected' };
      if (typeof relativePath !== 'string' || !relativePath) return { ok: false, error: 'Invalid path' };
      const p = resolveInProject(relativePath);
      if (!p) return { ok: false, error: 'Path escapes project' };
      await fs.mkdir(path.dirname(p), { recursive: true });
      await fs.writeFile(p, JSON.stringify(json, null, 2), 'utf8');
      return { ok: true, path: p };
    } catch (e) {
      return { ok: false, error: String((e as Error)?.message || e) };
    }
  });
}
