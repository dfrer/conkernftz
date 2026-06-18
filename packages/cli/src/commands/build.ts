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
    .option('--max-attempts <n>', 'max attempts per edition (uniqueness)', '500')
    .option('--animate', 'render animated output (overrides export.animation.enabled)')
    .option('--fps <n>', 'animation frames per second')
    .option('--anim-format <list>', 'comma-separated animation formats: gif,mp4,webp')
    .option('--workers <n>', 'render across N worker threads (static image builds only)', undefined)
    .option('--no-cache', 'disable the incremental build cache (force a full re-render)')
    .addHelpText(
      'afterAll',
      `
Examples:
  # Build using editionSize from config
  conkernftz build

  # Build 100 editions deterministically
  conkernftz build --count 100 --seed 42

  # Increase search attempts when rules are strict
  conkernftz build --count 250 --max-attempts 5000

  # Render a large static collection across 8 worker threads
  conkernftz build --count 10000 --workers 8

  # Force a full re-render, ignoring the incremental cache
  conkernftz build --count 100 --no-cache

  # Render animated output (requires layers with an "animation" block)
  conkernftz build --count 10 --animate --fps 15 --anim-format gif,mp4
`
    )
    .action(async (opts) => {
      const cfgPath = path.join(process.cwd(), 'foundry.config.json');
      const raw = await fs.readFile(cfgPath, 'utf8');
      const { ProjectConfigSchema } = await import('@conkernftz/core/project-config');
      const cfg = ProjectConfigSchema.parse(JSON.parse(raw));

      // CLI flags can enable/override the animation config block.
      if (opts.animate) {
        const animation = { ...(cfg.export.animation ?? {}), enabled: true };
        if (opts.fps) animation.fps = Number(opts.fps);
        if (opts.animFormat) {
          const fmts = String(opts.animFormat)
            .split(',')
            .map((s) => s.trim())
            .filter((s) => s === 'gif' || s === 'mp4' || s === 'webp') as Array<'gif' | 'mp4' | 'webp'>;
          if (fmts.length > 0) animation.format = fmts;
        }
        cfg.export.animation = animation;
      }

      const { buildCollection } = await import('@conkernftz/core/project-build');

      const count = opts.count ? Number(opts.count) : cfg.editionSize;
      const seedInput = String(opts.seed ?? 'build');
      const usedSeed = seedInput === 'random'
        ? `build:${Date.now().toString(36)}:${Math.floor(Math.random()*1e9).toString(36)}`
        : seedInput;

      // Optionally use chain adapter for JSON building when target is solana
      let buildJson: ((input: any) => Record<string, unknown>) | undefined;
      try {
        if (cfg.chain?.target === 'solana') {
          const { SolanaJsonAdapter } = await import('@conkernftz/chain-solana');
          buildJson = (input: any) => SolanaJsonAdapter.buildOffchainJson(input);
        }
      } catch {}

      const res = await buildCollection(
        {
          cwd: process.cwd(),
          config: cfg,
          count,
          seed: usedSeed,
          maxAttemptsPerEdition: Number(opts.maxAttempts ?? '500'),
          workers: opts.workers ? Number(opts.workers) : undefined,
          cache: opts.cache !== false,
          buildJson,
        },
        {
          onProgress: (p: { current: number; total: number; message?: string }) => {
            // Log progress
            console.log(`${p.current}/${p.total} ${p.message || ''}`.trim());
            // Report progress to UI if available
            if (typeof process !== 'undefined' && (process as any).send) {
              (process as any).send({ type: 'progress', ...p });
            }
          },
        },
      );
      console.log(`Built ${res.editions.length} editions to ${res.outDir}`);
    });
  return cmd;
}
