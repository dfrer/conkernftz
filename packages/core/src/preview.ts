import sharp from 'sharp';
import type { OverlayOptions } from 'sharp';
import { loadLayerCatalog } from './catalog.js';
import { generateEditionsConstrained } from './generator.js';
import { renderEdition } from './render-edition.js';
import { loadSpawnMapFile } from './spawn.js';
import type { ProjectConfig } from './project-config.js';

export async function makeContactSheet(
  imagePaths: string[],
  thumbSize: { width: number; height: number },
  grid: { columns: number; gap: number },
): Promise<Buffer> {
  const columns = grid.columns;
  const rows = Math.ceil(imagePaths.length / columns);
  const width = columns * thumbSize.width + (columns - 1) * grid.gap;
  const height = rows * thumbSize.height + (rows - 1) * grid.gap;

  // Start with a dark background
  let sheet = sharp({
    create: {
      width,
      height,
      channels: 4,
      background: '#111111',
    },
  });

  const overlays: OverlayOptions[] = [];
  for (let i = 0; i < imagePaths.length; i++) {
    const row = Math.floor(i / columns);
    const col = i % columns;
    const x = col * (thumbSize.width + grid.gap);
    const y = row * (thumbSize.height + grid.gap);
    const resized = await sharp(imagePaths[i]).resize(thumbSize.width, thumbSize.height, { fit: 'cover' }).toBuffer();
    overlays.push({ input: resized, top: y, left: x });
  }

  sheet = sheet.composite(overlays);
  return sheet.png().toBuffer();
}

export function generateRarityReport(
  editions: Array<{ traits: Record<string, string> }>,
): {
  traitCounts: Record<string, Record<string, number>>;
  editionCount: number;
} {
  const counts: Record<string, Record<string, number>> = {};
  for (const ed of editions) {
    for (const [trait_type, value] of Object.entries(ed.traits)) {
      if (!counts[trait_type]) counts[trait_type] = {};
      counts[trait_type][value] = (counts[trait_type][value] ?? 0) + 1;
    }
  }
  return { traitCounts: counts, editionCount: editions.length };
}

export async function renderPreviewEdition(
  projectRoot: string,
  config: ProjectConfig,
  seed: string,
  count: number,
): Promise<Buffer[]> {
  const catalog = await loadLayerCatalog(projectRoot, config.layers, {
    mode: 'filenameDelimiter',
    delimiter: config.rarity.delimiter,
    defaultWeight: config.rarity.defaultWeight,
  });
  const editions = generateEditionsConstrained(
    catalog,
    Math.max(1, count),
    { seed },
    { rules: config.rules ?? {}, uniqueness: undefined, maxAttemptsPerEdition: 100 },
  );

  const spawnMap = await loadSpawnMapFile(projectRoot, config.spawn?.mapPath);
  const spawnFit = spawnMap?.rules?.fitMode ?? config.spawn?.fitMode ?? 'contain';
  const outFormat: 'png' | 'webp' = config.export?.imageFormat === 'webp' ? 'webp' : 'png';
  const out: Buffer[] = [];
  for (let i = 0; i < editions.length; i++) {
    const ed = editions[i]!;
    const buffer = await renderEdition({
      config,
      picks: Array.from(ed.picks),
      traits: ed.traits,
      spawnMap,
      spawnFit,
      placementRngSeed: `${seed}:prev:${i + 1}`,
      assetSeedBase: `${seed}:${i + 1}`,
      format: outFormat,
    });
    out.push(buffer);
  }
  return out;
}
