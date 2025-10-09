import sharp from 'sharp';
import path from 'node:path';
import { loadLayerCatalog } from './catalog.js';
import { generateEditionsConstrained } from './generator.js';
import { compositeLayers } from './compositor.js';
import { applyTransformRules, type TransformableLayerState } from './transforms.js';
import type { ResolvedEffects } from './effects.js';
import type { ProjectConfig } from './project-config.js';
import { loadSpawnMapFile } from './spawn.js';
import { createSeededRng } from './rng.js';
import { placeAsset, resolveCandidateDots } from './placement.js';

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

  const overlays: sharp.OverlayOptions[] = [];
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

  const spawnMap = await loadSpawnMapFile(projectRoot, (config as any)?.spawn?.mapPath);
  const spawnFit = (spawnMap?.rules?.fitMode ?? (config as any)?.spawn?.fitMode ?? 'contain') as any;
  const out: Buffer[] = [];
  for (let i = 0; i < editions.length; i++) {
    const ed = editions[i]!;
    const picks = Array.from(ed.picks);
    let placedOffsets: Array<{ offX: number; offY: number }> = [];
    if (spawnMap) {
      const rng = createSeededRng(`${seed}:prev:${i + 1}`);
      const occupied: Array<{ x: number; y: number; w: number; h: number }> = [];
      const mapper = { authorWidth: spawnMap.authoringSize.width, authorHeight: spawnMap.authoringSize.height, outWidth: config.image.width, outHeight: config.image.height, fitMode: spawnFit } as any;
      placedOffsets = picks.map((p: any, k: number) => {
        const layer = String(p.layer || p.option?.value || `L${k}`);
        const assetKey = `${layer}:${p.option.value}`;
        const candidates = resolveCandidateDots(spawnMap, layer, assetKey);
        const assetSize = { width: config.image.width, height: config.image.height };
        const pol = spawnMap.rules?.selection ?? 'weighted';
        const jitterDef = spawnMap.rules?.jitter?.defaultRadiusPx ?? 0;
        const coll = spawnMap.rules?.collision;
        const result = placeAsset({
          globalSeed: `${seed}:${i + 1}:${layer}:${p.option.value}`,
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

    const layerStates: TransformableLayerState[] = picks.map((p: any, k: number) => {
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

    const appliedTransforms = applyTransformRules(config.rules?.transforms, layerStates, ed.traits);

    const buffer = await compositeLayers(
      picks.map((p: any, k: number) => {
        const state = layerStates[k]!;
        const applied = appliedTransforms.get(k);
        const finalOffsetX = applied?.offsetX ?? state.baseOffsetX;
        const finalOffsetY = applied?.offsetY ?? state.baseOffsetY;
        const finalRotate = applied?.rotate ?? state.baseRotate;
        const finalScale = applied?.scale ?? state.baseScale;
        let effects: ResolvedEffects | undefined = cloneResolvedEffects(p.option.effects);
        if (!effects && (finalRotate !== undefined || finalScale !== undefined)) {
          effects = {};
        }
        if (effects) {
          if (finalRotate !== undefined) effects.rotate = finalRotate;
          else if (state.baseRotate === undefined) delete effects.rotate;
          if (finalScale !== undefined) effects.scale = finalScale;
          else if (state.baseScale === undefined) delete effects.scale;
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
        width: config.image.width,
        height: config.image.height,
        background: config.image.background,
        format: (config.export?.imageFormat === 'webp' ? 'webp' : 'png') as any,
        superSample: Number((config as any)?.experimental?.compositor?.superSample || 1) || 1,
        forceCpu: !!((config as any)?.experimental?.compositor?.forceCpu),
      },
    );
    out.push(buffer);
  }
  return out;
}

function cloneResolvedEffects(e?: ResolvedEffects): ResolvedEffects | undefined {
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
