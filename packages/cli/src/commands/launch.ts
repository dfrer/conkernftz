import { Command } from 'commander';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { ProjectConfig } from '@conkernftz/core';
import { assertChainAllowed, type MainnetGuardOpts } from '../lib/launchSafety.js';
import { parseAllowlist, formatFromPath } from '../lib/allowlistFile.js';

// All chain interaction is lazily imported inside actions so `--help` etc. stay fast and the
// command file itself carries no heavy deps.

interface EvmCfg {
  chainId: number;
  rpcUrl: string;
  privateKeyPath: string;
  maxSupply?: number;
  royaltyReceiver?: string;
  royaltyBps?: number;
  launch?: {
    contractAddress?: string;
    treasury?: string;
    placeholderUri?: string;
    provenanceHash?: string;
    allowlistRoot?: string;
    allowlistPriceWei?: string;
    publicPriceWei?: string;
    publicWalletCap?: number;
    maxPerTx?: number;
  };
}

async function loadEvm(): Promise<{ cfg: ProjectConfig; evm: EvmCfg; outDir: string }> {
  const cfgPath = path.join(process.cwd(), 'foundry.config.json');
  const raw = await fs.readFile(cfgPath, 'utf8');
  const { ProjectConfigSchema } = await import('@conkernftz/core/project-config');
  const cfg = ProjectConfigSchema.parse(JSON.parse(raw)) as ProjectConfig;
  if (cfg.chain.target !== 'evm') throw new Error('launch is only for EVM projects (chain.target="evm")');
  const evm = cfg.chain.evm as EvmCfg | undefined;
  if (!evm) throw new Error('chain.evm config is required');
  const outDir = path.isAbsolute(cfg.export.outDir)
    ? cfg.export.outDir
    : path.join(process.cwd(), cfg.export.outDir);
  return { cfg, evm, outDir };
}

/** Resolve the deployed launch contract address from --contract or config; throw if absent. */
function requireContract(evm: EvmCfg, optAddr?: string): string {
  const addr = optAddr || evm.launch?.contractAddress;
  if (!addr) {
    throw new Error(
      'No launch contract address. Pass --contract <addr> or set chain.evm.launch.contractAddress.',
    );
  }
  return addr;
}

function writeCfgFor(evm: EvmCfg, contractAddress: string): {
  rpcUrl: string;
  chainId: number;
  privateKeyPath: string;
  contractAddress: string;
} {
  return {
    rpcUrl: evm.rpcUrl,
    chainId: evm.chainId,
    privateKeyPath: evm.privateKeyPath,
    contractAddress,
  };
}

export function launchCmd(): Command {
  const cmd = new Command('launch');
  cmd.description('Operate the phased launch contract (ConkernftzLaunch): deploy, allowlist, phase, reveal, withdraw');

  const guard = (c: Command): Command =>
    c
      .option('--mainnet', 'acknowledge this is a mainnet (real funds)')
      .option('--confirm <token>', 'typed mainnet confirmation (the chain name / id)');

  // --- deploy ---
  guard(cmd.command('deploy'))
    .description('Deploy ConkernftzLaunch (testnet by default; gas/balance preflight)')
    .option('--dry-run', 'estimate gas + balance and stop, sending no transaction')
    .action(async (opts: MainnetGuardOpts & { dryRun?: boolean }) => {
      const { cfg, evm, outDir } = await loadEvm();
      if (!evm.maxSupply || evm.maxSupply <= 0) throw new Error('chain.evm.maxSupply must be > 0');
      const treasury = evm.launch?.treasury;
      if (!treasury) throw new Error('chain.evm.launch.treasury is required');
      const { deployLaunch, estimateLaunchDeploy, formatEther } = await import('@conkernftz/chain-evm');
      const deployCfg = {
        rpcUrl: evm.rpcUrl,
        chainId: evm.chainId,
        privateKeyPath: evm.privateKeyPath,
        name: cfg.name,
        symbol: cfg.symbol ?? '',
        maxSupply: evm.maxSupply,
        placeholderUri: evm.launch?.placeholderUri ?? '',
        provenanceHash: evm.launch?.provenanceHash as `0x${string}` | undefined,
        treasury,
        royaltyReceiver: evm.royaltyReceiver || undefined,
        royaltyBps: evm.royaltyBps,
      };

      const est = await estimateLaunchDeploy(deployCfg);
      console.log('Deploy preflight:');
      console.log(`  chain:    ${evm.chainId}`);
      console.log(`  deployer: ${est.deployer}`);
      console.log(`  balance:  ${formatEther(est.balanceWei)} ETH`);
      console.log(`  est gas:  ${est.gas} @ ${formatEther(est.gasPriceWei)} ETH  →  ~${formatEther(est.costWei)} ETH`);
      console.log(`  funded:   ${est.sufficient ? 'yes' : 'NO — insufficient balance'}`);

      if (opts.dryRun) {
        console.log('Dry run — no transaction sent.');
        return;
      }
      assertChainAllowed(evm.chainId, opts);
      if (!est.sufficient) throw new Error('Insufficient balance for deploy; fund the deployer and retry.');

      const res = await deployLaunch(deployCfg);
      await fs.writeFile(
        path.join(outDir, 'deployed-launch.json'),
        JSON.stringify({ chainId: evm.chainId, address: res.address, txHash: res.txHash }, null, 2),
      );
      console.log(`\nDeployed ConkernftzLaunch at ${res.address} (tx ${res.txHash}).`);
      console.log(`Set chain.evm.launch.contractAddress = "${res.address}" to use the other commands.`);
    });

  // --- allowlist ---
  guard(cmd.command('allowlist'))
    .description('Build the allowlist Merkle root + proofs from a CSV/JSON file; optionally set it on-chain')
    .argument('<file>', 'CSV (address,maxQty) or JSON ([{address,maxQty}] / {address:qty})')
    .option('--out <file>', 'where to write the root+proofs JSON', 'allowlist.out.json')
    .option('--set-root', 'also call setAllowlistRoot on the deployed contract')
    .option('--contract <addr>', 'contract address (else from config)')
    .action(async (file: string, opts: MainnetGuardOpts & { out: string; setRoot?: boolean; contract?: string }) => {
      const { evm } = await loadEvm();
      const text = await fs.readFile(path.resolve(file), 'utf8');
      const entries = parseAllowlist(text, formatFromPath(file));
      const { dumpAllowlist } = await import('@conkernftz/chain-evm');
      const dump = dumpAllowlist(entries);
      await fs.writeFile(path.resolve(opts.out), JSON.stringify(dump, null, 2));
      console.log(`Allowlist: ${dump.count} addresses → root ${dump.root}`);
      console.log(`Wrote proofs to ${opts.out}`);

      if (opts.setRoot) {
        const contract = requireContract(evm, opts.contract);
        assertChainAllowed(evm.chainId, opts);
        const { setAllowlistRoot } = await import('@conkernftz/chain-evm');
        const tx = await setAllowlistRoot(writeCfgFor(evm, contract), dump.root);
        console.log(`setAllowlistRoot tx: ${tx}`);
      }
    });

  // --- status (read-only) ---
  cmd
    .command('status')
    .description('Print the on-chain sale state (no key needed)')
    .option('--contract <addr>', 'contract address (else from config)')
    .action(async (opts: { contract?: string }) => {
      const { evm } = await loadEvm();
      const contract = requireContract(evm, opts.contract);
      const { readSaleState, formatEther } = await import('@conkernftz/chain-evm');
      const s = await readSaleState({ rpcUrl: evm.rpcUrl, chainId: evm.chainId, contractAddress: contract });
      console.log(`Contract:    ${contract}  (chain ${evm.chainId})`);
      console.log(`Phase:       ${s.phase}${s.configLocked ? '  [config locked]' : ''}`);
      console.log(`Minted:      ${s.totalMinted} / ${s.maxSupply}`);
      console.log(`Allowlist $: ${formatEther(s.allowlistPriceWei)} ETH    Public $: ${formatEther(s.publicPriceWei)} ETH`);
      console.log(`Caps:        publicWallet=${s.publicWalletCap}  maxPerTx=${s.maxPerTx}`);
      console.log(`Allowlist root: ${s.allowlistRoot}`);
      console.log(`Revealed:    ${s.revealed}${s.metadataFrozen ? '  [metadata frozen]' : ''}`);
      console.log(`Treasury:    ${s.treasury}`);
      console.log(`Owner:       ${s.owner}`);
    });

  // --- phase ---
  guard(cmd.command('phase'))
    .description('Advance the sale phase')
    .argument('<phase>', 'closed | allowlist | public')
    .option('--contract <addr>', 'contract address (else from config)')
    .action(async (phase: string, opts: MainnetGuardOpts & { contract?: string }) => {
      const { evm } = await loadEvm();
      const contract = requireContract(evm, opts.contract);
      assertChainAllowed(evm.chainId, opts);
      const { setPhase } = await import('@conkernftz/chain-evm');
      const tx = await setPhase(writeCfgFor(evm, contract), phase as 'closed' | 'allowlist' | 'public');
      console.log(`setPhase(${phase}) tx: ${tx}`);
    });

  // --- reveal ---
  guard(cmd.command('reveal'))
    .description('Set the revealed metadata base URI (e.g. ipfs://<cid>/)')
    .argument('<baseUri>', 'revealed base URI; token N → <baseUri>N.json')
    .option('--contract <addr>', 'contract address (else from config)')
    .action(async (baseUri: string, opts: MainnetGuardOpts & { contract?: string }) => {
      const { evm } = await loadEvm();
      const contract = requireContract(evm, opts.contract);
      assertChainAllowed(evm.chainId, opts);
      const { reveal } = await import('@conkernftz/chain-evm');
      const tx = await reveal(writeCfgFor(evm, contract), baseUri);
      console.log(`reveal tx: ${tx}`);
    });

  // --- withdraw ---
  guard(cmd.command('withdraw'))
    .description('Withdraw proceeds to the treasury')
    .option('--contract <addr>', 'contract address (else from config)')
    .action(async (opts: MainnetGuardOpts & { contract?: string }) => {
      const { evm } = await loadEvm();
      const contract = requireContract(evm, opts.contract);
      assertChainAllowed(evm.chainId, opts);
      const { withdraw } = await import('@conkernftz/chain-evm');
      const tx = await withdraw(writeCfgFor(evm, contract));
      console.log(`withdraw tx: ${tx}`);
    });

  // --- freeze metadata ---
  guard(cmd.command('freeze'))
    .description('Permanently freeze metadata (one-way; blocks further reveals)')
    .option('--contract <addr>', 'contract address (else from config)')
    .action(async (opts: MainnetGuardOpts & { contract?: string }) => {
      const { evm } = await loadEvm();
      const contract = requireContract(evm, opts.contract);
      assertChainAllowed(evm.chainId, opts);
      const { freezeMetadata } = await import('@conkernftz/chain-evm');
      const tx = await freezeMetadata(writeCfgFor(evm, contract));
      console.log(`freezeMetadata tx: ${tx}`);
    });

  return cmd;
}
