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
    .action(async (opts) => {
      const cfgPath = path.join(process.cwd(), 'foundry.config.json');
      const raw = await fs.readFile(cfgPath, 'utf8');
      const coreBase = '@foundry/core/dist/';
      const { ProjectConfigSchema } = await import(coreBase + 'project-config.js');
      const cfg = ProjectConfigSchema.parse(JSON.parse(raw));

      const { buildCollection } = await import(coreBase + 'project-build.js');

      const count = opts.count ? Number(opts.count) : cfg.editionSize;
      const seedInput = String(opts.seed ?? 'build');
      const usedSeed = seedInput === 'random'
        ? `build:${Date.now().toString(36)}:${Math.floor(Math.random()*1e9).toString(36)}`
        : seedInput;

      // Optionally use chain adapter for JSON building when target is solana
      let buildJson: ((input: any) => Record<string, unknown>) | undefined;
      try {
        if (cfg.chain?.target === 'solana') {
          const { SolanaJsonAdapter } = await import('@foundry/chain-solana');
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
