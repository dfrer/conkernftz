import * as electron from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { getProjectDir } from './ipc-project.js';
import { dynamicImport } from './dynamic-import.js';

// Solana Launch parity (Core Candy Machine), in the Electron main so the renderer never touches
// keys/RPCs directly. Mirrors the EVM launch-runner (key-file signer) and the CLI `candy` command:
// status read, create (collection + CM from the built/uploaded items), insert config lines. The
// cluster `mainnet-beta` requires a typed `confirm` token — the same safeguard as the EVM mainnet
// gate. chain-solana is ESM, loaded via the dynamicImport helper.

type SolModule = typeof import('@conkernftz/chain-solana');
const loadSol = (): Promise<SolModule> => dynamicImport<SolModule>('@conkernftz/chain-solana');

const msg = (e: unknown): string => String((e as Error)?.message ?? e);

interface SolanaCmCfg {
  collectionName?: string;
  collectionUri?: string;
  nameLength?: number;
  uriLength?: number;
  guards?: {
    solPayment?: { sol: number; destination: string };
    startDate?: { date: string | number };
    mintLimit?: { id: number; limit: number };
    allowList?: { path: string };
  };
  address?: string;
  collectionAddress?: string;
}
interface SolanaCfg {
  cluster: 'devnet' | 'testnet' | 'mainnet-beta';
  rpcUrl?: string;
  walletKeypairPath: string;
  candyMachine?: SolanaCmCfg;
}
interface LoadedSolana {
  projectDir: string;
  cfgPath: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  raw: any;
  name: string;
  solana: SolanaCfg;
  outDir: string;
  /** walletKeypairPath resolved absolute against the project dir. */
  keyPath: string;
}

function loadConfig(): LoadedSolana {
  const projectDir = getProjectDir();
  if (!projectDir) throw new Error('No project selected.');
  const cfgPath = path.join(projectDir, 'foundry.config.json');
  const raw = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
  if (raw?.chain?.target !== 'solana') {
    throw new Error('This project is not set to Solana (set chain.target to "solana").');
  }
  const solana = raw?.chain?.solana as SolanaCfg | undefined;
  if (!solana) throw new Error('chain.solana config is missing.');
  const outDirCfg = raw?.export?.outDir ?? 'build';
  const outDir = path.isAbsolute(outDirCfg) ? outDirCfg : path.join(projectDir, outDirCfg);
  const keyPath = path.isAbsolute(solana.walletKeypairPath)
    ? solana.walletKeypairPath
    : path.join(projectDir, solana.walletKeypairPath);
  return { projectDir, cfgPath, raw, name: raw.name, solana, outDir, keyPath };
}

/** Refuse mainnet-beta writes unless the caller passed the confirm token (UI mainnet gate). */
function assertCluster(cluster: string, confirm?: string): void {
  if (cluster !== 'mainnet-beta') return;
  if (confirm !== 'mainnet-beta') {
    throw new Error('Mainnet-beta operation requires confirmation. Expected token "mainnet-beta".');
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function readJson(file: string): any | null {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

/** Created CM address — from config first, then candy-machine.json (the CLI's output file). */
function cmInfo(loaded: LoadedSolana): { candyMachine?: string; collection?: string } {
  const cfg = loaded.solana.candyMachine;
  if (cfg?.address) return { candyMachine: cfg.address, collection: cfg.collectionAddress };
  const j = readJson(path.join(loaded.outDir, 'candy-machine.json'));
  if (j?.candyMachine) return { candyMachine: j.candyMachine, collection: j.collection };
  return {};
}

export function initSolanaLaunchRunner(): void {
  const handle = electron.ipcMain.handle.bind(electron.ipcMain);

  handle('foundry:solanaLaunchStatus', async () => {
    try {
      const loaded = loadConfig();
      const { solana } = loaded;
      const mainnet = solana.cluster === 'mainnet-beta';
      const { candyMachine, collection } = cmInfo(loaded);
      if (!candyMachine) {
        return { ok: true, json: { configured: false, cluster: solana.cluster, mainnet } };
      }
      const { readCandyMachineState } = await loadSol();
      const s = await readCandyMachineState({ candyMachine, rpcUrl: solana.rpcUrl });
      return { ok: true, json: { configured: true, cluster: solana.cluster, mainnet, ...s, collection: s.collection ?? collection } };
    } catch (e) {
      return { ok: false, error: msg(e) };
    }
  });

  handle('foundry:solanaCreate', async (_evt, opts: { confirm?: string } = {}) => {
    try {
      const loaded = loadConfig();
      const { solana, outDir, keyPath, raw, cfgPath, name, projectDir } = loaded;
      assertCluster(solana.cluster, opts?.confirm);
      const meta = readJson(path.join(outDir, '_metadata.json'));
      const itemsAvailable = Array.isArray(meta) ? meta.length : 0;
      if (itemsAvailable === 0) throw new Error('No built items found (_metadata.json). Run Build first.');
      const cmCfg = solana.candyMachine;
      let collectionUri = cmCfg?.collectionUri ?? '';
      if (!collectionUri) {
        const man = readJson(path.join(outDir, '.upload-manifest.json'));
        collectionUri = man?.baseUri ?? '';
      }
      const { resolveGuards, loadAllowlist, createCandyMachine } = await loadSol();
      const guardsInput: Parameters<typeof resolveGuards>[0] = {};
      if (cmCfg?.guards?.solPayment) guardsInput.solPayment = cmCfg.guards.solPayment;
      if (cmCfg?.guards?.startDate) guardsInput.startDate = cmCfg.guards.startDate;
      if (cmCfg?.guards?.mintLimit) guardsInput.mintLimit = cmCfg.guards.mintLimit;
      if (cmCfg?.guards?.allowList) {
        guardsInput.allowList = { addresses: await loadAllowlist(projectDir, cmCfg.guards.allowList.path) };
      }
      const res = await createCandyMachine({
        walletKeypairPath: keyPath,
        rpcUrl: solana.rpcUrl,
        collection: { name: cmCfg?.collectionName ?? name, uri: collectionUri },
        itemsAvailable,
        guards: resolveGuards(guardsInput),
        nameLength: cmCfg?.nameLength,
        uriLength: cmCfg?.uriLength,
      });
      // Persist into config (and candy-machine.json for CLI compatibility).
      raw.chain.solana.candyMachine = {
        ...(raw.chain.solana.candyMachine ?? {}),
        address: res.candyMachine,
        collectionAddress: res.collection,
      };
      fs.writeFileSync(cfgPath, JSON.stringify(raw, null, 2));
      fs.writeFileSync(path.join(outDir, 'candy-machine.json'), JSON.stringify(res, null, 2));
      return { ok: true, json: { candyMachine: res.candyMachine, collection: res.collection, itemsAvailable } };
    } catch (e) {
      return { ok: false, error: msg(e) };
    }
  });

  handle('foundry:solanaInsertItems', async (_evt, opts: { confirm?: string } = {}) => {
    try {
      const loaded = loadConfig();
      const { solana, outDir, keyPath } = loaded;
      assertCluster(solana.cluster, opts?.confirm);
      const { candyMachine } = cmInfo(loaded);
      if (!candyMachine) throw new Error('No Candy Machine created yet — create first.');
      const meta = readJson(path.join(outDir, '_metadata.json')) as Array<{ name: string }> | null;
      if (!meta || meta.length === 0) throw new Error('No built items found (_metadata.json). Run Build first.');
      const man = readJson(path.join(outDir, '.upload-manifest.json'));
      const metadataMap = (man?.metadata ?? {}) as Record<string, string>;
      const items = meta.map((m, i) => {
        const uri = metadataMap[`${i + 1}.json`];
        if (!uri) throw new Error(`Missing uploaded URI for ${i + 1}.json — run Publish (upload) first.`);
        return { name: m.name, uri };
      });
      const { insertItems } = await loadSol();
      const res = await insertItems({ walletKeypairPath: keyPath, rpcUrl: solana.rpcUrl, candyMachine, items });
      return { ok: true, json: { inserted: res.inserted, candyMachine } };
    } catch (e) {
      return { ok: false, error: msg(e) };
    }
  });
}
