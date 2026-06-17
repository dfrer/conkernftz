import { Command } from 'commander';
import fs from 'node:fs/promises';
import path from 'node:path';
// Avoid loading heavy native deps at startup by dynamic importing in action

export function previewCmd(): Command {
  const cmd = new Command('preview');
  cmd
    .description('Generate N random previews')
    .option('--count <n>', 'number of previews', '10')
    .option('--seed <s>', "seed for RNG ('random' for a new seed per run)", 'preview')
    .option('--max-attempts <n>', 'max attempts per edition (uniqueness)', '500')
    .option('--allow-duplicates', 'allow duplicate DNA in preview output')
    .addHelpText(
      'afterAll',
      `
Examples:
  # Generate 12 previews deterministically
  foundry preview --count 12 --seed demo

  # Generate 20 previews, new random seed per run
  foundry preview --count 20 --seed random

  # If rules are strict, increase search attempts or allow duplicates
  foundry preview --count 20 --max-attempts 5000
  foundry preview --count 20 --allow-duplicates
`
    )
    .action(async (opts) => {
      const cfgPath = path.join(process.cwd(), 'foundry.config.json');
      const raw = await fs.readFile(cfgPath, 'utf8');
      const coreBase = '@conkernftz/core/dist/';
      const { ProjectConfigSchema } = await import(coreBase + 'project-config.js');
      const parsed = ProjectConfigSchema.parse(JSON.parse(raw));

      const { loadLayerCatalog } = await import(coreBase + 'catalog.js');
      const { generateEditionsConstrained } = await import(coreBase + 'generator.js');
      const { makeContactSheet, renderPreviewEdition } = await import(coreBase + 'preview.js');
      const catalog = await loadLayerCatalog(process.cwd(), parsed.layers, {
        mode: 'filenameDelimiter',
        delimiter: parsed.rarity.delimiter,
        defaultWeight: parsed.rarity.defaultWeight,
      });
      const count = Number(opts.count);
      const maxAttempts = Number(opts.maxAttempts ?? '500');

      function makeConstraints(allowDupes: boolean) {
        return {
          rules: parsed.rules ?? {},
          uniqueness: allowDupes ? undefined : parsed.uniqueness,
          maxAttemptsPerEdition: maxAttempts,
        } as const;
      }

      const seedInput = String(opts.seed ?? 'preview');
      const usedSeed = seedInput === 'random'
        ? `preview:${Date.now().toString(36)}:${Math.floor(Math.random()*1e9).toString(36)}`
        : seedInput;
      let editions;
      try {
        editions = generateEditionsConstrained(catalog, count, { seed: usedSeed }, makeConstraints(!!opts.allowDuplicates));
      } catch (e) {
        // If uniqueness is the culprit and user did not explicitly allow duplicates, fall back for previews only.
        const wantsDupes = !!opts.allowDuplicates;
        if (!wantsDupes) {
          console.warn(String(e));
          console.warn('Falling back to allowing duplicates for preview generation...');
          editions = generateEditionsConstrained(catalog, count, { seed: usedSeed }, makeConstraints(true));
        } else {
          throw e;
        }
      }

      function normalizeOutDir(p: string): string {
        const trimmed = p.replace(/[\\/]+$/, '');
        // If user already points outDir to a path ending in preview or previews, don't append another
        if (/([\\/])(preview|previews)$/i.test(trimmed)) return trimmed;
        return path.join(trimmed, 'preview');
      }
      // If a previewOutDir is provided, treat it as a base and ensure it ends with /preview
      const previewBaseRaw = parsed.export.previewOutDir
        ? normalizeOutDir(parsed.export.previewOutDir)
        : normalizeOutDir(parsed.export.outDir);
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
      const outFormat = (parsed.export?.imageFormat === 'webp' ? 'webp' : 'png') as 'png' | 'webp';
      const bufs = await renderPreviewEdition(process.cwd(), parsed as any, usedSeed, editions.length);
      for (const buffer of bufs) {
        const p = path.join(outDir, `preview_${idx++}.${outFormat}`);
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
