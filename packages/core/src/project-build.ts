import fs from 'node:fs/promises';
import path from 'node:path';
import { loadLayerCatalog } from './catalog.js';
import { generateEditionsConstrained, type GeneratedEdition } from './generator.js';
import { compositeLayers } from './compositor.js';
import { loadSpawnMapFile } from './spawn.js';
import { createSeededRng } from './rng.js';
import { placeAsset, resolveCandidateDots, mapNormalizedToPixels } from './placement.js';
import { makeDna } from './dna.js';
import { generateRarityReport } from './preview.js';
import { applyTransformRules, type TransformableLayerState } from './transforms.js';
import type { ResolvedEffects } from './effects.js';
import type { ProjectConfig } from './project-config.js';

export interface BuildProgress {
  current: number;
  total: number;
  message?: string;
}

export interface BuildHooks {
  onProgress?: (p: BuildProgress) => void;
}

export interface BuildCollectionInput {
  cwd: string; // project directory
  config: ProjectConfig;
  count: number;
  seed: string;
  maxAttemptsPerEdition?: number;
  buildJson?: (input: BuildJsonParams) => Record<string, unknown>;
  preGeneratedEditions?: GeneratedEdition[]; // Optional: use pre-generated editions (e.g., from previews)
}

export interface BuildCollectionOutput {
  outDir: string;
  imagesDir: string;
  jsonDir: string;
  editions: GeneratedEdition[];
}

export interface BuildJsonParams {
  index: number;
  name: string;
  description: string;
  imageUri: string;
  animationUri?: string;
  attributes: Array<{ trait_type: string; value: string }>;
  external_url?: string;
  files?: Array<{ uri: string; type: string }>;
  symbol?: string;
}

export async function buildCollection(
  input: BuildCollectionInput,
  hooks?: BuildHooks,
): Promise<BuildCollectionOutput> {
  const cfg = input.config;
  const outBase = path.isAbsolute(cfg.export.outDir) ? cfg.export.outDir : path.join(input.cwd, cfg.export.outDir);
  const outDir = path.resolve(outBase);
  const outImages = path.join(outDir, 'images');
  const outJson = path.join(outDir, 'json');
  await fs.mkdir(outImages, { recursive: true });
  await fs.mkdir(outJson, { recursive: true });

  const catalog = await loadLayerCatalog(input.cwd, cfg.layers, {
    mode: 'filenameDelimiter',
    delimiter: cfg.rarity.delimiter,
    defaultWeight: cfg.rarity.defaultWeight,
  });

  // Use pre-generated editions if provided, otherwise generate new ones
  let editions: GeneratedEdition[];
  if (input.preGeneratedEditions && input.preGeneratedEditions.length > 0) {
    // Use pre-generated editions first
    const previewEditions = input.preGeneratedEditions.slice(0, input.count);
    const previewCount = previewEditions.length;
    
    // If we need more editions, generate the rest randomly
    // Ensure additional editions don't conflict with preview editions
    if (previewCount < input.count) {
      const remainingCount = input.count - previewCount;
      
      // Track DNA from preview editions to avoid conflicts
      const previewDna = new Set<string>();
      const previewOccCounts = new Map<string, number>();
      
      if (cfg.uniqueness) {
        for (const ed of previewEditions) {
          const dna = makeDna(ed.traits, cfg.uniqueness);
          previewDna.add(dna);
        }
      }
      
      // Track maxOccurrences from preview editions
      const maxOccRules = cfg.rules?.maxOccurrences ?? [];
      for (const rule of maxOccRules) {
        const [layer, value] = rule.trait.split(':');
        if (layer && value) {
          for (const ed of previewEditions) {
            if (ed.traits[layer] === value) {
              previewOccCounts.set(rule.trait, (previewOccCounts.get(rule.trait) ?? 0) + 1);
            }
          }
        }
      }
      
      // Generate additional editions and filter out conflicts
      const additionalSeed = `${input.seed}:additional:${Date.now()}`;
      let attempts = 0;
      const maxAttempts = 10; // Try up to 10 batches
      let additionalEditions: GeneratedEdition[] = [];
      
      while (additionalEditions.length < remainingCount && attempts++ < maxAttempts) {
        const batch = generateEditionsConstrained(
          catalog,
          remainingCount - additionalEditions.length,
          { seed: `${additionalSeed}:${attempts}` },
          { rules: cfg.rules ?? {}, uniqueness: cfg.uniqueness, maxAttemptsPerEdition: input.maxAttemptsPerEdition ?? 500 },
        );
        
        for (const ed of batch) {
          // Check uniqueness against previews
          if (cfg.uniqueness) {
            const dna = makeDna(ed.traits, cfg.uniqueness);
            if (previewDna.has(dna)) {
              continue; // Skip conflicting DNA
            }
            previewDna.add(dna); // Add to set for future checks
          }
          
          // Check maxOccurrences against previews
          let violatesMaxOcc = false;
          for (const rule of maxOccRules) {
            const [layer, value] = rule.trait.split(':');
            if (layer && value && ed.traits[layer] === value) {
              const used = (previewOccCounts.get(rule.trait) ?? 0) + 
                           additionalEditions.filter(e => e.traits[layer] === value).length;
              if (used >= rule.max) {
                violatesMaxOcc = true;
                break;
              }
            }
          }
          
          if (!violatesMaxOcc) {
            additionalEditions.push(ed);
            
            // Update occurrence counts
            for (const rule of maxOccRules) {
              const [layer, value] = rule.trait.split(':');
              if (layer && value && ed.traits[layer] === value) {
                previewOccCounts.set(rule.trait, (previewOccCounts.get(rule.trait) ?? 0) + 1);
              }
            }
            
            if (additionalEditions.length >= remainingCount) break;
          }
        }
      }
      
      if (additionalEditions.length < remainingCount) {
        console.warn(`Warning: Only generated ${additionalEditions.length} additional editions out of ${remainingCount} requested. Some preview editions may conflict with constraints.`);
      }
      
      editions = [...previewEditions, ...additionalEditions];
    } else {
      editions = previewEditions;
    }
  } else {
    // Generate all editions from scratch
    editions = generateEditionsConstrained(
      catalog,
      input.count,
      { seed: input.seed },
      { rules: cfg.rules ?? {}, uniqueness: cfg.uniqueness, maxAttemptsPerEdition: input.maxAttemptsPerEdition ?? 500 },
    );
  }

  const allMetadata: any[] = [];
  const outFormat: 'png' | 'webp' = (cfg.export?.imageFormat === 'webp' ? 'webp' : 'png');

  // Optional: load spawn map if configured
  const spawnFit = (cfg.spawn && cfg.spawn.fitMode) || 'contain';
  const spawnMap = await loadSpawnMapFile(input.cwd, cfg.spawn?.mapPath);

  const batchSize = Math.min(20, Math.max(5, Math.floor(editions.length / 8)));
  const totalBatches = Math.max(1, Math.ceil(editions.length / Math.max(1, batchSize)));

  for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
    const startIdx = batchIndex * batchSize;
    const endIdx = Math.min(startIdx + batchSize, editions.length);
    const batch = editions.slice(startIdx, endIdx);

    const batchPromises = batch.map(async (ed, batchOffset) => {
      const i = startIdx + batchOffset;
      const idx = i + 1;
      const picks = Array.from(ed.picks);
      try {
        if ((cfg as any)?.experimental?.generation?.shuffleLayers) {
          for (let k = picks.length - 1; k > 0; k--) {
            const j = Math.floor(Math.random() * (k + 1));
            const tmp = picks[k]!; picks[k] = picks[j]!; picks[j] = tmp;
          }
        }
      } catch {}
      // If spawn map present, compute per-layer offsets via placement
      let placedOffsets: Array<{ offX: number; offY: number }> = [];
      if (spawnMap && Array.isArray(picks)) {
        const rng = createSeededRng(`${input.seed}:ed:${idx}`);
        const occupied: Array<{ x: number; y: number; w: number; h: number }> = [];
        const mapper = {
          authorWidth: spawnMap.authoringSize.width,
          authorHeight: spawnMap.authoringSize.height,
          outWidth: cfg.image.width,
          outHeight: cfg.image.height,
          fitMode: (spawnMap.rules?.fitMode ?? spawnFit) as any,
        };
        placedOffsets = picks.map((p: any, k: number) => {
          const layer = String(p.layer || p.option?.value || `L${k}`);
          const assetKey = `${layer}:${p.option.value}`;
          const candidates = resolveCandidateDots(spawnMap, layer, assetKey);
          // TODO: detect asset size; currently we draw full-canvas; use canvas size as bbox
          const assetSize = { width: cfg.image.width, height: cfg.image.height };
          const pol = spawnMap.rules?.selection ?? 'weighted';
          const jitterDef = spawnMap.rules?.jitter?.defaultRadiusPx ?? 0;
          const coll = spawnMap.rules?.collision;
          const result = placeAsset({
            globalSeed: `${input.seed}:${idx}:${layer}:${p.option.value}`,
            layerName: layer,
            assetKey,
            candidateDots: candidates,
            policy: pol as any,
            jitterDefaultPx: jitterDef,
            collision: coll ? {
              enabled: !!coll.enabled,
              paddingPx: Math.max(0, coll.paddingPx ?? 0),
              strategy: (coll.strategy ?? 'retry') as any,
              maxAttempts: Math.max(1, coll.maxAttemptsPerAsset ?? 10),
            } : undefined,
            mapper,
            asset: assetSize,
            anchor: (spawnMap.rules?.anchor ?? 'center') as any,
            occupiedBoxes: occupied,
            rng,
          });
          // Translate finalX/finalY into layer offsets
          const mappedCenter = mapNormalizedToPixels(mapper, 0.5, 0.5);
          // Our compositor draws full-canvas images placed at (offsetX, offsetY).
          // For now we approximate by using the anchor point as offsets.
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

      const appliedTransforms = applyTransformRules(cfg.rules?.transforms, layerStates, ed.traits);

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
          width: cfg.image.width,
          height: cfg.image.height,
          background: cfg.image.background,
          format: outFormat,
          superSample: Number((cfg as any)?.experimental?.compositor?.superSample || 1) || 1,
          forceCpu: !!((cfg as any)?.experimental?.compositor?.forceCpu),
        },
      );

      const imageFilename = `${idx}.${outFormat}`;
      const attributes = Object.entries(ed.traits).map(([trait_type, value]) => ({ trait_type, value }));
      const files = [{ uri: `./images/${imageFilename}`, type: outFormat === 'webp' ? 'image/webp' : 'image/png' }];
      const baseJson = input.buildJson
        ? input.buildJson({
            index: idx,
            name: `${cfg.name} #${idx}`,
            symbol: cfg.symbol ?? '',
            description: cfg.description ?? '',
            imageUri: `./images/${imageFilename}`,
            attributes,
            files,
          })
        : {
            name: `${cfg.name} #${idx}`,
            symbol: cfg.symbol ?? '',
            description: cfg.description ?? '',
            image: `./images/${imageFilename}`,
            attributes,
            properties: { files, category: 'image' },
          };
      const json = {
        ...baseJson,
        dna: makeDna(ed.traits, cfg.uniqueness),
        edition: idx,
      } as Record<string, unknown>;

      await Promise.all([
        fs.writeFile(path.join(outImages, imageFilename), buffer),
        fs.writeFile(path.join(outJson, `${idx}.json`), JSON.stringify(json, null, 2)),
      ]);
      return json;
    });

    const batchResults = await Promise.allSettled(batchPromises);
    const successfulResults = batchResults
      .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled')
      .map((r) => r.value);
    allMetadata.push(...successfulResults);

    if (hooks && typeof hooks.onProgress === 'function') {
      hooks.onProgress({ current: endIdx, total: editions.length, message: `Processing batch ${batchIndex + 1}/${totalBatches}` });
    }
  }

  await fs.writeFile(path.join(outDir, '_metadata.json'), JSON.stringify(allMetadata, null, 2));
  const rarity = editions.map((e: { traits: Record<string, string> }) => ({ traits: e.traits }));
  const stats = generateRarityReport(rarity);
  await fs.writeFile(path.join(outDir, 'rarity.json'), JSON.stringify(stats, null, 2));

  return { outDir, imagesDir: outImages, jsonDir: outJson, editions };
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
