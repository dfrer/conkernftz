import { Command } from 'commander';
import fs from 'node:fs/promises';
import path from 'node:path';
// Defer loading heavy deps until action

export function buildCmd(): Command {
  const cmd = new Command('build');
  cmd
    .description('Produce images and local JSON in /build')
    .option('--count <n>', 'number of editions to build', undefined)
    .action(async (opts) => {
      const cfgPath = path.join(process.cwd(), 'foundry.config.json');
      const raw = await fs.readFile(cfgPath, 'utf8');
      const coreBase = '@foundry/core/dist/';
      const { ProjectConfigSchema } = await import(coreBase + 'project-config.js');
      const cfg = ProjectConfigSchema.parse(JSON.parse(raw));

      const outBase = path.isAbsolute(cfg.export.outDir) ? cfg.export.outDir : path.join(process.cwd(), cfg.export.outDir);
      const outDir = path.resolve(outBase);
      const outImages = path.join(outDir, 'images');
      const outJson = path.join(outDir, 'json');
      await fs.mkdir(outImages, { recursive: true });
      await fs.mkdir(outJson, { recursive: true });

      const { loadLayerCatalog } = await import(coreBase + 'catalog.js');
      const { generateEditionsConstrained } = await import(coreBase + 'generator.js');
      const { compositeLayers } = await import(coreBase + 'compositor.js');
      const { makeDna } = await import(coreBase + 'dna.js');
      const { generateRarityReport } = await import(coreBase + 'preview.js');
      const catalog = await loadLayerCatalog(process.cwd(), cfg.layers, {
        mode: 'filenameDelimiter',
        delimiter: cfg.rarity.delimiter,
        defaultWeight: cfg.rarity.defaultWeight,
      });
      const count = opts.count ? Number(opts.count) : cfg.editionSize;
      const editions = generateEditionsConstrained(
        catalog,
        count,
        { seed: 'build' },
        { rules: cfg.rules ?? {}, uniqueness: cfg.uniqueness },
      );

      const allMetadata: any[] = [];
      for (let i = 0; i < editions.length; i++) {
        const ed = editions[i]!;
        const idx = i + 1;
        const buffer = await compositeLayers(
          ed.picks.map((p: any) => ({
            path: p.option.filePath,
            blend: p.option.blend ?? 'normal',
            opacity: p.option.opacity ?? 1,
          })),
          { width: cfg.image.width, height: cfg.image.height, background: cfg.image.background },
        );
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
        };
        await fs.writeFile(path.join(outJson, `${idx}.json`), JSON.stringify(json, null, 2));
        allMetadata.push(json);
      }
      await fs.writeFile(path.join(outDir, '_metadata.json'), JSON.stringify(allMetadata, null, 2));

      // Rarity report
      const rarity = editions.map((e: { traits: Record<string, string> }) => ({ traits: e.traits }));
      const stats = generateRarityReport(rarity);
      await fs.writeFile(path.join(outDir, 'rarity.json'), JSON.stringify(stats, null, 2));
      console.log(`Built ${editions.length} editions to ${outDir}`);
    });
  return cmd;
}


