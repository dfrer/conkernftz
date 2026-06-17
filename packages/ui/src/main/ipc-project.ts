import * as electron from 'electron';
import path from 'path';
import { pathToFileURL } from 'url';
import { createRequire } from 'module';
import fs from 'node:fs/promises';
import fssync from 'node:fs';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { FileManager } from '@conkernftz/storage/file-manager';
import * as cliRunner from './cli-runner.js';

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

  // Run CLI-based audits
  electron.ipcMain.handle('foundry:auditAssets', async (_evt, opts: any) => {
    try {
      if (!projectDir) return { ok: false, error: 'No project selected' };
      const uiDistDir = path.resolve(baseDir, '..');
      const pkgsDir = path.resolve(uiDistDir, '../..');
      // Ensure CLI is built and dependencies present
      await cliRunner.ensureCliAndDepsBuilt().catch(() => {});
      const cliBin = path.join(pkgsDir, 'cli', 'dist', 'bin.js');
      if (!fssync.existsSync(cliBin)) {
        throw new Error('CLI not built. Run build at repo root.');
      }
      const args = ['audit', '--dir', projectDir, '--layers', 'Layers', '--empty-threshold', '99', '--json'];
      const out = await cliRunner.runNodeModule(cliBin, args, projectDir);
      if ((out.code ?? 0) !== 0 && !out.stdout) throw new Error(out.stderr || 'Audit failed');
      const payload = out.stdout && out.stdout.trim().startsWith('{') ? JSON.parse(out.stdout) : { ok: false, error: out.stderr || 'Audit failed' };
      return { ok: true, json: payload };
    } catch (e: any) {
      return { ok: false, error: String(e?.message || e) };
    }
  });

  electron.ipcMain.handle('foundry:auditOutputs', async (_evt, opts: any) => {
    try {
      if (!projectDir) return { ok: false, error: 'No project selected' };
      const uiDistDir = path.resolve(baseDir, '..');
      const pkgsDir = path.resolve(uiDistDir, '../..');
      await cliRunner.ensureCliAndDepsBuilt().catch(() => {});
      const cliBin = path.join(pkgsDir, 'cli', 'dist', 'bin.js');
      if (!fssync.existsSync(cliBin)) {
        throw new Error('CLI not built. Run build at repo root.');
      }
      const args = ['dupes', '--dir', projectDir + path.sep + 'build', '--images', '--json'];
      const out = await cliRunner.runNodeModule(cliBin, args, projectDir);
      if ((out.code ?? 0) !== 0 && !out.stdout) throw new Error(out.stderr || 'Dupes failed');
      const payload = out.stdout && out.stdout.trim().startsWith('{') ? JSON.parse(out.stdout) : { ok: false, error: out.stderr || 'Dupes failed' };
      return { ok: true, json: payload };
    } catch (e: any) {
      return { ok: false, error: String(e?.message || e) };
    }
  });

  electron.ipcMain.handle('foundry:previewEffects', async (_evt, cfgLike: any) => {
    try {
      if (!projectDir) return { ok: false, error: 'No project selected' };
      const uiDistDir = __dirname;
      const pkgsDir = path.resolve(uiDistDir, '../..');
      const coreBase = path.join(pkgsDir, 'core', 'dist');
      await ensureCoreBuilt(pkgsDir).catch(() => {});
      const { compositeLayers } = await dynamicImportCore(coreBase, 'compositor.js');

      // Base config
      let cfg: any;
      try {
        const raw = await fs.readFile(path.join(projectDir, 'foundry.config.json'), 'utf8');
        cfg = JSON.parse(raw);
      } catch { cfg = {}; }
      const effective = Object.assign({}, cfg, cfgLike || {});
      effective.image = Object.assign({}, cfg.image || {}, (cfgLike && cfgLike.image) || {});
      // For live preview, force CPU compositor to guarantee advanced blend/effects fidelity
      effective.experimental = Object.assign({}, cfg.experimental || {}, (cfgLike && (cfgLike as any).experimental) || {});
      effective.experimental.compositor = Object.assign({}, (cfg.experimental && (cfg.experimental as any).compositor) || {}, (cfgLike && (cfgLike as any).experimental && (cfgLike as any).experimental.compositor) || {}, { forceCpu: true });
      const width = Number(effective.image?.width || 1024);
      const height = Number(effective.image?.height || 1024);
      const background = effective.image?.background || 'transparent';
      const layers = Array.isArray((cfgLike && cfgLike.layers) || cfg.layers) ? ((cfgLike && cfgLike.layers) || cfg.layers) : [];

      const inputs: any[] = [];
      for (const layer of layers) {
        if (!layer || !layer.path) continue;
        const dir = path.isAbsolute(layer.path) ? layer.path : path.join(projectDir, layer.path);
        let chosen: string | null = null;
        try {
          const dirents = await fs.readdir(dir, { withFileTypes: true });
          const files = dirents.filter((d) => d.isFile()).map((d) => d.name).filter((n) => /\.(png|webp|gif)$/i.test(n)).sort();
          if (files.length > 0) chosen = path.join(dir, files[0]!);
        } catch {}
        if (!chosen) continue;
        inputs.push({
          path: chosen,
          blend: layer.blend || (layer.effects && layer.effects.blend) || 'normal',
          opacity: (typeof layer.opacity === 'number' ? layer.opacity : undefined) ?? (layer.effects ? layer.effects.opacity : undefined) ?? 1,
          offsetX: (layer.effects && layer.effects.offsetX) || 0,
          offsetY: (layer.effects && layer.effects.offsetY) || 0,
          effects: layer.effects || undefined,
        });
      }

      if (inputs.length === 0) return { ok: false, error: 'No assets found to preview' };
      const outFormat: 'png' | 'webp' = (effective.export?.imageFormat === 'webp' ? 'webp' : 'png');
      const buffer: Buffer = await compositeLayers(inputs, {
        width,
        height,
        background,
        format: outFormat,
        superSample: Number(effective?.experimental?.compositor?.superSample || 1) || 1,
        forceCpu: !!(effective?.experimental?.compositor?.forceCpu),
      });
      return { ok: true, format: outFormat, b64: buffer.toString('base64') };
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

  // Build controller for pause/resume/stop
  let buildController: { paused: boolean; stopped: boolean } | null = null;
  let previewController: { paused: boolean; stopped: boolean } | null = null;

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
    return { ok: true };
  });
  electron.ipcMain.handle('foundry:resumePreview', async () => {
    if (previewController) previewController.paused = false;
    return { ok: true };
  });
  electron.ipcMain.handle('foundry:stopPreview', async () => {
    if (previewController) {
      previewController.paused = false;
      previewController.stopped = true;
    }
    return { ok: true };
  });

  // Generate N live previews using current config + generator without writing to disk
  electron.ipcMain.handle('foundry:buildWithProgress', async (_evt, count: number) => {
    try {
      if (!projectDir) return { ok: false, error: 'No project selected' };
      buildController = { paused: false, stopped: false };
      
      // Import core modules (ensure built and resolve paths robustly)
      const uiDistDir = path.resolve(baseDir, '..');
      const pkgsDir = path.resolve(uiDistDir, '../..');
      await ensureCoreBuilt(pkgsDir);
      const coreBase = path.join(pkgsDir, 'core', 'dist');
      // Verify core dist exists before importing
      const requiredFiles = ['project-config.js','catalog.js','generator.js','compositor.js','dna.js','preview.js'];
      for (const f of requiredFiles) {
        const p = path.join(coreBase, f);
        if (!fssync.existsSync(p)) {
          throw new Error(`Core build not found: missing ${p}. Try running workspace build (e.g., pnpm -w build) and reopen the app.`);
        }
      }
      const { ProjectConfigSchema } = await importCore(coreBase, 'project-config.js');
      const { buildCollection } = await importCore(coreBase, 'project-build.js');

      // Load config
      const cfgPath = path.join(projectDir, 'foundry.config.json');
      const raw = await fs.readFile(cfgPath, 'utf8');
      let cfg: any;
      try {
        cfg = ProjectConfigSchema.parse(JSON.parse(raw));
      } catch (e: any) {
        throw new Error('Invalid foundry.config.json: ' + String(e?.message || e));
      }

      const runSeed = `build:${Date.now().toString(36)}:${Math.floor(Math.random()*1e9).toString(36)}`;
      // Optionally use chain adapter for JSON building when target is solana
      let buildJson: ((input: any) => Record<string, unknown>) | undefined;
      try {
        if (cfg.chain?.target === 'solana') {
          // Resolve adapter from workspace dist
          const chainBase = path.join(pkgsDir, 'chain-solana', 'dist');
          const { SolanaJsonAdapter } = await importCore(chainBase, 'index.js');
          buildJson = (input: any) => SolanaJsonAdapter.buildOffchainJson(input);
        }
      } catch {}

      const res = await buildCollection(
        { cwd: projectDir, config: cfg, count, seed: runSeed, maxAttemptsPerEdition: 500, buildJson },
        {
          onProgress: (p: { current: number; total: number; message?: string }) => {
            // Pause control between batches
            (async () => {
              while (buildController && buildController.paused && !buildController.stopped) {
                await new Promise((r) => setTimeout(r, 100));
              }
            })();
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
      buildController = null;
      return { ok: true, stdout: `Built ${res.editions.length} editions to ${res.outDir}` };
    } catch (e: any) {
      buildController = null;
      return { ok: false, error: String(e?.message ?? e) };
    }
  });

  // Preview with progress, pause/resume/stop
  electron.ipcMain.handle('foundry:previewWithProgress', async (_evt, count: number) => {
    try {
      if (!projectDir) return { ok: false, error: 'No project selected' };
      previewController = { paused: false, stopped: false };

      // Resolve and ensure core built
      const uiDistDir = path.resolve(baseDir, '..');
      const pkgsDir = path.resolve(uiDistDir, '../..');
      await ensureCoreBuilt(pkgsDir);
      const coreBase = path.join(pkgsDir, 'core', 'dist');
      const { ProjectConfigSchema } = await importCore(coreBase, 'project-config.js');
      const { loadLayerCatalog } = await importCore(coreBase, 'catalog.js');
      const { generateEditionsConstrained } = await importCore(coreBase, 'generator.js');
      const { compositeLayers } = await importCore(coreBase, 'compositor.js');
      const { makeContactSheet } = await importCore(coreBase, 'preview.js');
      const { loadSpawnMapFile } = await importCore(coreBase, 'spawn.js');
      const { placeAsset, resolveCandidateDots } = await importCore(coreBase, 'placement.js');
      const { createSeededRng } = await importCore(coreBase, 'rng.js');
      const { applyTransformRules } = await importCore(coreBase, 'transforms.js');

      // Load and validate config
      let cfg: any;
      try {
        const raw = await fs.readFile(path.join(projectDir, 'foundry.config.json'), 'utf8');
        cfg = ProjectConfigSchema.parse(JSON.parse(raw));
      } catch (e: any) {
        throw new Error('Invalid foundry.config.json: ' + String(e?.message || e));
      }

      // Determine preview out dir (mirror CLI behavior)
      function normalizeOutDir(p: string): string {
        const trimmed = p.replace(/[\\/]+$/, '');
        if (/([\\/])(preview|previews)$/i.test(trimmed)) return trimmed;
        return path.join(trimmed, 'preview');
      }
      const previewBaseRaw = cfg.export?.previewOutDir ? normalizeOutDir(cfg.export.previewOutDir) : normalizeOutDir(cfg.export.outDir);
      const outBase = path.isAbsolute(previewBaseRaw) ? previewBaseRaw : path.join(projectDir, previewBaseRaw);
      const outDir = path.resolve(outBase);
      await fs.mkdir(outDir, { recursive: true });

      // Clear previous previews
      try {
        const dirents = await fs.readdir(outDir, { withFileTypes: true });
        await Promise.all(dirents.filter(d => d.isFile()).map(d => fs.unlink(path.join(outDir, d.name)).catch(() => {})));
      } catch {}

      // Load catalog
      let catalog;
      try {
        catalog = await loadLayerCatalog(projectDir, cfg.layers, {
          mode: 'filenameDelimiter',
          delimiter: cfg.rarity.delimiter,
          defaultWeight: cfg.rarity.defaultWeight,
        });
      } catch (e: any) {
        throw new Error('Failed to load layer catalog: ' + String(e?.message || e));
      }

      // Generate editions; allow duplicates fallback like CLI
      const total = Math.max(1, Number(count) || 10);
      let editions: any[];
      const runSeed = `preview:${Date.now().toString(36)}:${Math.floor(Math.random()*1e9).toString(36)}`;
      const constraints = (allowDupes: boolean) => ({ rules: cfg.rules ?? {}, uniqueness: allowDupes ? undefined : cfg.uniqueness, maxAttemptsPerEdition: 500 });
      try {
        editions = generateEditionsConstrained(catalog, total, { seed: runSeed }, constraints(false));
      } catch (_e) {
        editions = generateEditionsConstrained(catalog, total, { seed: runSeed }, constraints(true));
      }

      const mainWindow = electron.BrowserWindow.getAllWindows()[0];
      let idx = 0;
      const written: string[] = [];
      const spawnMap = await loadSpawnMapFile(projectDir, cfg?.spawn?.mapPath);
      const spawnFit = (spawnMap?.rules?.fitMode ?? cfg?.spawn?.fitMode ?? 'contain') as any;
      for (const ed of editions) {
        // Pause/stop control
        while (previewController && previewController.paused && !previewController.stopped) {
          await new Promise(r => setTimeout(r, 100));
        }
        if (previewController && previewController.stopped) {
          previewController = null;
          return { ok: false, error: 'Preview stopped by user' };
        }

        idx++;
        const outFormat: 'png' | 'webp' = (cfg.export?.imageFormat === 'webp' ? 'webp' : 'png');
        // Optional experimental shuffle of layer order per edition
        const picks = Array.from(ed.picks);
        try {
          if (cfg?.experimental?.generation?.shuffleLayers) {
            for (let i = picks.length - 1; i > 0; i--) {
              const j = Math.floor(Math.random() * (i + 1));
              const tmp = picks[i]; picks[i] = picks[j]; picks[j] = tmp;
            }
          }
        } catch {}
        let placedOffsets: Array<{ offX: number; offY: number }> = [];
        if (spawnMap) {
          const rng = createSeededRng(`${runSeed}:prev:${idx}`);
          const occupied: Array<{ x: number; y: number; w: number; h: number }> = [];
          const mapper = { authorWidth: spawnMap.authoringSize.width, authorHeight: spawnMap.authoringSize.height, outWidth: cfg.image.width, outHeight: cfg.image.height, fitMode: spawnFit } as any;
          placedOffsets = picks.map((p: any, k: number) => {
            const layer = String(p.layer || p.option?.value || `L${k}`);
            const assetKey = `${layer}:${p.option.value}`;
            const candidates = resolveCandidateDots(spawnMap, layer, assetKey);
            const assetSize = { width: cfg.image.width, height: cfg.image.height };
            const pol = spawnMap.rules?.selection ?? 'weighted';
            const jitterDef = spawnMap.rules?.jitter?.defaultRadiusPx ?? 0;
            const coll = spawnMap.rules?.collision;
            const result = placeAsset({
              globalSeed: `${runSeed}:${idx}:${layer}:${p.option.value}`,
              layerName: layer,
              assetKey,
              candidateDots: candidates,
              policy: pol,
              jitterDefaultPx: jitterDef,
              collision: coll ? { enabled: !!coll.enabled, paddingPx: Math.max(0, coll.paddingPx ?? 0), strategy: (coll.strategy ?? 'retry'), maxAttempts: Math.max(1, coll.maxAttemptsPerAsset ?? 10) } : undefined,
              mapper,
              asset: assetSize,
              anchor: (spawnMap.rules?.anchor ?? 'center'),
              occupiedBoxes: occupied,
              rng,
            });
            const offX = Math.round(result.x);
            const offY = Math.round(result.y);
            occupied.push({ x: result.x, y: result.y, w: result.w, h: result.h });
            return { offX, offY };
          });
        }

        // Apply transform rules to mirror build pipeline
        const layerStates = picks.map((p: any, k: number) => {
          const baseOffsetX = placedOffsets[k]?.offX ?? (p.option.offsetX ?? p.option.effects?.offsetX ?? 0);
          const baseOffsetY = placedOffsets[k]?.offY ?? (p.option.offsetY ?? p.option.effects?.offsetY ?? 0);
          const baseRotate = p.option.effects?.rotate;
          const baseScale = p.option.effects?.scale;
          return {
            index: k,
            layer: String(p.layer),
            value: String(p.option.value),
            filename: path.basename(p.option.filePath),
            baseOffsetX,
            baseOffsetY,
            baseRotate,
            baseScale,
          };
        });
        const appliedTransforms = applyTransformRules(cfg.rules?.transforms, layerStates, ed.traits);
        function cloneResolvedEffects(e?: any): any {
          if (!e) return undefined;
          return {
            blend: e.blend,
            opacity: e.opacity,
            offsetX: e.offsetX,
            offsetY: e.offsetY,
            rotate: e.rotate,
            scale: e.scale,
            glow: e.glow ? { ...e.glow } : undefined,
            stroke: e.stroke ? { ...e.stroke } : undefined,
            shadow: e.shadow ? { ...e.shadow } : undefined,
            extrude: e.extrude ? { ...e.extrude } : undefined,
            blur: e.blur,
            modulate: e.modulate ? { ...e.modulate } : undefined,
            colorOverlay: e.colorOverlay ? { ...e.colorOverlay } : undefined,
          };
        }
        const buf = await compositeLayers(
          picks.map((p: any, k: number) => {
            const state = layerStates[k]!;
            const applied = appliedTransforms.get(k) as any;
            const finalOffsetX = applied?.offsetX ?? state.baseOffsetX;
            const finalOffsetY = applied?.offsetY ?? state.baseOffsetY;
            const finalRotate = applied?.rotate ?? state.baseRotate;
            const finalScale = applied?.scale ?? state.baseScale;
            let effects: any | undefined = cloneResolvedEffects(p.option.effects);
            if (!effects && (finalRotate !== undefined || finalScale !== undefined)) {
              effects = {};
            }
            if (effects) {
              if (finalRotate !== undefined) effects.rotate = finalRotate; else if (state.baseRotate === undefined) delete effects.rotate;
              if (finalScale !== undefined) effects.scale = finalScale; else if (state.baseScale === undefined) delete effects.scale;
              if ('offsetX' in effects) delete effects.offsetX;
              if ('offsetY' in effects) delete effects.offsetY;
            }
            return {
              path: p.option.filePath,
              blend: p.option.blend ?? p.option.effects?.blend ?? 'normal',
              opacity: p.option.opacity ?? p.option.effects?.opacity ?? 1,
              offsetX: finalOffsetX,
              offsetY: finalOffsetY,
              effects,
            };
          }),
          {
            width: cfg.image.width,
            height: cfg.image.height,
            background: cfg.image.background,
            format: outFormat,
            superSample: Number(cfg?.experimental?.compositor?.superSample || 1) || 1,
            forceCpu: !!(cfg?.experimental?.compositor?.forceCpu),
          },
        );
        const filePath = path.join(outDir, `preview_${idx}.${outFormat}`);
        await fs.writeFile(filePath, buf);
        written.push(filePath);

        // send progress
        if (mainWindow) {
          mainWindow.webContents.send('preview-progress', {
            current: idx,
            total,
            progress: Math.round((idx / total) * 100),
            message: `Generating preview ${idx}/${total}`,
            isPaused: !!(previewController && previewController.paused),
          });
        }
      }

      // Optional contact sheet (quick, no progress changes)
      try {
        if (cfg.export?.includePreviewContactSheet) {
          const sheet = await makeContactSheet(written, { width: 256, height: 256 }, { columns: 5, gap: 8 });
          await fs.writeFile(path.join(outDir, 'contact-sheet.png'), sheet);
        }
      } catch {}

      previewController = null;
      return { ok: true, stdout: `Wrote ${written.length} previews to ${outDir}` };
    } catch (e: any) {
      previewController = null;
      return { ok: false, error: String(e?.message || e) };
    }
  });

  electron.ipcMain.handle('foundry:previewLive', async (_evt, cfgLike: any, count: number = 4, seed: string = 'ui-live') => {
    try {
      if (!projectDir) return { ok: false, error: 'No project selected' };
      const uiDistDir = __dirname;
      const pkgsDir = path.resolve(uiDistDir, '../..');
      const coreBase = path.join(pkgsDir, 'core', 'dist');
      // Ensure core is built and deps present; try to self-heal when possible
      await ensureCoreBuilt(pkgsDir);
      const { loadLayerCatalog } = await dynamicImportCore(coreBase, 'catalog.js');
      const { generateEditionsConstrained } = await dynamicImportCore(coreBase, 'generator.js');
      const { compositeLayers } = await dynamicImportCore(coreBase, 'compositor.js');
      const { loadSpawnMapFile } = await dynamicImportCore(coreBase, 'spawn.js');
      const { placeAsset, resolveCandidateDots } = await dynamicImportCore(coreBase, 'placement.js');
      const { createSeededRng } = await dynamicImportCore(coreBase, 'rng.js');
      const { renderPreviewEdition } = await dynamicImportCore(coreBase, 'preview.js');

      let cfg: any;
      try {
        const raw = await fs.readFile(path.join(projectDir, 'foundry.config.json'), 'utf8');
        cfg = JSON.parse(raw);
      } catch { cfg = {}; }
      const effective = Object.assign({}, cfg, cfgLike || {});
      effective.image = Object.assign({}, cfg.image || {}, (cfgLike && cfgLike.image) || {});

      function mergeEffects(base: any, over: any): any {
        if (!base && !over) return undefined;
        const a = base || {};
        const b = over || {};
        const out: any = {};
        if (a.blend !== undefined || b.blend !== undefined) out.blend = (b.blend !== undefined ? b.blend : a.blend);
        if (a.opacity !== undefined || b.opacity !== undefined) out.opacity = (b.opacity !== undefined ? b.opacity : a.opacity);
        if (a.offsetX !== undefined || b.offsetX !== undefined) out.offsetX = (b.offsetX !== undefined ? b.offsetX : a.offsetX);
        if (a.offsetY !== undefined || b.offsetY !== undefined) out.offsetY = (b.offsetY !== undefined ? b.offsetY : a.offsetY);
        if (a.rotate !== undefined || b.rotate !== undefined) out.rotate = (b.rotate !== undefined ? b.rotate : a.rotate);
        if (a.scale !== undefined || b.scale !== undefined) out.scale = (b.scale !== undefined ? b.scale : a.scale);
        // Nested
        if (a.glow || b.glow) out.glow = { ...(a.glow || {}), ...(b.glow || {}) };
        if (a.shadow || b.shadow) out.shadow = { ...(a.shadow || {}), ...(b.shadow || {}) };
        if (a.stroke || b.stroke) out.stroke = { ...(a.stroke || {}), ...(b.stroke || {}) };
        if (a.extrude || b.extrude) out.extrude = { ...(a.extrude || {}), ...(b.extrude || {}) };
        if (a.modulate || b.modulate) out.modulate = { ...(a.modulate || {}), ...(b.modulate || {}) };
        if (a.colorOverlay || b.colorOverlay) out.colorOverlay = { ...(a.colorOverlay || {}), ...(b.colorOverlay || {}) };
        return out;
      }

      function mergeLayers(baseLayers: any[], uiLayers?: any[]): any[] {
        if (!Array.isArray(uiLayers) || uiLayers.length === 0) return Array.isArray(baseLayers) ? baseLayers : [];
        const map = new Map<string, any>();
        for (const l of Array.isArray(baseLayers) ? baseLayers : []) {
          if (!l || typeof l !== 'object') continue;
          map.set(String(l.name || l.path || map.size), { ...l });
        }
        for (const u of uiLayers) {
          if (!u || typeof u !== 'object') continue;
          const key = String(u.name || u.path || ('idx:' + map.size));
          const base = map.get(key) || {};
          const merged: any = { ...base, ...u };
          // Deep merge effects if both present
          if (base.effects || u.effects) merged.effects = mergeEffects(base.effects, u.effects);
          map.set(key, merged);
        }
        return Array.from(map.values());
      }

      effective.layers = mergeLayers(cfg.layers || [], (cfgLike && cfgLike.layers) || []);
      const width = Number(effective.image?.width || 1024);
      const height = Number(effective.image?.height || 1024);
      const background = effective.image?.background || 'transparent';
      const delimiter = (effective.rarity && effective.rarity.delimiter) || '#';
      const defaultWeight = (effective.rarity && effective.rarity.defaultWeight) || 1;
      const outFormat: 'png' | 'webp' = (effective.export?.imageFormat === 'webp' ? 'webp' : 'png');

      const howMany = Math.max(1, Math.min(12, Number(count) || 4));
      const liveSeed = (!seed || seed === 'random')
        ? `ui-live:${Date.now().toString(36)}:${Math.floor(Math.random()*1e9).toString(36)}`
        : seed;

      // Primary: unified core preview
      try {
        if (typeof renderPreviewEdition === 'function') {
          const bufs = await renderPreviewEdition(projectDir, effective as any, liveSeed, howMany);
          if (Array.isArray(bufs) && bufs.length) {
            return { ok: true, format: outFormat, images: bufs.map((b: Buffer) => b.toString('base64')) };
          }
        }
      } catch (_e) { /* fall back below */ }

      // Fallback: inline compose (pre-unification path)
      const catalog = await loadLayerCatalog(projectDir, effective.layers, {
        mode: 'filenameDelimiter',
        delimiter,
        defaultWeight,
      });
      const editions = generateEditionsConstrained(
        catalog,
        howMany,
        { seed: liveSeed },
        { rules: effective.rules ?? {}, uniqueness: undefined, maxAttemptsPerEdition: 50 },
      );
      const out: string[] = [];
      const spawnMap = await loadSpawnMapFile(projectDir, effective?.spawn?.mapPath);
      const spawnFit = (spawnMap?.rules?.fitMode ?? effective?.spawn?.fitMode ?? 'contain') as any;
      let seq = 0;
      for (const ed of editions) {
        const picks = Array.from(ed.picks);
        try {
          if (effective?.experimental?.generation?.shuffleLayers) {
            for (let i = picks.length - 1; i > 0; i--) {
              const j = Math.floor(Math.random() * (i + 1));
              const tmp = picks[i]; picks[i] = picks[j]; picks[j] = tmp;
            }
          }
        } catch {}
        let placedOffsets: Array<{ offX: number; offY: number }> = [];
        if (spawnMap) {
          const rng = createSeededRng(`${liveSeed}:ui:${seq++}`);
          const occupied: Array<{ x: number; y: number; w: number; h: number }> = [];
          const mapper = { authorWidth: spawnMap.authoringSize.width, authorHeight: spawnMap.authoringSize.height, outWidth: width, outHeight: height, fitMode: spawnFit } as any;
          placedOffsets = picks.map((p: any, k: number) => {
            const layer = String(p.layer || p.option?.value || `L${k}`);
            const assetKey = `${layer}:${p.option.value}`;
            const candidates = resolveCandidateDots(spawnMap, layer, assetKey);
            const assetSize = { width, height };
            const pol = spawnMap.rules?.selection ?? 'weighted';
            const jitterDef = spawnMap.rules?.jitter?.defaultRadiusPx ?? 0;
            const coll = spawnMap.rules?.collision;
            const result = placeAsset({
              globalSeed: `${liveSeed}:${layer}:${p.option.value}`,
              layerName: layer,
              assetKey,
              candidateDots: candidates,
              policy: pol,
              jitterDefaultPx: jitterDef,
              collision: coll ? { enabled: !!coll.enabled, paddingPx: Math.max(0, coll.paddingPx ?? 0), strategy: (coll.strategy ?? 'retry'), maxAttempts: Math.max(1, coll.maxAttemptsPerAsset ?? 10) } : undefined,
              mapper,
              asset: assetSize,
              anchor: (spawnMap.rules?.anchor ?? 'center'),
              occupiedBoxes: occupied,
              rng,
            });
            const offX = Math.round(result.x);
            const offY = Math.round(result.y);
            occupied.push({ x: result.x, y: result.y, w: result.w, h: result.h });
            return { offX, offY };
          });
        }

        const buf = await compositeLayers(
          picks.map((p: any, k: number) => ({
            path: p.option.filePath,
            blend: p.option.blend ?? p.option.effects?.blend ?? 'normal',
            opacity: p.option.opacity ?? p.option.effects?.opacity ?? 1,
            offsetX: (placedOffsets[k]?.offX ?? (p.option.offsetX ?? p.option.effects?.offsetX ?? 0)),
            offsetY: (placedOffsets[k]?.offY ?? (p.option.offsetY ?? p.option.effects?.offsetY ?? 0)),
            effects: p.option.effects,
          })),
          {
            width,
            height,
            background,
            format: outFormat,
            superSample: Number(effective?.experimental?.compositor?.superSample || 1) || 1,
            forceCpu: !!(effective?.experimental?.compositor?.forceCpu),
          },
        );
        out.push(buf.toString('base64'));
      }
      return { ok: true, format: outFormat, images: out };
    } catch (e: any) {
      return { ok: false, error: String(e?.message ?? e) };
    }
  });

  // Save arbitrary JSON file relative to project root
  electron.ipcMain.handle('foundry:saveJson', async (_evt, relativePath: string, json: any) => {
    try {
      if (!projectDir) return { ok: false, error: 'No project selected' };
      if (typeof relativePath !== 'string' || !relativePath) return { ok: false, error: 'Invalid path' };
      const p = path.isAbsolute(relativePath) ? relativePath : path.join(projectDir, relativePath);
      await fs.mkdir(path.dirname(p), { recursive: true });
      await fs.writeFile(p, JSON.stringify(json, null, 2), 'utf8');
      return { ok: true, path: p };
    } catch (e: any) {
      return { ok: false, error: String(e?.message || e) };
    }
  });
}

// --- helpers: ensure core build and recover missing deps ---
const execFileAsync = promisify(execFile);
async function runPnpm(args: string[], cwd: string): Promise<void> {
  const pnpmCmd = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
  const corepackCmd = process.platform === 'win32' ? 'corepack.cmd' : 'corepack';
  try {
    await execFileAsync(pnpmCmd, args, { cwd });
  } catch (e: any) {
    if (e && (e.code === 'ENOENT' || /not recognized|not found/i.test(String(e.message || '')))) {
      await execFileAsync(corepackCmd, ['pnpm', ...args], { cwd });
      return;
    }
    throw e;
  }
}

async function ensureCoreBuilt(pkgsDir: string): Promise<void> {
  const coreDist = path.join(pkgsDir, 'core', 'dist', 'index.js');
  if (fssync.existsSync(coreDist)) return;
  const repoRoot = path.resolve(pkgsDir, '..');
  const coreDir = path.join(pkgsDir, 'core');
  try {
    await runPnpm(['-C', coreDir, 'build'], repoRoot);
  } catch (_e1) {
    try {
      await runPnpm(['install'], repoRoot);
      await runPnpm(['-C', coreDir, 'build'], repoRoot);
    } catch (_e2) {
      // Last attempt: try building from packages workspace if available
      try { await runPnpm(['-C', pkgsDir, 'build'], repoRoot); } catch {}
    }
  }
}

async function dynamicImportCore(coreBase: string, file: string): Promise<any> {
  const filePath = path.join(coreBase, file);
  const spec = pathToFileURL(filePath).href;
  try {
    if (!fssync.existsSync(filePath)) {
      throw new Error(`Missing core module at ${filePath}`);
    }
    return await import(spec);
  } catch (e: any) {
    const msg = String(e?.message || e);
    const needsBuild = /Cannot find module|ERR_MODULE_NOT_FOUND|Missing core module/i.test(msg);
    const sharpMissing = /Cannot find module 'sharp'|node_modules[\\/].*sharp/i.test(msg);
    const repoRoot = path.resolve(coreBase, '../../..');
    if (sharpMissing || needsBuild) {
      try { await runPnpm(['install'], repoRoot); } catch {}
      try { await runPnpm(['-C', path.join(path.dirname(coreBase), 'core'), 'build'], repoRoot); } catch {}
      if (!fssync.existsSync(filePath)) {
        throw new Error(`After install/build, still missing: ${filePath}`);
      }
      const spec2 = pathToFileURL(filePath).href;
      return await import(spec2);
    }
    const from = pathToFileURL(__filename).href;
    const err = new Error(`Failed dynamic import ${spec} from ${from}: ${msg}`);
    (err as any).cause = e;
    throw err;
  }
}

// CommonJS require fallback for Electron main to avoid ESM file:// import issues
function requireCore(coreBase: string, file: string): any {
  const requireFn = createRequire(__filename);
  const filePath = path.join(coreBase, file);
  try {
    if (!fssync.existsSync(filePath)) {
      throw new Error(`Missing core module at ${filePath}`);
    }
    return requireFn(filePath);
  } catch (e: any) {
    const msg = String(e?.message || e);
    const repoRoot = path.resolve(coreBase, '../../..');
    const needsBuild = /Cannot find module|ERR_MODULE_NOT_FOUND|Missing core module/i.test(msg);
    if (needsBuild) {
      // Last-ditch: try building/installing, then re-require once
      try { fssync.mkdirSync(path.join(repoRoot, 'node_modules'), { recursive: true }); } catch {}
      // best-effort handled by ensureCoreBuilt() earlier
      try {
        return requireFn(filePath);
      } catch (e2: any) {
        throw new Error(`Failed to require core module ${filePath}: ${String(e2?.message || e2)}`);
      }
    }
    throw new Error(`Failed to require core module ${filePath}: ${msg}`);
  }
}

async function importCore(coreBase: string, file: string): Promise<any> {
  // Prefer ESM dynamic import via file:// when available, fallback to require()
  const esmPath = path.join(coreBase, file);
  const esmSpec = pathToFileURL(esmPath).href;
  try {
    if (fssync.existsSync(esmPath)) {
      // Use runtime dynamic import to avoid TS transforming to require()
      const dynamicImport = new Function('s', 'return import(s)') as (s: string) => Promise<any>;
      return await dynamicImport(esmSpec);
    }
  } catch (_e) {
    // fall through to CJS require fallback
  }
  try {
    return requireCore(coreBase, file);
  } catch (e: any) {
    throw new Error(`Failed to load core module ${esmPath}: ${String(e?.message || e)}`);
  }
}
