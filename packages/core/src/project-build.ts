import fs from 'node:fs/promises';
import path from 'node:path';
import { loadLayerCatalog } from './catalog.js';
import { generateEditionsConstrained, type GeneratedEdition } from './generator.js';
import { compositeLayers } from './compositor.js';
import { makeDna } from './dna.js';
import { generateRarityReport } from './preview.js';
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

  const editions = generateEditionsConstrained(
    catalog,
    input.count,
    { seed: input.seed },
    { rules: cfg.rules ?? {}, uniqueness: cfg.uniqueness, maxAttemptsPerEdition: input.maxAttemptsPerEdition ?? 500 },
  );

  const allMetadata: any[] = [];
  const outFormat: 'png' | 'webp' = (cfg.export?.imageFormat === 'webp' ? 'webp' : 'png');

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
      const buffer = await compositeLayers(
        picks.map((p: any) => ({
          path: p.option.filePath,
          blend: p.option.blend ?? p.option.effects?.blend ?? 'normal',
          opacity: p.option.opacity ?? p.option.effects?.opacity ?? 1,
          offsetX: p.option.offsetX ?? p.option.effects?.offsetX ?? 0,
          offsetY: p.option.offsetY ?? p.option.effects?.offsetY ?? 0,
          effects: p.option.effects,
        })),
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


