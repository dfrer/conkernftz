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
import { hashString, statFingerprint, loadBuildCache, saveBuildCache, type BuildCache } from './build-cache.js';
import { resolveWorkerCount, renderInPool } from './render-pool.js';
import type { ProjectConfig } from './project-config.js';

// Builds with at least this many editions may use worker-thread rendering (when opted in);
// below it the worker spawn overhead isn't worth it and we stay in-process.
const WORKER_THRESHOLD = 24;

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
  /** Incremental build cache: skip re-rendering unchanged editions. Default true. */
  cache?: boolean;
  /** Render across N worker threads (opt-in; default 1 = in-process). Static builds only. */
  workers?: number;
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

  // Optional parallel rendering across worker threads (opt-in via input.workers > 1), for
  // static image builds above a threshold. Generation already happened deterministically on
  // this thread, so worker results are identical regardless of order. Not for animation or
  // shuffleLayers builds.
  const shuffle = !!cfg.experimental?.generation?.shuffleLayers;
  const animEnabled = !!cfg.export.animation?.enabled;
  const workerCount = resolveWorkerCount(input.workers, editions.length);
  const useWorkers = workerCount > 1 && editions.length >= WORKER_THRESHOLD && !animEnabled && !shuffle;

  // Incremental build cache: skip re-rendering byte-identical editions. Disabled when
  // shuffleLayers is on (non-deterministic) or when workers render everything up front.
  const cacheEnabled = input.cache !== false && !shuffle && !useWorkers;
  const cache: BuildCache = cacheEnabled ? await loadBuildCache(outDir, input.seed) : { version: 1, seed: input.seed, entries: {} };
  const prevEntries = cache.entries;
  cache.entries = {}; // rebuilt fresh; only matched/rendered editions carry forward
  const fpMap = new Map<string, string>();
  if (cacheEnabled) {
    const fps = await Promise.all(
      catalog.flatMap((e) => e.options).map(async (o) => [o.filePath, await statFingerprint(o.filePath)] as const),
    );
    for (const [fp, h] of fps) fpMap.set(fp, h);
  }
  const globalHash = hashString(
    JSON.stringify({
      image: cfg.image,
      fmt: outFormat,
      ss: cfg.experimental?.compositor?.superSample ?? 1,
      cpu: !!cfg.experimental?.compositor?.forceCpu,
      anim: cfg.export.animation ?? null,
      transforms: cfg.rules?.transforms ?? null,
      spawnFit,
      spawnMap: spawnMap ?? null,
      name: cfg.name,
      symbol: cfg.symbol ?? '',
      description: cfg.description ?? '',
    }),
  );
  const mimeFor = (f: string): string =>
    f.endsWith('.mp4') ? 'video/mp4' : f.endsWith('.webp') ? 'image/webp' : f.endsWith('.gif') ? 'image/gif' : 'image/png';
  const fileExists = (p: string): Promise<boolean> => fs.stat(p).then(() => true).catch(() => false);

  // When worker rendering is enabled, render every edition image in parallel up front; the
  // batch loop below then just writes buffers + metadata.
  let preRendered: Map<number, Buffer> | null = null;
  if (useWorkers) {
    preRendered = await renderInPool(
      editions.map((ed, i) => ({
        id: i + 1,
        params: {
          config: cfg,
          picks: Array.from(ed.picks),
          traits: ed.traits,
          spawnMap,
          spawnFit,
          placementRngSeed: `${input.seed}:ed:${i + 1}`,
          assetSeedBase: `${input.seed}:${i + 1}`,
          format: outFormat,
        },
      })),
      workerCount,
    );
  }

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

      const imageFilename = `${idx}.${outFormat}`;
      const anim = cfg.export.animation;
      const animFormats = anim?.enabled ? (anim.format && anim.format.length > 0 ? anim.format : ['gif']) : [];

      // Per-edition content hash: everything renderEdition consumes plus the asset
      // fingerprints. If it matches the cache and all expected files exist, skip rendering.
      const editionHash = cacheEnabled
        ? hashString(
            globalHash +
              '|' + idx + '|' + input.seed + '|' +
              JSON.stringify(ed.traits) + '|' +
              JSON.stringify(picks.map((p) => ({ fp: p.option.filePath, b: p.option.blend, o: p.option.opacity, ox: p.option.offsetX, oy: p.option.offsetY, e: p.option.effects }))) + '|' +
              picks.map((p) => fpMap.get(p.option.filePath) ?? '?').join(','),
          )
        : '';
      const expectedFiles = [imageFilename, ...animFormats.map((f) => `${idx}.${f}`)];
      const cached =
        cacheEnabled &&
        prevEntries[String(idx)] === editionHash &&
        (await Promise.all(expectedFiles.map((f) => fileExists(path.join(outImages, f))))).every(Boolean);

      const writes: Array<Promise<void>> = [];
      const files: Array<{ uri: string; type: string }> = [
        { uri: `./images/${imageFilename}`, type: outFormat === 'webp' ? 'image/webp' : 'image/png' },
      ];
      let animationUri: string | undefined;

      if (!cached) {
        const buffer =
          preRendered?.get(idx) ??
          (await renderEdition({
            config: cfg,
            picks,
            traits: ed.traits,
            spawnMap,
            spawnFit,
            placementRngSeed: `${input.seed}:ed:${idx}`,
            assetSeedBase: `${input.seed}:${idx}`,
            format: outFormat,
          }));
        writes.push(fs.writeFile(path.join(outImages, imageFilename), buffer));
      }

      // Optional animated output: render frames once and encode each requested format
      // (skipped when the edition is cached; the files array still references them).
      if (anim?.enabled) {
        const fps = anim.fps ?? 12;
        const loop = anim.loop !== false;
        let frames: Buffer[] | null = null;
        for (const fmt of animFormats) {
          const animFilename = `${idx}.${fmt}`;
          files.push({ uri: `./images/${animFilename}`, type: mimeFor(animFilename) });
          if (!animationUri) animationUri = `./images/${animFilename}`;
          if (cached) continue;
          if (!frames) {
            frames = await renderEditionFrames({
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
          }
          let data: Buffer;
          if (fmt === 'mp4') {
            const { encodeMp4 } = await import('./animation/ffmpeg.js');
            data = await encodeMp4(frames, { fps });
          } else if (fmt === 'webp') {
            const { encodeAnimatedWebp } = await import('./animation/ffmpeg.js');
            data = await encodeAnimatedWebp(frames, { fps, loop });
          } else {
            const { encodeGif } = await import('./animation/gif.js');
            data = await encodeGif(frames, { fps, loop });
          }
          writes.push(fs.writeFile(path.join(outImages, animFilename), data));
        }
      }

      if (cacheEnabled) cache.entries[String(idx)] = editionHash;

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

  if (cacheEnabled) await saveBuildCache(outDir, cache);

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
