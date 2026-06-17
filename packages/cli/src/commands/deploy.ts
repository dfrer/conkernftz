import { Command } from 'commander';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { ProjectConfig } from '@conkernftz/core';
// Lazy import the EVM SDK inside the action.

interface DeployOpts {
  baseUri?: string;
}

export function deployCmd(): Command {
  const cmd = new Command('deploy');
  cmd
    .description('Deploy the EVM ERC-721 collection contract (uses chain.evm config)')
    .option('--base-uri <uri>', 'token baseURI override (else from upload manifest or config)')
    .action(async (opts: DeployOpts) => {
      const cfgPath = path.join(process.cwd(), 'foundry.config.json');
      const raw = await fs.readFile(cfgPath, 'utf8');
      const { ProjectConfigSchema } = await import('@conkernftz/core/project-config');
      const cfg = ProjectConfigSchema.parse(JSON.parse(raw)) as ProjectConfig;
      if (cfg.chain.target !== 'evm') {
        throw new Error('deploy is only for EVM projects (set chain.target to "evm")');
      }
      const evm = cfg.chain.evm;
      if (!evm) throw new Error('chain.evm config is required');
      const outDir = path.isAbsolute(cfg.export.outDir)
        ? cfg.export.outDir
        : path.join(process.cwd(), cfg.export.outDir);

      // Resolve baseURI: CLI flag > upload manifest (dir mode) > config value.
      let baseUri = opts.baseUri || evm.baseUri || '';
      if (!opts.baseUri) {
        try {
          const man = JSON.parse(await fs.readFile(path.join(outDir, '.upload-manifest.json'), 'utf8'));
          if (man.baseUri) baseUri = man.baseUri;
        } catch {
          // no manifest; use config/flag value
        }
      }
      if (!baseUri) {
        console.warn('Warning: no baseURI resolved; deploying with empty baseURI (set later via setBaseURI).');
      }

      const { deployCollection } = await import('@conkernftz/chain-evm');
      const res = await deployCollection({
        rpcUrl: evm.rpcUrl,
        chainId: evm.chainId,
        privateKeyPath: evm.privateKeyPath,
        name: cfg.name,
        symbol: cfg.symbol ?? '',
        baseUri,
        maxSupply: evm.maxSupply,
        royaltyReceiver: evm.royaltyReceiver || undefined,
        royaltyBps: evm.royaltyBps,
      });
      await fs.writeFile(
        path.join(outDir, 'deployed.json'),
        JSON.stringify({ chainId: evm.chainId, address: res.address, txHash: res.txHash, baseUri }, null, 2),
      );
      console.log(`Deployed ConkernftzCollection at ${res.address} (tx ${res.txHash}). Wrote deployed.json.`);
    });
  return cmd;
}
