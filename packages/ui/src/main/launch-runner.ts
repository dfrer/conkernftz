import * as electron from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { getProjectDir } from './ipc-project.js';
import { dynamicImport } from './dynamic-import.js';

// Phase-L launch contract operations, in-process in the Electron main (so the renderer never
// touches keys or chain RPCs directly). Every handler reads the project's chain.evm config and
// drives the SAME @conkernftz/chain-evm adapter the CLI uses; writes sign with the configured
// deployer key. chain-evm is ESM, so it loads through the dynamicImport helper (a real import()
// not downleveled to require). Bigints are returned as decimal strings (IPC/JSON-safe). Mainnet
// writes require a typed `confirm` token — the same two-gate safeguard as the CLI.

type EvmModule = typeof import('@conkernftz/chain-evm');
const loadEvm = (): Promise<EvmModule> => dynamicImport<EvmModule>('@conkernftz/chain-evm');

interface EvmLaunchCfg {
  contractAddress?: string;
  treasury?: string;
  placeholderUri?: string;
  provenanceHash?: string;
}
interface EvmCfg {
  chainId: number;
  rpcUrl: string;
  privateKeyPath: string;
  maxSupply?: number;
  royaltyReceiver?: string;
  royaltyBps?: number;
  launch?: EvmLaunchCfg;
}

interface LoadedConfig {
  projectDir: string;
  cfgPath: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  raw: any;
  name: string;
  symbol: string;
  evm: EvmCfg;
  /** privateKeyPath resolved to an absolute path against the project dir. */
  keyPath: string;
}

const msg = (e: unknown): string => String((e as Error)?.message ?? e);

function loadConfig(): LoadedConfig {
  const projectDir = getProjectDir();
  if (!projectDir) throw new Error('No project selected.');
  const cfgPath = path.join(projectDir, 'foundry.config.json');
  const raw = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
  if (raw?.chain?.target !== 'evm') {
    throw new Error('This project is not set to EVM (set chain.target to "evm").');
  }
  const evm = raw?.chain?.evm as EvmCfg | undefined;
  if (!evm) throw new Error('chain.evm config is missing.');
  // The CLI resolves privateKeyPath against its cwd (the project dir); the app's cwd differs, so
  // resolve relative key paths against the project dir here.
  const keyPath = path.isAbsolute(evm.privateKeyPath)
    ? evm.privateKeyPath
    : path.join(projectDir, evm.privateKeyPath);
  return { projectDir, cfgPath, raw, name: raw.name, symbol: raw.symbol ?? '', evm, keyPath };
}

function requireContract(evm: EvmCfg): string {
  const addr = evm.launch?.contractAddress;
  if (!addr) throw new Error('No launch contract deployed yet — deploy first.');
  return addr;
}

/** Refuse non-testnet chains unless the caller passed the chain's confirm token (UI mainnet gate). */
async function assertAllowed(chainId: number, confirm?: string): Promise<void> {
  const { isTestnet, CHAIN_PRESETS } = await loadEvm();
  if (isTestnet(chainId)) return;
  const preset = Object.values(CHAIN_PRESETS).find((p) => p.chainId === chainId);
  const token = preset ? preset.name : String(chainId);
  if (confirm !== token) {
    throw new Error(`Mainnet operation requires confirmation. Expected token "${token}".`);
  }
}

function writeConfigFor(
  evm: EvmCfg,
  keyPath: string,
  contractAddress: string,
): { rpcUrl: string; chainId: number; privateKeyPath: string; contractAddress: string } {
  return { rpcUrl: evm.rpcUrl, chainId: evm.chainId, privateKeyPath: keyPath, contractAddress };
}

export function initLaunchRunner(): void {
  const handle = electron.ipcMain.handle.bind(electron.ipcMain);

  handle('foundry:launchStatus', async () => {
    try {
      const { evm } = loadConfig();
      const { readSaleState, formatEther, isTestnet } = await loadEvm();
      const testnet = isTestnet(evm.chainId);
      const contractAddress = evm.launch?.contractAddress;
      if (!contractAddress) {
        return { ok: true, json: { configured: false, chainId: evm.chainId, testnet } };
      }
      const s = await readSaleState({ rpcUrl: evm.rpcUrl, chainId: evm.chainId, contractAddress });
      return {
        ok: true,
        json: {
          configured: true,
          chainId: evm.chainId,
          testnet,
          contractAddress,
          phase: s.phase,
          configLocked: s.configLocked,
          totalMinted: s.totalMinted.toString(),
          maxSupply: s.maxSupply.toString(),
          allowlistPriceEth: formatEther(s.allowlistPriceWei),
          publicPriceEth: formatEther(s.publicPriceWei),
          publicWalletCap: s.publicWalletCap.toString(),
          maxPerTx: s.maxPerTx.toString(),
          revealed: s.revealed,
          metadataFrozen: s.metadataFrozen,
          treasury: s.treasury,
          owner: s.owner,
        },
      };
    } catch (e) {
      return { ok: false, error: msg(e) };
    }
  });

  handle('foundry:launchEstimate', async () => {
    try {
      const { name, symbol, evm, keyPath } = loadConfig();
      if (!evm.maxSupply || evm.maxSupply <= 0) throw new Error('chain.evm.maxSupply must be > 0.');
      if (!evm.launch?.treasury) throw new Error('chain.evm.launch.treasury is required.');
      const { estimateLaunchDeploy, formatEther, isTestnet } = await loadEvm();
      const est = await estimateLaunchDeploy({
        rpcUrl: evm.rpcUrl,
        chainId: evm.chainId,
        privateKeyPath: keyPath,
        name,
        symbol,
        maxSupply: evm.maxSupply,
        placeholderUri: evm.launch.placeholderUri ?? '',
        provenanceHash: evm.launch.provenanceHash as `0x${string}` | undefined,
        treasury: evm.launch.treasury,
        royaltyReceiver: evm.royaltyReceiver || undefined,
        royaltyBps: evm.royaltyBps,
      });
      return {
        ok: true,
        json: {
          deployer: est.deployer,
          balanceEth: formatEther(est.balanceWei),
          costEth: formatEther(est.costWei),
          sufficient: est.sufficient,
          chainId: evm.chainId,
          testnet: isTestnet(evm.chainId),
        },
      };
    } catch (e) {
      return { ok: false, error: msg(e) };
    }
  });

  handle('foundry:launchDeploy', async (_evt, opts: { confirm?: string } = {}) => {
    try {
      const { name, symbol, evm, keyPath, raw, cfgPath } = loadConfig();
      if (!evm.maxSupply || evm.maxSupply <= 0) throw new Error('chain.evm.maxSupply must be > 0.');
      if (!evm.launch?.treasury) throw new Error('chain.evm.launch.treasury is required.');
      await assertAllowed(evm.chainId, opts?.confirm);
      const { deployLaunch } = await loadEvm();
      const res = await deployLaunch({
        rpcUrl: evm.rpcUrl,
        chainId: evm.chainId,
        privateKeyPath: keyPath,
        name,
        symbol,
        maxSupply: evm.maxSupply,
        placeholderUri: evm.launch.placeholderUri ?? '',
        provenanceHash: evm.launch.provenanceHash as `0x${string}` | undefined,
        treasury: evm.launch.treasury,
        royaltyReceiver: evm.royaltyReceiver || undefined,
        royaltyBps: evm.royaltyBps,
      });
      // Persist the address: into chain.evm.launch (for the CLI/these handlers) and, if the
      // project has a site, into site.mint so the mint widget goes live automatically.
      raw.chain.evm.launch = { ...(raw.chain.evm.launch ?? {}), contractAddress: res.address };
      if (raw.site && typeof raw.site === 'object') {
        raw.site.mint = { chainId: evm.chainId, rpcUrl: evm.rpcUrl, contractAddress: res.address };
      }
      fs.writeFileSync(cfgPath, JSON.stringify(raw, null, 2));
      return { ok: true, json: { address: res.address, txHash: res.txHash } };
    } catch (e) {
      return { ok: false, error: msg(e) };
    }
  });

  handle(
    'foundry:launchSetCaps',
    async (_evt, opts: { publicWalletCap: number; maxPerTx: number; confirm?: string }) => {
      try {
        const { evm, keyPath } = loadConfig();
        const contract = requireContract(evm);
        await assertAllowed(evm.chainId, opts?.confirm);
        const { setCaps } = await loadEvm();
        const txHash = await setCaps(
          writeConfigFor(evm, keyPath, contract),
          BigInt(opts.publicWalletCap),
          Number(opts.maxPerTx),
        );
        return { ok: true, json: { txHash } };
      } catch (e) {
        return { ok: false, error: msg(e) };
      }
    },
  );

  handle(
    'foundry:launchSetPrices',
    async (_evt, opts: { allowlistEth: string; publicEth: string; confirm?: string }) => {
      try {
        const { evm, keyPath } = loadConfig();
        const contract = requireContract(evm);
        await assertAllowed(evm.chainId, opts?.confirm);
        const { setPrices, parseEther } = await loadEvm();
        const txHash = await setPrices(
          writeConfigFor(evm, keyPath, contract),
          parseEther(opts.allowlistEth),
          parseEther(opts.publicEth),
        );
        return { ok: true, json: { txHash } };
      } catch (e) {
        return { ok: false, error: msg(e) };
      }
    },
  );

  handle(
    'foundry:launchSetPhase',
    async (_evt, opts: { phase: 'closed' | 'allowlist' | 'public'; confirm?: string }) => {
      try {
        const { evm, keyPath } = loadConfig();
        const contract = requireContract(evm);
        await assertAllowed(evm.chainId, opts?.confirm);
        const { setPhase } = await loadEvm();
        const txHash = await setPhase(writeConfigFor(evm, keyPath, contract), opts.phase);
        return { ok: true, json: { txHash } };
      } catch (e) {
        return { ok: false, error: msg(e) };
      }
    },
  );
}
