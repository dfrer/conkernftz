import { Command } from 'commander';
import fs from 'node:fs/promises';
import path from 'node:path';
// Lazy import to avoid heavy deps at startup

export function mintCmd(): Command {
  const cmd = new Command('mint');
  cmd
    .description('Mint NFTs on Solana devnet using Umi + Token Metadata')
    .option('--count <n>', 'number to mint', '1')
    .option('--from <n>', 'start index (1-based)', '1')
    .action(async (opts) => {
      const cfgPath = path.join(process.cwd(), 'foundry.config.json');
      const raw = await fs.readFile(cfgPath, 'utf8');
      const { ProjectConfigSchema } = await import('@foundry/core/dist/project-config.js');
      const cfg = ProjectConfigSchema.parse(JSON.parse(raw));
      const outDir = path.join(process.cwd(), cfg.export.outDir);
      const manifestPath = path.join(outDir, '.upload-manifest.json');
      try {
        await fs.access(manifestPath);
      } catch {
        console.error('Upload manifest not found. Run `foundry upload` first.');
        return;
      }
      // Configure RPC endpoint from config if present
      const rpcFromConfig = cfg.chain.solana?.rpcUrl;
      if (rpcFromConfig && !process.env.SOLANA_RPC_URL) {
        process.env.SOLANA_RPC_URL = rpcFromConfig;
      }

      // Read URIs to mint via _metadata.json ordering
      const metadata = JSON.parse(await fs.readFile(path.join(outDir, '_metadata.json'), 'utf8'));
      const uploadManifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
      const { SolanaMintAdapter } = await import('@foundry/chain-solana');
      const start = Math.max(1, Number(opts.from));
      const count = Math.min(Number(opts.count), metadata.length - (start - 1));
      const minted: Array<{ index: number; name: string; mint: string; metadataPda: string; jsonUri: string }> = [];
      for (let i = 0; i < count; i++) {
        const idx = start - 1 + i;
        const item = metadata[idx];
        const jsonFilename = `${idx + 1}.json`;
        const jsonUri = uploadManifest.metadata?.[jsonFilename];
        if (!jsonUri) {
          console.error(`Missing JSON URI for ${jsonFilename} in manifest. Make sure you uploaded JSON files.`);
          continue;
        }
        const res = await SolanaMintAdapter.mint!({
          wallet: cfg.chain.solana!.walletKeypairPath,
          jsonUri,
          name: item.name,
          symbol: cfg.symbol,
          sellerFeeBasisPoints: cfg.chain.solana!.sellerFeeBasisPoints,
          creators: cfg.chain.solana!.creators,
          collectionMint: cfg.chain.solana!.collection.mint,
          isMutable: cfg.chain.solana!.isMutable,
          usePnft: cfg.chain.solana!.usePnft,
          rulesetPda: cfg.chain.solana!.rulesetPda ?? null,
        });
        minted.push({ index: idx + 1, name: item.name, mint: res.mint, metadataPda: res.metadataPda, jsonUri });
      }
      if (minted.length > 0) {
        await fs.writeFile(path.join(outDir, 'minted.json'), JSON.stringify({ network: cfg.chain.solana!.cluster, items: minted }, null, 2));
      }
      console.log(`Minted ${minted.length} items on ${cfg.chain.solana!.cluster} starting at index ${start}.`);
    });
  return cmd;
}


