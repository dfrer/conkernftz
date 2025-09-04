import { Command } from 'commander';
import fs from 'node:fs/promises';
import path from 'node:path';
// Avoid loading heavy native deps at startup by dynamic importing in action

export function previewCmd(): Command {
  const cmd = new Command('preview');
  cmd
    .description('Generate N random previews')
    .option('--count <n>', 'number of previews', '10')
    .option('--seed <s>', 'seed for RNG', 'preview')
    .action(async (opts) => {
      const cfgPath = path.join(process.cwd(), 'foundry.config.json');
      const raw = await fs.readFile(cfgPath, 'utf8');
      const coreBase = '@foundry/core/dist/';
      const { ProjectConfigSchema } = await import(coreBase + 'project-config.js');
      const parsed = ProjectConfigSchema.parse(JSON.parse(raw));

      const { loadLayerCatalog } = await import(coreBase + 'catalog.js');
      const { generateEditionsConstrained } = await import(coreBase + 'generator.js');
      const { compositeLayers } = await import(coreBase + 'compositor.js');
      const { makeContactSheet } = await import(coreBase + 'preview.js');
      const catalog = await loadLayerCatalog(process.cwd(), parsed.layers, {
        mode: 'filenameDelimiter',
        delimiter: parsed.rarity.delimiter,
        defaultWeight: parsed.rarity.defaultWeight,
      });
      const editions = generateEditionsConstrained(
        catalog,
        Number(opts.count),
        { seed: opts.seed },
        { rules: parsed.rules ?? {}, uniqueness: parsed.uniqueness },
      );

      function normalizeOutDir(p: string): string {
        const trimmed = p.replace(/[\\/]+$/, '');
        // If user already points outDir to a path ending in preview or previews, don't append another
        if (/([\\/])(preview|previews)$/i.test(trimmed)) return trimmed;
        return path.join(trimmed, 'preview');
      }
      const previewBaseRaw = parsed.export.previewOutDir || normalizeOutDir(parsed.export.outDir);
      const outBase = path.isAbsolute(previewBaseRaw)
        ? previewBaseRaw
        : path.join(process.cwd(), previewBaseRaw);
      const outDir = path.resolve(outBase);
      await fs.mkdir(outDir, { recursive: true });

      // Always clear previous previews to guarantee fresh output set
      try {
        const dirents = await fs.readdir(outDir, { withFileTypes: true });
        await Promise.all(
          dirents
            .filter((d) => d.isFile())
            .map((d) => fs.unlink(path.join(outDir, d.name)).catch(() => {})),
        );
      } catch {}

      let idx = 1;
      const previewPaths: string[] = [];
      for (const ed of editions) {
        const buffer = await compositeLayers(
          ed.picks.map((p: any) => ({
            path: p.option.filePath,
            blend: p.option.blend ?? 'normal',
            opacity: p.option.opacity ?? 1,
          })),
          { width: parsed.image.width, height: parsed.image.height, background: parsed.image.background },
        );
        const p = path.join(outDir, `preview_${idx++}.png`);
        await fs.writeFile(p, buffer);
        previewPaths.push(p);
      }
      if (parsed.export.includePreviewContactSheet) {
        const sheet = await makeContactSheet(previewPaths, { width: 256, height: 256 }, { columns: 5, gap: 8 });
        await fs.writeFile(path.join(outDir, `contact-sheet.png`), sheet);
      }
      console.log(`Wrote ${editions.length} previews to ${outDir}`);
    });
  return cmd;
}


