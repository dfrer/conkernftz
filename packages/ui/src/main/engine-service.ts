// Engine service — the single, electron-free boundary between the Electron main
// process and @conkernftz/core. It owns generation + rendering (preview / build /
// effects) by calling core's *one* render path (renderEdition / buildCollection /
// renderPreviewEdition), so the UI never re-implements the pipeline.
//
// @conkernftz/core is an ESM-only package; the Electron main process emits CommonJS.
// We import core's *types* statically (erased at compile time) and load its runtime
// through ./dynamic-import.js — a hand-written helper whose real import() is not
// downleveled to require() by tsc. Node resolves the package via its `exports` map,
// so there is no filesystem path archaeology and no runtime `pnpm build`. This file
// has no `electron` dependency, so the whole pipeline is unit-testable headlessly.

import path from 'node:path';
import fs from 'node:fs/promises';
import { dynamicImport } from './dynamic-import.js';
import type {
  ProjectConfig,
  BuildProgress,
  GeneratedEdition,
  EditionPick,
  FitMode,
  ResolvedEffects,
} from '@conkernftz/core';

// ---------------------------------------------------------------------------
// Lazy core / chain loaders (real dynamic import, cached)
// ---------------------------------------------------------------------------
let _corePromise: Promise<typeof import('@conkernftz/core')> | null = null;
/** Load the @conkernftz/core ESM barrel once and cache it. */
export function loadCore(): Promise<typeof import('@conkernftz/core')> {
  if (!_corePromise) _corePromise = dynamicImport<typeof import('@conkernftz/core')>('@conkernftz/core');
  return _corePromise;
}

let _solanaPromise: Promise<typeof import('@conkernftz/chain-solana')> | null = null;
function loadSolana(): Promise<typeof import('@conkernftz/chain-solana')> {
  if (!_solanaPromise) {
    _solanaPromise = dynamicImport<typeof import('@conkernftz/chain-solana')>('@conkernftz/chain-solana');
  }
  return _solanaPromise;
}

// ---------------------------------------------------------------------------
// Config loading
// ---------------------------------------------------------------------------
export async function loadProjectConfig(projectDir: string): Promise<ProjectConfig> {
  const core = await loadCore();
  const raw = await fs.readFile(path.join(projectDir, 'foundry.config.json'), 'utf8');
  return core.ProjectConfigSchema.parse(JSON.parse(raw));
}

function randomSeed(prefix: string): string {
  return `${prefix}:${Date.now().toString(36)}:${Math.floor(Math.random() * 1e9).toString(36)}`;
}

function outFormatOf(cfg: { export?: { imageFormat?: string } }): 'png' | 'webp' {
  return cfg.export?.imageFormat === 'webp' ? 'webp' : 'png';
}

/** In-place Fisher–Yates shuffle (mirrors the legacy experimental shuffleLayers behavior). */
function shuffleInPlace<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = tmp;
  }
  return arr;
}

// ---------------------------------------------------------------------------
// Build the full collection (wraps core.buildCollection, optional Solana JSON)
// ---------------------------------------------------------------------------
export interface BuildOptions {
  projectDir: string;
  count: number;
  seed?: string;
  onProgress?: (p: BuildProgress) => void;
}

export async function buildCollection(opts: BuildOptions): Promise<{ editions: number; outDir: string }> {
  const core = await loadCore();
  const cfg = await loadProjectConfig(opts.projectDir);
  const seed = opts.seed ?? randomSeed('build');

  let buildJson: Parameters<typeof core.buildCollection>[0]['buildJson'];
  if (cfg.chain?.target === 'solana') {
    try {
      const solana = await loadSolana();
      buildJson = (input) => solana.SolanaJsonAdapter.buildOffchainJson(input);
    } catch {
      /* fall back to the default JSON builder in core */
    }
  }

  const res = await core.buildCollection(
    { cwd: opts.projectDir, config: cfg, count: opts.count, seed, maxAttemptsPerEdition: 500, buildJson },
    { onProgress: opts.onProgress },
  );
  return { editions: res.editions.length, outDir: res.outDir };
}

// ---------------------------------------------------------------------------
// Render N previews to disk (replaces the legacy inline previewWithProgress loop)
// ---------------------------------------------------------------------------
export interface PreviewToDiskOptions {
  projectDir: string;
  count: number;
  seed?: string;
  onProgress?: (current: number, total: number, message: string) => void;
  /** Return true to stop the run cooperatively (checked between editions). */
  shouldStop?: () => boolean;
  /** Awaited between editions so callers can implement pause. */
  waitWhilePaused?: () => Promise<void>;
}

/** Mirror of the legacy CLI/UI preview output-dir resolution. */
export function normalizePreviewOutDir(p: string): string {
  const trimmed = p.replace(/[\\/]+$/, '');
  if (/([\\/])(preview|previews)$/i.test(trimmed)) return trimmed;
  return path.join(trimmed, 'preview');
}

export interface PreviewToDiskResult {
  outDir: string;
  written: number;
  stopped?: boolean;
}

export async function renderPreviewsToDisk(opts: PreviewToDiskOptions): Promise<PreviewToDiskResult> {
  const core = await loadCore();
  const cfg = await loadProjectConfig(opts.projectDir);

  const previewBaseRaw = cfg.export.previewOutDir
    ? normalizePreviewOutDir(cfg.export.previewOutDir)
    : normalizePreviewOutDir(cfg.export.outDir);
  const outBase = path.isAbsolute(previewBaseRaw) ? previewBaseRaw : path.join(opts.projectDir, previewBaseRaw);
  const outDir = path.resolve(outBase);
  await fs.mkdir(outDir, { recursive: true });

  // Clear previous previews (files only).
  try {
    const dirents = await fs.readdir(outDir, { withFileTypes: true });
    await Promise.all(
      dirents.filter((d) => d.isFile()).map((d) => fs.unlink(path.join(outDir, d.name)).catch(() => {})),
    );
  } catch {
    /* ignore */
  }

  const catalog = await core.loadLayerCatalog(opts.projectDir, cfg.layers, {
    mode: 'filenameDelimiter',
    delimiter: cfg.rarity.delimiter,
    defaultWeight: cfg.rarity.defaultWeight,
  });

  const total = Math.max(1, Number(opts.count) || 10);
  const seed = opts.seed ?? randomSeed('preview');
  let editions: GeneratedEdition[];
  try {
    editions = core.generateEditionsConstrained(catalog, total, { seed }, {
      rules: cfg.rules ?? {},
      uniqueness: cfg.uniqueness,
      maxAttemptsPerEdition: 500,
    });
  } catch {
    editions = core.generateEditionsConstrained(catalog, total, { seed }, {
      rules: cfg.rules ?? {},
      uniqueness: undefined,
      maxAttemptsPerEdition: 500,
    });
  }

  const spawnMap = await core.loadSpawnMapFile(opts.projectDir, cfg.spawn?.mapPath);
  const spawnFit: FitMode = (spawnMap?.rules?.fitMode ?? cfg.spawn?.fitMode ?? 'contain') as FitMode;
  const fmt = outFormatOf(cfg);

  const written: string[] = [];
  let idx = 0;
  for (const ed of editions) {
    if (opts.waitWhilePaused) await opts.waitWhilePaused();
    if (opts.shouldStop?.()) return { outDir, written: written.length, stopped: true };
    idx++;
    const picks = Array.from(ed.picks) as EditionPick[];
    if (cfg.experimental?.generation?.shuffleLayers) shuffleInPlace(picks);
    const buffer = await core.renderEdition({
      config: cfg,
      picks,
      traits: ed.traits,
      spawnMap,
      spawnFit,
      placementRngSeed: `${seed}:ed:${idx}`,
      assetSeedBase: `${seed}:${idx}`,
      format: fmt,
    });
    const filePath = path.join(outDir, `preview_${idx}.${fmt}`);
    await fs.writeFile(filePath, buffer);
    written.push(filePath);
    opts.onProgress?.(idx, total, `Generating preview ${idx}/${total}`);
  }

  // Optional contact sheet.
  if (cfg.export?.includePreviewContactSheet) {
    try {
      const sheet = await core.makeContactSheet(written, { width: 256, height: 256 }, { columns: 5, gap: 8 });
      await fs.writeFile(path.join(outDir, 'contact-sheet.png'), sheet);
    } catch {
      /* contact sheet is best-effort */
    }
  }

  return { outDir, written: written.length };
}

// ---------------------------------------------------------------------------
// Live previews returned as base64 (replaces the legacy inline previewLive)
// ---------------------------------------------------------------------------

/** Shallow effects merge used when the renderer sends partial live-edit overrides. */
export function mergeEffects(
  base: Partial<ResolvedEffects> | undefined,
  over: Partial<ResolvedEffects> | undefined,
): Partial<ResolvedEffects> | undefined {
  if (!base && !over) return undefined;
  const a = (base ?? {}) as Record<string, unknown>;
  const b = (over ?? {}) as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  const scalar = ['blend', 'opacity', 'offsetX', 'offsetY', 'rotate', 'scale'] as const;
  for (const k of scalar) {
    if (a[k] !== undefined || b[k] !== undefined) out[k] = b[k] !== undefined ? b[k] : a[k];
  }
  const nested = ['glow', 'shadow', 'stroke', 'extrude', 'modulate', 'colorOverlay'] as const;
  for (const k of nested) {
    const av = a[k] as Record<string, unknown> | undefined;
    const bv = b[k] as Record<string, unknown> | undefined;
    if (av || bv) out[k] = { ...(av ?? {}), ...(bv ?? {}) };
  }
  return out as Partial<ResolvedEffects>;
}

interface LayerLike {
  name?: string;
  path?: string;
  blend?: string;
  opacity?: number;
  effects?: Partial<ResolvedEffects>;
  [k: string]: unknown;
}

/** Merge renderer-supplied layer overrides on top of the on-disk layers, keyed by name/path. */
export function mergeLayers(baseLayers: LayerLike[] | undefined, uiLayers: LayerLike[] | undefined): LayerLike[] {
  if (!Array.isArray(uiLayers) || uiLayers.length === 0) return Array.isArray(baseLayers) ? baseLayers : [];
  const map = new Map<string, LayerLike>();
  for (const l of Array.isArray(baseLayers) ? baseLayers : []) {
    if (!l || typeof l !== 'object') continue;
    map.set(String(l.name || l.path || map.size), { ...l });
  }
  for (const u of uiLayers) {
    if (!u || typeof u !== 'object') continue;
    const key = String(u.name || u.path || `idx:${map.size}`);
    const base = map.get(key) ?? {};
    const merged: LayerLike = { ...base, ...u };
    if (base.effects || u.effects) merged.effects = mergeEffects(base.effects, u.effects);
    map.set(key, merged);
  }
  return Array.from(map.values());
}

export interface LivePreviewResult {
  format: 'png' | 'webp';
  images: string[];
}

export async function renderLivePreviews(
  projectDir: string,
  configLike: Record<string, unknown> | undefined,
  count = 4,
  seed = 'ui-live',
): Promise<LivePreviewResult> {
  const core = await loadCore();
  let cfg: Record<string, unknown> = {};
  try {
    const raw = await fs.readFile(path.join(projectDir, 'foundry.config.json'), 'utf8');
    cfg = JSON.parse(raw);
  } catch {
    cfg = {};
  }
  const cl = configLike ?? {};
  const effective: Record<string, unknown> = { ...cfg, ...cl };
  effective.image = { ...(cfg.image as object), ...((cl.image as object) ?? {}) };
  effective.layers = mergeLayers(cfg.layers as LayerLike[], cl.layers as LayerLike[]);

  const howMany = Math.max(1, Math.min(12, Number(count) || 4));
  const liveSeed = !seed || seed === 'random' ? randomSeed('ui-live') : seed;
  const fmt = outFormatOf(effective as { export?: { imageFormat?: string } });

  const bufs = await core.renderPreviewEdition(projectDir, effective as unknown as ProjectConfig, liveSeed, howMany);
  return { format: fmt, images: bufs.map((b) => b.toString('base64')) };
}

// ---------------------------------------------------------------------------
// Single effects preview (one composite of the first asset per layer)
// ---------------------------------------------------------------------------
export interface EffectsPreviewResult {
  format: 'png' | 'webp';
  b64: string;
}

const IMG_RE = /\.(png|webp|gif)$/i;

export async function renderEffectsPreview(
  projectDir: string,
  configLike: Record<string, unknown> | undefined,
): Promise<EffectsPreviewResult> {
  const core = await loadCore();
  let cfg: Record<string, unknown> = {};
  try {
    const raw = await fs.readFile(path.join(projectDir, 'foundry.config.json'), 'utf8');
    cfg = JSON.parse(raw);
  } catch {
    cfg = {};
  }
  const cl = configLike ?? {};
  const effective: Record<string, unknown> = { ...cfg, ...cl };
  const image = { ...(cfg.image as object), ...((cl.image as object) ?? {}) } as {
    width?: number;
    height?: number;
    background?: string;
  };
  // Force the CPU compositor for live effects fidelity (advanced blends/effects).
  const baseXp = (cfg.experimental as Record<string, unknown>) ?? {};
  const clXp = (cl.experimental as Record<string, unknown>) ?? {};
  const compositor = {
    ...((baseXp.compositor as object) ?? {}),
    ...((clXp.compositor as object) ?? {}),
    forceCpu: true,
  } as { superSample?: number; forceCpu?: boolean };

  const width = Number(image.width || 1024);
  const height = Number(image.height || 1024);
  const background = image.background || 'transparent';
  const layers = (Array.isArray(cl.layers) ? cl.layers : (cfg.layers as unknown[])) as LayerLike[] | undefined;

  const inputs: Array<Record<string, unknown>> = [];
  for (const layer of layers ?? []) {
    if (!layer || !layer.path) continue;
    const dir = path.isAbsolute(layer.path) ? layer.path : path.join(projectDir, layer.path);
    let chosen: string | null = null;
    try {
      const dirents = await fs.readdir(dir, { withFileTypes: true });
      const files = dirents
        .filter((d) => d.isFile())
        .map((d) => d.name)
        .filter((n) => IMG_RE.test(n))
        .sort();
      if (files.length > 0) chosen = path.join(dir, files[0]!);
    } catch {
      /* skip missing layer dir */
    }
    if (!chosen) continue;
    const eff = layer.effects;
    inputs.push({
      path: chosen,
      blend: layer.blend ?? eff?.blend ?? 'normal',
      opacity: (typeof layer.opacity === 'number' ? layer.opacity : undefined) ?? eff?.opacity ?? 1,
      offsetX: eff?.offsetX ?? 0,
      offsetY: eff?.offsetY ?? 0,
      effects: eff,
    });
  }
  if (inputs.length === 0) throw new Error('No assets found to preview');

  const fmt = outFormatOf(effective as { export?: { imageFormat?: string } });
  const buffer = await core.compositeLayers(inputs as unknown as Parameters<typeof core.compositeLayers>[0], {
    width,
    height,
    background,
    format: fmt,
    superSample: Number(compositor.superSample || 1) || 1,
    forceCpu: !!compositor.forceCpu,
  });
  return { format: fmt, b64: buffer.toString('base64') };
}
