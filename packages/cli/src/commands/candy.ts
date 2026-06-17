import { Command } from 'commander';
import fs from 'node:fs/promises';
import fssync from 'node:fs';
import path from 'node:path';
import type { ProjectConfig } from '@conkernftz/core';

interface LoadedSolana {
  cwd: string;
  cfg: ProjectConfig;
  outDir: string;
  solana: NonNullable<ProjectConfig['chain']['solana']>;
}

async function loadSolanaProject(): Promise<LoadedSolana> {
  const cwd = process.cwd();
  const raw = await fs.readFile(path.join(cwd, 'foundry.config.json'), 'utf8');
  const { ProjectConfigSchema } = await import('@conkernftz/core/project-config');
  const cfg = ProjectConfigSchema.parse(JSON.parse(raw)) as ProjectConfig;
  if (cfg.chain.target !== 'solana') throw new Error('candy commands require chain.target "solana"');
  const solana = cfg.chain.solana;
  if (!solana) throw new Error('chain.solana config is required');
  const outDir = path.isAbsolute(cfg.export.outDir) ? cfg.export.outDir : path.join(cwd, cfg.export.outDir);
  return { cwd, cfg, outDir, solana };
}

function assertCluster(cluster: string, mainnetAllowed: boolean): void {
  if (cluster === 'mainnet-beta' && !mainnetAllowed) {
    throw new Error('Refusing to run on mainnet-beta without --mainnet. Validate on devnet first.');
  }
}

export function candyCmd(): Command {
  const cmd = new Command('candy').description('Solana Core Candy Machine: allowlist / create / upload / mint');

  cmd
    .command('allowlist')
    .description('Compute the allowList merkle root (+ optional proofs) from an address file')
    .option('--file <path>', 'allowlist file (defaults to chain.solana.candyMachine.guards.allowList.path)')
    .option('--proofs', 'also write per-address merkle proofs', false)
    .action(async (opts) => {
      const { cwd, solana, outDir } = await loadSolanaProject();
      const file = opts.file ?? solana.candyMachine?.guards?.allowList?.path;
      if (!file) throw new Error('Provide --file or set chain.solana.candyMachine.guards.allowList.path');
      const { loadAllowlist, getAllowlistRoot, getAllowlistProof, bytesToHex } = await import('@conkernftz/chain-solana');
      const addresses = await loadAllowlist(cwd, file);
      if (addresses.length === 0) throw new Error('Allowlist is empty');
      const root = await getAllowlistRoot(addresses);
      const out: Record<string, unknown> = { count: addresses.length, root: bytesToHex(root) };
      if (opts.proofs) {
        const proofs: Record<string, string[]> = {};
        for (const a of addresses) proofs[a] = (await getAllowlistProof(addresses, a)).map(bytesToHex);
        out.proofs = proofs;
      }
      await fs.mkdir(outDir, { recursive: true });
      await fs.writeFile(path.join(outDir, 'allowlist.json'), JSON.stringify(out, null, 2));
      console.log(`Allowlist root ${out.root as string} (${addresses.length} addresses). Wrote allowlist.json`);
    });

  cmd
    .command('create')
    .description('Create the MPL Core collection + Candy Machine with guards (needs a funded wallet)')
    .option('--mainnet', 'allow mainnet-beta (otherwise devnet/testnet only)', false)
    .option('--collection-uri <uri>', 'collection metadata URI (else upload manifest baseUri)')
    .action(async (opts) => {
      const { cwd, cfg, outDir, solana } = await loadSolanaProject();
      assertCluster(solana.cluster, !!opts.mainnet);
      const meta = JSON.parse(await fs.readFile(path.join(outDir, '_metadata.json'), 'utf8')) as unknown[];
      const itemsAvailable = meta.length;
      if (itemsAvailable === 0) throw new Error('No items found in _metadata.json. Run `conkernftz build` first.');

      let collectionUri = opts.collectionUri ?? solana.candyMachine?.collectionUri ?? '';
      if (!collectionUri) {
        try {
          const man = JSON.parse(await fs.readFile(path.join(outDir, '.upload-manifest.json'), 'utf8'));
          collectionUri = man.baseUri ?? '';
        } catch {
          /* no manifest */
        }
      }
      if (!collectionUri) console.warn('Warning: no collection URI; collection metadata will be empty.');

      const cmCfg = solana.candyMachine;
      const { resolveGuards, loadAllowlist, createCandyMachine } = await import('@conkernftz/chain-solana');
      const guardsInput: Parameters<typeof resolveGuards>[0] = {};
      if (cmCfg?.guards?.solPayment) guardsInput.solPayment = cmCfg.guards.solPayment;
      if (cmCfg?.guards?.startDate) guardsInput.startDate = cmCfg.guards.startDate;
      if (cmCfg?.guards?.mintLimit) guardsInput.mintLimit = cmCfg.guards.mintLimit;
      if (cmCfg?.guards?.allowList) {
        guardsInput.allowList = { addresses: await loadAllowlist(cwd, cmCfg.guards.allowList.path) };
      }

      if (solana.rpcUrl && !process.env.SOLANA_RPC_URL) process.env.SOLANA_RPC_URL = solana.rpcUrl;
      const res = await createCandyMachine({
        walletKeypairPath: solana.walletKeypairPath,
        rpcUrl: solana.rpcUrl,
        collection: { name: cmCfg?.collectionName ?? cfg.name, uri: collectionUri },
        itemsAvailable,
        guards: resolveGuards(guardsInput),
        nameLength: cmCfg?.nameLength,
        uriLength: cmCfg?.uriLength,
      });
      await fs.writeFile(path.join(outDir, 'candy-machine.json'), JSON.stringify(res, null, 2));
      console.log(`Created candy machine ${res.candyMachine} (collection ${res.collection}). Wrote candy-machine.json`);
    });

  cmd
    .command('upload')
    .description('Insert token config lines (name + metadata URI) into the candy machine')
    .option('--mainnet', 'allow mainnet-beta', false)
    .action(async (opts) => {
      const { outDir, solana } = await loadSolanaProject();
      assertCluster(solana.cluster, !!opts.mainnet);
      const cmInfo = readJsonOrThrow(path.join(outDir, 'candy-machine.json'), 'Run `conkernftz candy create` first.');
      const meta = JSON.parse(await fs.readFile(path.join(outDir, '_metadata.json'), 'utf8')) as Array<{ name: string }>;
      const man = readJsonOrThrow(path.join(outDir, '.upload-manifest.json'), 'Run `conkernftz upload` first.');
      const metadataMap = (man.metadata ?? {}) as Record<string, string>;
      const items = meta.map((m, i) => {
        const uri = metadataMap[`${i + 1}.json`];
        if (!uri) throw new Error(`Missing uploaded URI for ${i + 1}.json in manifest.metadata`);
        return { name: m.name, uri };
      });
      if (solana.rpcUrl && !process.env.SOLANA_RPC_URL) process.env.SOLANA_RPC_URL = solana.rpcUrl;
      const { insertItems } = await import('@conkernftz/chain-solana');
      const res = await insertItems({ walletKeypairPath: solana.walletKeypairPath, rpcUrl: solana.rpcUrl, candyMachine: cmInfo.candyMachine, items });
      console.log(`Inserted ${res.inserted} config lines into ${cmInfo.candyMachine}.`);
    });

  cmd
    .command('mint')
    .description('Mint one asset from the candy machine (public phase)')
    .option('--mainnet', 'allow mainnet-beta', false)
    .action(async (opts) => {
      const { outDir, solana } = await loadSolanaProject();
      assertCluster(solana.cluster, !!opts.mainnet);
      const cmInfo = readJsonOrThrow(path.join(outDir, 'candy-machine.json'), 'Run `conkernftz candy create` first.');
      if (solana.rpcUrl && !process.env.SOLANA_RPC_URL) process.env.SOLANA_RPC_URL = solana.rpcUrl;
      const { mintFromCandyMachine } = await import('@conkernftz/chain-solana');
      const res = await mintFromCandyMachine({
        walletKeypairPath: solana.walletKeypairPath,
        rpcUrl: solana.rpcUrl,
        candyMachine: cmInfo.candyMachine,
        collection: cmInfo.collection,
        solPaymentDestination: solana.candyMachine?.guards?.solPayment?.destination,
      });
      console.log(`Minted asset ${res.asset} (sig ${res.signature}).`);
    });

  return cmd;
}

function readJsonOrThrow(file: string, hint: string): { candyMachine: string; collection: string; metadata?: Record<string, string>; baseUri?: string } {
  if (!fssync.existsSync(file)) throw new Error(`${path.basename(file)} not found. ${hint}`);
  return JSON.parse(fssync.readFileSync(file, 'utf8'));
}
