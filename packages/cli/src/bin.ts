#!/usr/bin/env node
import { Command } from 'commander';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { initCmd } from './commands/init.js';
import { validateCmd } from './commands/validate.js';
import { previewCmd } from './commands/preview.js';
import { buildCmd } from './commands/build.js';
import { uploadCmd } from './commands/upload.js';
import { mintCmd } from './commands/mint.js';
import { deployCmd } from './commands/deploy.js';
import { e2eCmd } from './commands/e2e.js';
import { dupesCmd } from './commands/dupes.js';
import { auditCmd } from './commands/audit.js';
import { candyCmd } from './commands/candy.js';

function readVersion(): string {
  try {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const pkgPath = path.resolve(here, '../package.json');
    const raw = fs.readFileSync(pkgPath, 'utf8');
    const v = JSON.parse(raw).version;
    return typeof v === 'string' ? v : '0.0.0';
  } catch {
    return '0.0.0';
  }
}

const program = new Command();
program
  .name('conkernftz')
  .description('conkernftz CLI')
  .version(readVersion());

program.addHelpText(
  'beforeAll',
  `
Usage: conkernftz <command> [options]

A modern NFT art foundry. Common flow:
  conkernftz init           # scaffold project
  conkernftz validate       # check config and assets
  conkernftz preview        # generate random previews
  conkernftz build          # produce images + local JSON
  conkernftz dupes          # scan build for duplicate DNA/images
  conkernftz audit          # audit layer assets for duplicates/emptiness
  conkernftz upload         # upload assets and rewrite JSON URIs
  conkernftz mint           # mint on Solana (devnet by default)

Quick help:
  conkernftz <command> --help
`
);

program.addCommand(initCmd());
program.addCommand(validateCmd());
program.addCommand(previewCmd());
program.addCommand(buildCmd());
program.addCommand(dupesCmd());
program.addCommand(auditCmd());
program.addCommand(uploadCmd());
program.addCommand(mintCmd());
program.addCommand(deployCmd());
program.addCommand(candyCmd());
program.addCommand(e2eCmd());

program.parseAsync(process.argv);


