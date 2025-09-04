import { Command } from 'commander';
import fs from 'node:fs/promises';
import path from 'node:path';
// Lazy import to avoid loading heavy deps on startup

export function validateCmd(): Command {
  const cmd = new Command('validate');
  cmd.description('Validate project configuration').action(async () => {
    const cfgPath = path.join(process.cwd(), 'foundry.config.json');
    const raw = await fs.readFile(cfgPath, 'utf8');
    const json = JSON.parse(raw);
    const { ProjectConfigSchema } = await import('@foundry/core/dist/project-config.js');
    const parsed = ProjectConfigSchema.safeParse(json);
    if (!parsed.success) {
      console.error('Invalid config:\n', parsed.error.issues);
      process.exitCode = 1;
      return;
    }

    // Additional checks: layer assets present, required layers non-empty
    const cfg = parsed.data;
    const coreBase = '@foundry/core/dist/';
    const { loadLayerCatalog } = await import(coreBase + 'catalog.js');
    try {
      const catalog = await loadLayerCatalog(process.cwd(), cfg.layers, {
        mode: 'filenameDelimiter',
        delimiter: cfg.rarity.delimiter,
        defaultWeight: cfg.rarity.defaultWeight,
      });
      const issues: string[] = [];
      for (const entry of catalog) {
        if (entry.options.length === 0) {
          const required = Boolean(entry.spec.required);
          const msg = `Layer "${entry.spec.name}" has no assets at path "${entry.spec.path}"`;
          issues.push(required ? `ERROR: ${msg} (layer is required)` : `WARN: ${msg}`);
        }
      }
      if (issues.length > 0) {
        for (const i of issues) console.error(i);
        if (issues.some((i) => i.startsWith('ERROR'))) {
          process.exitCode = 1;
          return;
        }
      }
      console.log('Config OK');
    } catch (err) {
      console.error('Failed to scan layers:', err);
      process.exitCode = 1;
    }
  });
  return cmd;
}


