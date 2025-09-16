import { Command } from 'commander';
import { execa } from 'execa';

export function e2eCmd(): Command {
  const cmd = new Command('e2e');
  cmd
    .description('Run end-to-end flow: validate -> preview -> build -> upload')
    .addHelpText(
      'afterAll',
      `
Runs a quick demo pipeline using defaults.

Example:
  foundry e2e
`
    )
    .action(async () => {
    await execa('node', ['dist/bin.js', 'validate'], { stdio: 'inherit' });
    await execa('node', ['dist/bin.js', 'preview', '--count', '9', '--seed', '42'], { stdio: 'inherit' });
    await execa('node', ['dist/bin.js', 'build', '--count', '10'], { stdio: 'inherit' });
    await execa('node', ['dist/bin.js', 'upload', '--provider', 'arweave', '--concurrency', '6'], { stdio: 'inherit' });
  });
  return cmd;
}


