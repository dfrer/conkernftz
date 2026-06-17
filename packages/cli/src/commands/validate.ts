import { Command } from 'commander';
import fs from 'node:fs/promises';
import path from 'node:path';
// Lazy import to avoid loading heavy deps on startup

export function validateCmd(): Command {
  const cmd = new Command('validate');
  cmd
    .description('Validate project configuration and assets presence')
    .addHelpText(
      'afterAll',
      `
Checks:
  - JSON schema of foundry.config.json
  - Presence of layer asset directories
  - Basic sanity of required layers

Examples:
  foundry validate
`
    )
    .action(async () => {
    const cfgPath = path.join(process.cwd(), 'foundry.config.json');
    const raw = await fs.readFile(cfgPath, 'utf8');
    const json = JSON.parse(raw);
    const { ProjectConfigSchema } = await import('@conkernftz/core/project-config');
    const parsed = ProjectConfigSchema.safeParse(json);
    if (!parsed.success) {
      console.error('Invalid config:\n', parsed.error.issues);
      process.exitCode = 1;
      return;
    }

    // Additional checks: layer assets present, required layers non-empty
    const cfg = parsed.data;
    const { loadLayerCatalog } = await import('@conkernftz/core/catalog');
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
      // Sum creators shares = 100
      if (cfg.chain?.target === 'solana' && Array.isArray(cfg.chain.solana?.creators)) {
        const sum = cfg.chain.solana.creators.reduce((acc: number, c: any) => acc + Number(c?.share || 0), 0);
        if (sum !== 100) issues.push(`ERROR: creators share must sum to 100 (got ${sum})`);
      }
      // Wallet keypair exists (Solana)
      if (cfg.chain?.target === 'solana') {
        const walletPath = cfg.chain.solana?.walletKeypairPath;
        if (!walletPath) issues.push('ERROR: chain.solana.walletKeypairPath is required');
        else {
          const p = path.isAbsolute(walletPath) ? walletPath : path.join(process.cwd(), walletPath);
          try { await fs.access(p); } catch { issues.push(`ERROR: Wallet keypair not found at ${p}`); }
        }
      }
      // Forbid GIF output (not supported end-to-end)
      if (cfg.export?.imageFormat === 'gif') {
        issues.push('ERROR: export.imageFormat "gif" is not supported. Use png or webp.');
      }
      if (issues.length > 0) {
        for (const i of issues) console.error(i);
        if (issues.some((i) => i.startsWith('ERROR'))) {
          process.exitCode = 1;
          return;
        }
      }
      // Windows OneDrive warning (can cause flaky native builds like sharp)
      if (process.platform === 'win32') {
        const cwd = process.cwd();
        if (/OneDrive/i.test(cwd)) {
          console.warn('WARN: Your project path appears to be under OneDrive. This can cause flaky native builds (e.g., sharp). Consider moving to a local path like C:\\dev\\conkernftz');
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


