import fs from 'node:fs/promises';
import path from 'node:path';
import { parseWeightFromFilename, type RarityConfig } from './rarity.js';
import type { LayerSpec, BlendMode, AssetOverride, AssetEffects } from './types.js';
import { resolveEffects, type ResolvedEffects } from './effects.js';

export interface LayerAssetOption {
  filePath: string;
  value: string;
  weight: number;
  blend?: BlendMode;
  opacity?: number;
  offsetX?: number;
  offsetY?: number;
  effects?: ResolvedEffects;
}

export interface LayerCatalogEntry {
  spec: LayerSpec;
  options: LayerAssetOption[];
  // Round-robin state tracking
  roundRobinIndex?: number;
}

export async function loadLayerCatalog(
  projectRoot: string,
  layers: LayerSpec[],
  rarity: RarityConfig,
): Promise<LayerCatalogEntry[]> {
  const entries: LayerCatalogEntry[] = [];
  for (const layer of layers) {
    const layerDir = path.resolve(projectRoot, layer.path);
    const files = await listImageFiles(layerDir);
    const options = files.map((filename) => {
      const weight = layer.rarity === 'uniform' ? rarity.defaultWeight : parseWeightFromFilename(filename, rarity);
      const value = extractTraitValueFromFilename(filename, rarity);
      // Start with layer-level defaults
      const baseEffects: AssetEffects = {
        blend: layer.blend,
        opacity: layer.opacity,
        ...(layer.effects ?? {}),
      };
      const base: LayerAssetOption = {
        filePath: path.join(layerDir, filename),
        value,
        weight,
        blend: layer.blend,
        opacity: layer.opacity,
        effects: resolveEffects(baseEffects),
      };
      // Apply per-asset overrides (first match wins)
      const overrides = Array.isArray(layer.overrides) ? (layer.overrides as AssetOverride[]) : [];
      for (const ov of overrides) {
        if (!ov || !ov.match || !ov.effects) continue;
        const matched = ov.target === 'filename' ? filename === ov.match : value === ov.match;
        if (matched) {
          if (ov.effects.blend !== undefined) base.blend = ov.effects.blend;
          if (ov.effects.opacity !== undefined) base.opacity = ov.effects.opacity;
          if (ov.effects.offsetX !== undefined) base.offsetX = ov.effects.offsetX;
          if (ov.effects.offsetY !== undefined) base.offsetY = ov.effects.offsetY;
          // Merge nested effect objects
          base.effects = mergeEffects(base.effects, resolveEffects(ov.effects));
          break;
        }
      }
      return base;
    });
    entries.push({ 
      spec: layer, 
      options,
      roundRobinIndex: layer.selectionMode === 'round-robin' ? 0 : undefined
    });
  }
  return entries;
}

async function listImageFiles(dir: string): Promise<string[]> {
  const dirents = await fs.readdir(dir, { withFileTypes: true });
  return dirents
    .filter((d) => d.isFile())
    .map((d) => d.name)
    .filter((n) => isImageFile(n));
}

function isImageFile(name: string): boolean {
  const ext = path.extname(name).toLowerCase();
  return ext === '.png' || ext === '.webp' || ext === '.gif';
}

export function extractTraitValueFromFilename(filename: string, rarity: RarityConfig): string {
  const base = filename.replace(/\.[^.]+$/, '');
  if (rarity.mode === 'filenameDelimiter') {
    const idx = base.lastIndexOf(rarity.delimiter);
    if (idx !== -1) return base.slice(0, idx);
  }
  return base;
}

function mergeEffects(a?: ResolvedEffects, b?: ResolvedEffects): ResolvedEffects | undefined {
  if (!a) return b;
  if (!b) return a;
  return {
    blend: b.blend ?? a.blend,
    opacity: b.opacity ?? a.opacity,
    offsetX: b.offsetX ?? a.offsetX,
    offsetY: b.offsetY ?? a.offsetY,
    rotate: b.rotate ?? a.rotate,
    scale: b.scale ?? a.scale,
    glow: b.glow ?? a.glow,
    stroke: b.stroke ?? a.stroke,
    shadow: b.shadow ?? a.shadow,
    extrude: b.extrude ?? a.extrude,
  };
}
