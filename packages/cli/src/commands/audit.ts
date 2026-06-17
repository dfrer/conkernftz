import { Command } from 'commander';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

async function getAllImageFiles(dir: string): Promise<string[]> {
  const out: string[] = [];
  async function walk(p: string): Promise<void> {
    const dirents = await fs.readdir(p, { withFileTypes: true });
    for (const d of dirents) {
      const full = path.join(p, d.name);
      if (d.isDirectory()) await walk(full);
      else if (/\.(png|webp|gif)$/i.test(d.name)) out.push(full);
    }
  }
  await walk(dir);
  return out;
}

export function auditCmd(): Command {
  const cmd = new Command('audit');
  cmd
    .description('Audit layer assets: duplicate content, near-empty images, dimensions')
    .option('--dir <path>', 'project directory (defaults to cwd)')
    .option('--layers <rel>', 'layers directory relative to project root', 'Layers')
    .option('--empty-threshold <pct>', 'alpha-empty threshold percent (0-100)', '98')
    .option('--json', 'machine-readable JSON output', false)
    .addHelpText(
      'afterAll',
      `
Checks performed:
  - Duplicate files by content hash (across all layers)
  - Near-empty/transparent images by alpha coverage
  - Image dimensions report

Examples:
  foundry audit
  foundry audit --dir e:/path/to/NASAID --layers Layers --empty-threshold 99
`,
    )
    .action(async (opts) => {
      const projectDir = opts.dir ? (path.isAbsolute(opts.dir) ? opts.dir : path.join(process.cwd(), opts.dir)) : process.cwd();
      const layersDir = path.join(projectDir, String(opts.layers || 'Layers'));
      const emptyThreshold = Math.max(0, Math.min(100, Number(opts.emptyThreshold ?? '98')));

      // Collect files
      let files: string[] = [];
      try {
        files = await getAllImageFiles(layersDir);
      } catch {
        console.error(`ERROR: Unable to read layers directory at ${layersDir}`);
        process.exitCode = 1;
        return;
      }
      if (files.length === 0) {
        console.warn('No image files found under', layersDir);
        return;
      }

      // Hash duplicates
      const hashToFiles = new Map<string, string[]>();
      for (const f of files) {
        try {
          const buf = await fs.readFile(f);
          const h = createHash('sha256').update(buf).digest('hex');
          const arr = hashToFiles.get(h) ?? [];
          arr.push(f);
          hashToFiles.set(h, arr);
        } catch {}
      }
      const duplicateGroups = Array.from(hashToFiles.values()).filter((arr) => arr.length > 1);

      // Near-empty check and dimensions via sharp (lazy import)
      const sharp = (await import('sharp')).default;
      const empties: Array<{ file: string; alphaCoveragePct: number; width: number; height: number }> = [];
      const dims: Array<{ file: string; width: number; height: number }> = [];
      for (const f of files) {
        try {
          const img = sharp(f).ensureAlpha();
          const md = await img.metadata();
          const w = md.width || 0;
          const h = md.height || 0;
          dims.push({ file: f, width: w, height: h });
          const raw = await img.raw().toBuffer();
          // Compute alpha coverage percentage: fraction of pixels with alpha > 0
          let nonZero = 0;
          for (let i = 3; i < raw.length; i += 4) {
            if (raw[i] !== 0) nonZero++;
          }
          const total = Math.max(1, w * h);
          const coveragePct = (nonZero / total) * 100;
          if (coveragePct <= (100 - emptyThreshold)) {
            empties.push({ file: f, alphaCoveragePct: coveragePct, width: w, height: h });
          }
        } catch {}
      }

      // Dimensions summary
      const bySize = new Map<string, number>();
      for (const d of dims) {
        const key = `${d.width}x${d.height}`;
        bySize.set(key, (bySize.get(key) ?? 0) + 1);
      }

      if (opts.json) {
        const result = {
          duplicates: duplicateGroups.map((g) => g.map((f) => path.relative(projectDir, f))),
          empties: empties.map((e) => ({ file: path.relative(projectDir, e.file), alphaCoveragePct: e.alphaCoveragePct, width: e.width, height: e.height })),
          dimensions: Array.from(bySize.entries()).map(([size, count]) => ({ size, count })),
        };
        const ok = duplicateGroups.length === 0 && empties.length === 0;
        console.log(JSON.stringify({ ok, ...result }, null, 2));
        if (!ok) process.exitCode = 1;
        return;
      }

      // Human-readable report
      if (duplicateGroups.length === 0 && empties.length === 0) {
        console.log('Audit OK: no duplicate files or near-empty images detected.');
      } else {
        if (duplicateGroups.length > 0) {
          console.error('Duplicate content groups (by SHA-256):');
          for (const group of duplicateGroups) {
            console.error('  GROUP:');
            for (const f of group) console.error('   ', path.relative(projectDir, f));
          }
        }
        if (empties.length > 0) {
          console.error('Near-empty images (low alpha coverage):');
          for (const e of empties) {
            console.error(`  ${path.relative(projectDir, e.file)}  coverage=${e.alphaCoveragePct.toFixed(2)}%  ${e.width}x${e.height}`);
          }
        }
        process.exitCode = 1;
      }

      console.log('Dimensions summary:');
      for (const [k, v] of Array.from(bySize.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10)) {
        console.log(`  ${k}: ${v}`);
      }
    });
  return cmd;
}


