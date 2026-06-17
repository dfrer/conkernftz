import { Command } from 'commander';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { ProjectConfig } from '@conkernftz/core';
// Lazy import heavy chain SDKs inside the action.

interface MintOpts {
  count: string;
  from: string;
  to?: string;
}

export function mintCmd(): Command {
  const cmd = new Command('mint');
  cmd
    .description('Mint NFTs on the configured chain (Solana via Umi, or EVM owner-mint)')
    .option('--count <n>', 'number to mint', '1')
    .option('--from <n>', '(Solana) start index, 1-based', '1')
    .option('--to <address>', '(EVM) recipient address; defaults to the deployer')
    .addHelpText(
      'afterAll',
      `
Notes:
  - Solana: requires a prior 'conkernftz upload' (.upload-manifest.json); uses chain.solana config
  - EVM: requires a prior 'conkernftz deploy' (deployed.json) or chain.evm.contractAddress
`,
    )
    .action(async (opts: MintOpts) => {
      const cfgPath = path.join(process.cwd(), 'foundry.config.json');
      const raw = await fs.readFile(cfgPath, 'utf8');
      const { ProjectConfigSchema } = await import('@conkernftz/core/project-config');
      const cfg = ProjectConfigSchema.parse(JSON.parse(raw)) as ProjectConfig;
      const outDir = path.isAbsolute(cfg.export.outDir)
        ? cfg.export.outDir
        : path.join(process.cwd(), cfg.export.outDir);

      if (cfg.chain.target === 'evm') {
        await mintEvm(cfg, outDir, opts);
      } else {
        await mintSolana(cfg, outDir, opts);
      }
    });
  return cmd;
}

async function mintSolana(cfg: ProjectConfig, outDir: string, opts: MintOpts): Promise<void> {
  const solana = cfg.chain.solana;
  if (!solana) throw new Error('chain.solana config is required when chain.target is "solana"');

  const manifestPath = path.join(outDir, '.upload-manifest.json');
  try {
    await fs.access(manifestPath);
  } catch {
    console.error('Upload manifest not found. Run `conkernftz upload` first.');
    return;
  }
  if (solana.rpcUrl && !process.env.SOLANA_RPC_URL) {
    process.env.SOLANA_RPC_URL = solana.rpcUrl;
  }

  const metadata = JSON.parse(await fs.readFile(path.join(outDir, '_metadata.json'), 'utf8'));
  const uploadManifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
  const { SolanaMintAdapter } = await import('@conkernftz/chain-solana');
  if (!SolanaMintAdapter.mint) throw new Error('Solana mint adapter is unavailable');

  const start = Math.max(1, Number(opts.from));
  const count = Math.min(Number(opts.count), metadata.length - (start - 1));
  const minted: Array<{ index: number; name: string; mint: string; metadataPda: string; jsonUri: string }> = [];
  for (let i = 0; i < count; i++) {
    const idx = start - 1 + i;
    const item = metadata[idx];
    const jsonFilename = `${idx + 1}.json`;
    const jsonUri = uploadManifest.metadata?.[jsonFilename];
    if (!jsonUri) {
      console.error(`Missing JSON URI for ${jsonFilename} in manifest. Upload JSON files first.`);
      continue;
    }
    const res = await SolanaMintAdapter.mint({
      wallet: solana.walletKeypairPath,
      jsonUri,
      name: item.name,
      symbol: cfg.symbol,
      sellerFeeBasisPoints: solana.sellerFeeBasisPoints,
      creators: solana.creators,
      collectionMint: solana.collection.mint,
      isMutable: solana.isMutable,
      usePnft: solana.usePnft,
      rulesetPda: solana.rulesetPda ?? null,
    });
    minted.push({ index: idx + 1, name: item.name, mint: res.mint, metadataPda: res.metadataPda, jsonUri });
  }
  if (minted.length > 0) {
    await fs.writeFile(
      path.join(outDir, 'minted.json'),
      JSON.stringify({ network: solana.cluster, items: minted }, null, 2),
    );
  }
  console.log(`Minted ${minted.length} item(s) on ${solana.cluster} starting at index ${start}.`);
}

async function mintEvm(cfg: ProjectConfig, outDir: string, opts: MintOpts): Promise<void> {
  const evm = cfg.chain.evm;
  if (!evm) throw new Error('chain.evm config is required when chain.target is "evm"');

  let contractAddress = evm.contractAddress;
  if (!contractAddress) {
    try {
      const dep = JSON.parse(await fs.readFile(path.join(outDir, 'deployed.json'), 'utf8'));
      contractAddress = dep.address;
    } catch {
      // no deployed.json; fall through to the error below
    }
  }
  if (!contractAddress) {
    throw new Error('No EVM contract address. Run `conkernftz deploy` first or set chain.evm.contractAddress.');
  }

  const { ownerMint } = await import('@conkernftz/chain-evm');
  const quantity = Math.max(1, Number(opts.count));
  const res = await ownerMint(
    { rpcUrl: evm.rpcUrl, chainId: evm.chainId, privateKeyPath: evm.privateKeyPath, contractAddress },
    quantity,
    opts.to,
  );
  await fs.writeFile(
    path.join(outDir, 'minted.json'),
    JSON.stringify(
      { chainId: evm.chainId, contractAddress, txHash: res.txHash, fromTokenId: res.fromTokenId, count: res.count },
      null,
      2,
    ),
  );
  console.log(
    `Owner-minted ${res.count} token(s) on chain ${evm.chainId} (tx ${res.txHash}). ` +
      `Token ids ${res.fromTokenId}..${res.fromTokenId + res.count - 1}.`,
  );
}
