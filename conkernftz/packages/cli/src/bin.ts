#!/usr/bin/env node
import { Command } from 'commander';
import { initCmd } from './commands/init.js';
import { validateCmd } from './commands/validate.js';
import { previewCmd } from './commands/preview.js';
import { buildCmd } from './commands/build.js';
import { uploadCmd } from './commands/upload.js';
import { mintCmd } from './commands/mint.js';
import { e2eCmd } from './commands/e2e.js';

const program = new Command();
program
  .name('foundry')
  .description('conkernftz CLI')
  .version('0.1.0');

program.addCommand(initCmd());
program.addCommand(validateCmd());
program.addCommand(previewCmd());
program.addCommand(buildCmd());
program.addCommand(uploadCmd());
program.addCommand(mintCmd());
program.addCommand(e2eCmd());

program.parseAsync(process.argv);


