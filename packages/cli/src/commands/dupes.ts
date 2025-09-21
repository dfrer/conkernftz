import { Command } from 'commander';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

export function dupesCmd(): Command {
  const cmd = new Command('dupes');
  cmd
    .description('Scan a built collection for duplicate DNA and images')
    .option('--dir <path>', 'build output directory (defaults to config export.outDir)')
    .option('--images', 'also hash images for pixel-identical duplicates', false)
    .option('--json', 'machine-readable JSON output', false)
    .addHelpText(
      'afterAll',
      `
Examples:
  # Check duplicates in default build dir
  foundry dupes

  # Explicit directory
  foundry dupes --dir ./build

  # Include image hashing
  foundry dupes --images
`,
    )
    .action(async (opts) => {
      const cwd = process.cwd();
      // Determine output directory
      let outDir: string;
      if (opts.dir) {
        outDir = path.isAbsolute(opts.dir) ? opts.dir : path.join(cwd, opts.dir);
      } else {
        const cfgPath = path.join(cwd, 'foundry.config.json');
        const raw = await fs.readFile(cfgPath, 'utf8');
        const { ProjectConfigSchema } = await import('@foundry/core/dist/project-config.js');
        const cfg = ProjectConfigSchema.parse(JSON.parse(raw));
        const base = path.isAbsolute(cfg.export.outDir) ? cfg.export.outDir : path.join(cwd, cfg.export.outDir);
        outDir = path.resolve(base);
      }

      const jsonDir = path.join(outDir, 'json');
      const imagesDir = path.join(outDir, 'images');
      let jsonFiles: string[] = [];
      try {
        const dirents = await fs.readdir(jsonDir, { withFileTypes: true });
        jsonFiles = dirents.filter(d => d.isFile() && /\.json$/i.test(d.name)).map(d => path.join(jsonDir, d.name));
      } catch (e) {
        const msg = `ERROR: Could not read JSON dir at ${jsonDir}. Did you run build?`;
        if (opts.json) { console.log(JSON.stringify({ ok: false, error: msg })); return; }
        console.error(msg);
        process.exitCode = 1;
        return;
      }

      // Pass 1: DNA duplicate scan
      const dnaToIndices = new Map<string, number[]>();
      const idToImageName = new Map<number, string>();
      for (const file of jsonFiles) {
        try {
          const raw = await fs.readFile(file, 'utf8');
          const meta = JSON.parse(raw) as any;
          const edition = Number(meta.edition || path.basename(file, '.json'));
          const dna = String(meta.dna || '');
          if (!dna) continue;
          const arr = dnaToIndices.get(dna) ?? [];
          arr.push(edition);
          dnaToIndices.set(dna, arr);
          const imageField: string | undefined = (meta.image || meta.properties?.files?.[0]?.uri);
          if (imageField) {
            const name = imageField.replace(/^\.\/?images\//, '');
            idToImageName.set(edition, name);
          } else {
            idToImageName.set(edition, `${edition}.png`);
          }
        } catch {}
      }

      const dnaDupes = Array.from(dnaToIndices.entries())
        .filter(([_, ids]) => ids.length > 1)
        .map(([dna, ids]) => ({ dna, editions: ids.sort((a,b)=>a-b) }));

      // Optional Pass 2: Image content hashing (sha256)
      let imageDupes: Array<{ hash: string; editions: number[] }> = [];
      if (opts.images) {
        const hashToIds = new Map<string, number[]>();
        for (const [id, name] of idToImageName) {
          const filePath = path.join(imagesDir, name);
          try {
            const buf = await fs.readFile(filePath);
            const h = createHash('sha256').update(buf).digest('hex');
            const arr = hashToIds.get(h) ?? [];
            arr.push(id);
            hashToIds.set(h, arr);
          } catch {}
        }
        imageDupes = Array.from(hashToIds.entries())
          .map(([hash, editions]) => ({ hash, editions: editions.sort((a,b)=>a-b) }))
          .filter((e) => e.editions.length > 1);
      }

      if (opts.json) {
        const ok = dnaDupes.length === 0 && imageDupes.length === 0;
        console.log(JSON.stringify({ ok, outDir, dnaDupes, imageDupes }, null, 2));
        if (!ok) process.exitCode = 1;
        return;
      }

      // Human-readable reporting
      const dupeCount = dnaDupes.length + imageDupes.length;
      if (dnaDupes.length > 0) {
        console.error('Duplicate DNA groups found:');
        for (const g of dnaDupes) console.error(`  editions [${g.editions.join(', ')}] share DNA ${g.dna.slice(0, 12)}…`);
      }
      if (imageDupes.length > 0) {
        console.error('Pixel-identical image groups found:');
        for (const g of imageDupes) console.error(`  editions [${g.editions.join(', ')}] share image hash ${g.hash.slice(0, 12)}…`);
      }

      if (dupeCount === 0) {
        console.log(`No duplicates found in ${outDir}`);
        return;
      }
      process.exitCode = 1;
    });
  return cmd;
}


