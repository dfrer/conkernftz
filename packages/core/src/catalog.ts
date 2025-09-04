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
}

export interface LayerCatalogEntry {
  spec: LayerSpec;
  options: LayerAssetOption[];
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
      return {
        filePath: path.join(layerDir, filename),
        value,
        weight,
        blend: layer.blend,
        opacity: layer.opacity,
      } satisfies LayerAssetOption;
    });
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


