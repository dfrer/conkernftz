import { Command } from 'commander';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { ProjectConfig, GeneratedEdition } from '@conkernftz/core';
// Defer loading heavy deps until action

export function buildCmd(): Command {
  const cmd = new Command('build');
  cmd
    .description('Produce images and local JSON in /build')
    .option('--count <n>', 'number of editions to build', undefined)
    .option('--seed <s>', 'seed for RNG')
    .action(async (opts) => {
      const cfgPath = path.join(process.cwd(), 'foundry.config.json');
      const raw = await fs.readFile(cfgPath, 'utf8');
      const coreBase = '@conkernftz/core/dist/';
      const { ProjectConfigSchema } = await import(coreBase + 'project-config.js');
      const cfg = ProjectConfigSchema.parse(JSON.parse(raw)) as ProjectConfig;

      const outBase = path.isAbsolute(cfg.export.outDir) ? cfg.export.outDir : path.join(process.cwd(), cfg.export.outDir);
      const outDir = path.resolve(outBase);
      const outImages = path.join(outDir, 'images');
      const outJson = path.join(outDir, 'json');
      await fs.mkdir(outImages, { recursive: true });
      await fs.mkdir(outJson, { recursive: true });

      const { loadLayerCatalog } = await import(coreBase + 'catalog.js');
      const { createSeededRng } = await import(coreBase + 'rng.js');
      const { generateEditionsConstrained } = await import(coreBase + 'generator.js');
      const { compositeLayers } = await import(coreBase + 'compositor.js');
      const { editionToCompositeInputs } = await import(coreBase + 'render.js');
      const { makeDna } = await import(coreBase + 'dna.js');
      const { generateRarityReport } = await import(coreBase + 'preview.js');
      const catalog = await loadLayerCatalog(
        process.cwd(),
        cfg.layers,
        {
          mode: 'filenameDelimiter',
          delimiter: cfg.rarity.delimiter,
          defaultWeight: cfg.rarity.defaultWeight,
        },
        { loadDimensions: Array.isArray(cfg.patterns) && cfg.patterns.length > 0 },
      );
      const count = opts.count ? Number(opts.count) : cfg.editionSize;
      const seed: string = typeof opts.seed === 'string' && opts.seed
        ? opts.seed
        : ('build-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8));
      // Shuffle per-layer options using a seeded RNG so that even if RNG rolls are biased early,
      // the starting order differs across runs.
      const rng = createSeededRng(seed + ':shuffle');
      function shuffleInPlace<T>(arr: T[]): void {
        for (let i = arr.length - 1; i > 0; i--) {
          const j = Math.floor(rng.next() * (i + 1));
          const ei = arr[i] as T;
          const ej = arr[j] as T;
          arr[i] = ej;
          arr[j] = ei;
        }
      }
      const shuffledCatalog = catalog.map((entry: { spec: unknown; options?: unknown[] }) => {
        const options = entry.options ? entry.options.slice() : [];
        shuffleInPlace(options);
        return { spec: entry.spec, options };
      });
      console.log(`Using seed: ${seed}`);
      const editions = generateEditionsConstrained(
        shuffledCatalog,
        count,
        { seed },
        {
          rules: cfg.rules ?? {},
          uniqueness: cfg.uniqueness,
          patterns: cfg.patterns || [],
          patternBindings: cfg.patternBindings || [],
          imageSize: { width: cfg.image.width, height: cfg.image.height },
        },
      ) as GeneratedEdition[];

      const allMetadata: Array<Record<string, unknown>> = [];
      // Clear previous outputs so new run isn't mixed with stale files
      try {
        const prev = await fs.readdir(outImages, { withFileTypes: true });
        await Promise.all(prev.filter((d)=>d.isFile()).map((d)=>fs.unlink(path.join(outImages, d.name)).catch(()=>{})));
      } catch {}
      try {
        const prev = await fs.readdir(outJson, { withFileTypes: true });
        await Promise.all(prev.filter((d)=>d.isFile()).map((d)=>fs.unlink(path.join(outJson, d.name)).catch(()=>{})));
      } catch {}
      for (let i = 0; i < editions.length; i++) {
        const ed = editions[i]!;
        const idx = i + 1;
        const buffer = await compositeLayers(editionToCompositeInputs(ed), {
          width: cfg.image.width,
          height: cfg.image.height,
          background: cfg.image.background,
        });
        const imageFilename = `${idx}.png`;
        await fs.writeFile(path.join(outImages, imageFilename), buffer);

        const attributes = Object.entries(ed.traits).map(([trait_type, value]) => ({ trait_type, value }));
        const json = {
          name: `${cfg.name} #${idx}`,
          symbol: cfg.symbol ?? '',
          description: cfg.description ?? '',
          image: `./images/${imageFilename}`,
          attributes,
          properties: { files: [{ uri: `./images/${imageFilename}`, type: 'image/png' }], category: 'image' },
          dna: makeDna(ed.traits, cfg.uniqueness),
          edition: idx,
          placements: ed.placements || [],
        };
        await fs.writeFile(path.join(outJson, `${idx}.json`), JSON.stringify(json, null, 2));
        allMetadata.push(json);
      }
      await fs.writeFile(path.join(outDir, '_metadata.json'), JSON.stringify(allMetadata, null, 2));

      // Rarity report
      const rarity = editions.map((e) => ({ traits: e.traits, seed }));
      const stats = generateRarityReport(rarity);
      await fs.writeFile(path.join(outDir, 'rarity.json'), JSON.stringify(stats, null, 2));
      console.log(`Built ${editions.length} editions to ${outDir}`);
    });
  return cmd;
}


