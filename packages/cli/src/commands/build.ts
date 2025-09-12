import { Command } from 'commander';
import fs from 'node:fs/promises';
import path from 'node:path';
// Defer loading heavy deps until action

export function buildCmd(): Command {
  const cmd = new Command('build');
  cmd
    .description('Produce images and local JSON in /build')
    .option('--count <n>', 'number of editions to build', undefined)
    .option('--seed <s>', "seed for RNG ('random' for a new seed per run)", 'build')
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
      const seedInput = String(opts.seed ?? 'build');
      const usedSeed = seedInput === 'random'
        ? `build:${Date.now().toString(36)}:${Math.floor(Math.random()*1e9).toString(36)}`
        : seedInput;
      const editions = generateEditionsConstrained(
        catalog,
        count,
        { seed: usedSeed },
        { rules: cfg.rules ?? {}, uniqueness: cfg.uniqueness },
      );

      const allMetadata: any[] = [];
      
      // Process images in parallel batches for better performance
      // Use more aggressive batching for larger collections
      const batchSize = Math.min(20, Math.max(5, Math.floor(editions.length / 8))); // Process in larger batches
      const totalBatches = Math.ceil(editions.length / batchSize);
      
      for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
        const startIdx = batchIndex * batchSize;
        const endIdx = Math.min(startIdx + batchSize, editions.length);
        const batch = editions.slice(startIdx, endIdx);
        
        // Process batch in parallel with better error handling
        const batchPromises = batch.map(async (ed, batchOffset) => {
          const i = startIdx + batchOffset;
          const idx = i + 1;
          
          try {
            const buffer = await compositeLayers(
              ed.picks.map((p: any) => ({
                path: p.option.filePath,
                blend: p.option.blend ?? p.option.effects?.blend ?? 'normal',
                opacity: p.option.opacity ?? p.option.effects?.opacity ?? 1,
                offsetX: p.option.offsetX ?? p.option.effects?.offsetX ?? 0,
                offsetY: p.option.offsetY ?? p.option.effects?.offsetY ?? 0,
                effects: p.option.effects,
              })),
              { width: cfg.image.width, height: cfg.image.height, background: cfg.image.background },
            );
            
            const imageFilename = `${idx}.png`;
            
            // Write files in parallel
            const [imageWrite, jsonWrite] = await Promise.all([
              fs.writeFile(path.join(outImages, imageFilename), buffer),
              (async () => {
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
                return json;
              })()
            ]);
            
            return await jsonWrite;
          } catch (error) {
            console.error(`Error processing edition ${idx}:`, error);
            throw error;
          }
        });
        
        const batchResults = await Promise.allSettled(batchPromises);
        const successfulResults = batchResults
          .filter((result): result is PromiseFulfilledResult<any> => result.status === 'fulfilled')
          .map(result => result.value);
        
        if (successfulResults.length !== batchResults.length) {
          const failedCount = batchResults.length - successfulResults.length;
          console.warn(`Warning: ${failedCount} items failed in batch ${batchIndex + 1}`);
        }
        
        allMetadata.push(...successfulResults);
        
        // Log progress
        console.log(`Processed batch ${batchIndex + 1}/${totalBatches} (${endIdx}/${editions.length} items)`);
        
        // Report progress to UI if available
        if (typeof process !== 'undefined' && process.send) {
          process.send({
            type: 'progress',
            current: endIdx,
            total: editions.length,
            message: `Processing batch ${batchIndex + 1}/${totalBatches}`
          });
        }
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
