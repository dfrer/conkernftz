import fs from 'node:fs/promises';
import path from 'node:path';
import { loadLayerCatalog } from './catalog.js';
import { generateEditionsConstrained, type GeneratedEdition } from './generator.js';
import { loadSpawnMapFile } from './spawn.js';
import { makeDna } from './dna.js';
import { generateRarityReport } from './preview.js';
import { renderEdition } from './render-edition.js';
import { renderEditionFrames } from './animation/frames.js';
import { rankEditions } from './rarity-score.js';
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

  // Score + rank the whole collection up front so each token's metadata can
  // carry its rarity rank (rank 1 = rarest).
  const ranked = rankEditions(editions);
  const rankByEdition = new Map(ranked.tokens.map((t) => [t.edition, t]));

  const allMetadata: Array<Record<string, unknown>> = [];
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
      if (cfg.experimental?.generation?.shuffleLayers) {
        for (let k = picks.length - 1; k > 0; k--) {
          const j = Math.floor(Math.random() * (k + 1));
          const tmp = picks[k]!; picks[k] = picks[j]!; picks[j] = tmp;
        }
      }

      const buffer = await renderEdition({
        config: cfg,
        picks,
        traits: ed.traits,
        spawnMap,
        spawnFit,
        placementRngSeed: `${input.seed}:ed:${idx}`,
        assetSeedBase: `${input.seed}:${idx}`,
        format: outFormat,
      });

      const imageFilename = `${idx}.${outFormat}`;
      const writes: Array<Promise<void>> = [fs.writeFile(path.join(outImages, imageFilename), buffer)];
      const files: Array<{ uri: string; type: string }> = [
        { uri: `./images/${imageFilename}`, type: outFormat === 'webp' ? 'image/webp' : 'image/png' },
      ];

      // Optional animated output: render frames once and encode each requested format.
      let animationUri: string | undefined;
      const anim = cfg.export.animation;
      if (anim?.enabled) {
        const fps = anim.fps ?? 12;
        const loop = anim.loop !== false;
        const frames = await renderEditionFrames({
          config: cfg,
          layers: cfg.layers,
          picks,
          traits: ed.traits,
          spawnMap,
          spawnFit,
          placementRngSeed: `${input.seed}:ed:${idx}`,
          assetSeedBase: `${input.seed}:${idx}`,
          fps,
          durationMs: anim.durationMs ?? 1000,
        });
        const formats = anim.format && anim.format.length > 0 ? anim.format : ['gif'];
        for (const fmt of formats) {
          let data: Buffer;
          let mime: string;
          if (fmt === 'mp4') {
            const { encodeMp4 } = await import('./animation/ffmpeg.js');
            data = await encodeMp4(frames, { fps });
            mime = 'video/mp4';
          } else if (fmt === 'webp') {
            const { encodeAnimatedWebp } = await import('./animation/ffmpeg.js');
            data = await encodeAnimatedWebp(frames, { fps, loop });
            mime = 'image/webp';
          } else {
            const { encodeGif } = await import('./animation/gif.js');
            data = await encodeGif(frames, { fps, loop });
            mime = 'image/gif';
          }
          const animFilename = `${idx}.${fmt}`;
          writes.push(fs.writeFile(path.join(outImages, animFilename), data));
          files.push({ uri: `./images/${animFilename}`, type: mime });
          if (!animationUri) animationUri = `./images/${animFilename}`;
        }
      }

      const category = animationUri && animationUri.endsWith('.mp4') ? 'video' : 'image';
      const attributes = Object.entries(ed.traits).map(([trait_type, value]) => ({ trait_type, value }));
      const baseJson = input.buildJson
        ? input.buildJson({
            index: idx,
            name: `${cfg.name} #${idx}`,
            symbol: cfg.symbol ?? '',
            description: cfg.description ?? '',
            imageUri: `./images/${imageFilename}`,
            animationUri,
            attributes,
            files,
          })
        : {
            name: `${cfg.name} #${idx}`,
            symbol: cfg.symbol ?? '',
            description: cfg.description ?? '',
            image: `./images/${imageFilename}`,
            ...(animationUri ? { animation_url: animationUri } : {}),
            attributes,
            properties: { files, category },
          };
      const tokenRarity = rankByEdition.get(idx);
      const json = {
        ...baseJson,
        dna: makeDna(ed.traits, cfg.uniqueness),
        edition: idx,
        ...(tokenRarity
          ? { rarity: { score: Number(tokenRarity.score.toFixed(4)), rank: tokenRarity.rank } }
          : {}),
      } as Record<string, unknown>;

      writes.push(fs.writeFile(path.join(outJson, `${idx}.json`), JSON.stringify(json, null, 2)));
      await Promise.all(writes);
      return json;
    });

    const batchResults = await Promise.allSettled(batchPromises);
    const successfulResults = batchResults
      .filter((r): r is PromiseFulfilledResult<Record<string, unknown>> => r.status === 'fulfilled')
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
  // Per-token rarity scores + ranks and per-trait statistics (for tooling / UI).
  await fs.writeFile(
    path.join(outDir, 'rarity-ranks.json'),
    JSON.stringify({ editionCount: ranked.stats.editionCount, traits: ranked.stats.traits, tokens: ranked.tokens }, null, 2),
  );

  return { outDir, imagesDir: outImages, jsonDir: outJson, editions };
}
