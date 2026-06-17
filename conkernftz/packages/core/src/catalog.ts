import fs from 'node:fs/promises';
import path from 'node:path';
import { parseWeightFromFilename, type RarityConfig } from './rarity.js';
import type { LayerSpec, BlendMode } from './types.js';

export interface LayerAssetOption {
  filePath: string;
  value: string;
  weight: number;
  blend?: BlendMode;
  opacity?: number;
  // Pixel dimensions of the asset, populated when `loadDimensions` is requested.
  // Required for correct pattern-placement anchoring; otherwise left undefined.
  width?: number;
  height?: number;
}

export interface LayerCatalogEntry {
  spec: LayerSpec;
  options: LayerAssetOption[];
}

export interface LoadCatalogOptions {
  // Read each asset's pixel dimensions via Sharp. Needed for pattern placement;
  // skipped by default to avoid the metadata cost on large non-pattern projects.
  loadDimensions?: boolean;
}

export async function loadLayerCatalog(
  projectRoot: string,
  layers: LayerSpec[],
  rarity: RarityConfig,
  opts?: LoadCatalogOptions,
): Promise<LayerCatalogEntry[]> {
  const entries: LayerCatalogEntry[] = [];
  const sharp = opts?.loadDimensions ? (await import('sharp')).default : null;
  for (const layer of layers) {
    const layerDir = path.resolve(projectRoot, layer.path);
    const files = await listImageFiles(layerDir);
    const options: LayerAssetOption[] = [];
    for (const filename of files) {
      const weight =
        layer.rarity === 'uniform' ? rarity.defaultWeight : parseWeightFromFilename(filename, rarity);
      const value = extractTraitValueFromFilename(filename, rarity);
      const filePath = path.join(layerDir, filename);
      let width: number | undefined;
      let height: number | undefined;
      if (sharp) {
        try {
          const meta = await sharp(filePath).metadata();
          width = meta.width;
          height = meta.height;
        } catch {
          // Unreadable file: leave dimensions undefined; placement falls back gracefully.
        }
      }
      options.push({ filePath, value, weight, blend: layer.blend, opacity: layer.opacity, width, height });
    }
    entries.push({ spec: layer, options });
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


