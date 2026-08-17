import * as electron from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import http from 'node:http';
import crypto from 'node:crypto';
import { getProjectDir } from './ipc-project.js';
import { dynamicImport } from './dynamic-import.js';
import type { TrustedIpcHandle } from './ipc-security.js';

const CONSOLE_MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.map': 'application/json',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

let consoleServer: http.Server | null = null;

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

export function initLaunchRunner(handle: TrustedIpcHandle): void {
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

  handle('foundry:launchReveal', async (_evt, opts: { baseUri: string; confirm?: string }) => {
    try {
      const { evm, keyPath } = loadConfig();
      const contract = requireContract(evm);
      await assertAllowed(evm.chainId, opts?.confirm);
      const { reveal } = await loadEvm();
      const txHash = await reveal(writeConfigFor(evm, keyPath, contract), opts.baseUri);
      return { ok: true, json: { txHash } };
    } catch (e) {
      return { ok: false, error: msg(e) };
    }
  });

  handle('foundry:launchFreeze', async (_evt, opts: { confirm?: string } = {}) => {
    try {
      const { evm, keyPath } = loadConfig();
      const contract = requireContract(evm);
      await assertAllowed(evm.chainId, opts?.confirm);
      const { freezeMetadata } = await loadEvm();
      const txHash = await freezeMetadata(writeConfigFor(evm, keyPath, contract));
      return { ok: true, json: { txHash } };
    } catch (e) {
      return { ok: false, error: msg(e) };
    }
  });

  handle('foundry:launchWithdraw', async (_evt, opts: { confirm?: string } = {}) => {
    try {
      const { evm, keyPath } = loadConfig();
      const contract = requireContract(evm);
      await assertAllowed(evm.chainId, opts?.confirm);
      const { withdraw } = await loadEvm();
      const txHash = await withdraw(writeConfigFor(evm, keyPath, contract));
      return { ok: true, json: { txHash } };
    } catch (e) {
      return { ok: false, error: msg(e) };
    }
  });

  handle(
    'foundry:launchSetAllowlist',
    async (_evt, opts: { text: string; format?: 'csv' | 'json'; confirm?: string }) => {
      try {
        const { evm, keyPath, raw, cfgPath } = loadConfig();
        const contract = requireContract(evm);
        await assertAllowed(evm.chainId, opts?.confirm);
        const { parseAllowlist, dumpAllowlist, setAllowlistRoot } = await loadEvm();
        const entries = parseAllowlist(opts.text, opts.format ?? 'csv');
        const dump = dumpAllowlist(entries); // throws on bad/duplicate entries
        const txHash = await setAllowlistRoot(writeConfigFor(evm, keyPath, contract), dump.root);
        // Embed the proofs in the site so the mint widget can look up a connected wallet's proof.
        if (raw.site && typeof raw.site === 'object') {
          raw.site.mint = {
            ...(raw.site.mint ?? {}),
            chainId: evm.chainId,
            rpcUrl: evm.rpcUrl,
            contractAddress: contract,
            allowlist: dump,
          };
          fs.writeFileSync(cfgPath, JSON.stringify(raw, null, 2));
        }
        return { ok: true, json: { root: dump.root, count: dump.count, txHash } };
      } catch (e) {
        return { ok: false, error: msg(e) };
      }
    },
  );

  // Serve the browser signing console at localhost and open it. Lets desktop wallet extensions
  // (MetaMask in Chrome) sign deploy/admin — the Electron app can't reach the extension, but a
  // browser page can. Same-origin API, guarded by a one-time token in the URL.
  handle('foundry:launchConsole', async () => {
    try {
      loadConfig(); // validate the project is EVM-configured before serving
      const consoleDir = path.resolve(__dirname, '..', 'launch-console');
      if (!fs.existsSync(path.join(consoleDir, 'index.html'))) {
        return { ok: false, error: 'Launch console is not built (dist/launch-console). Rebuild the app.' };
      }
      if (consoleServer) {
        consoleServer.close();
        consoleServer = null;
      }
      const token = crypto.randomBytes(16).toString('hex');
      const server = http.createServer((req, res) => {
        void handleConsoleRequest(req, res, consoleDir, token);
      });
      await new Promise<void>((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', () => resolve());
      });
      consoleServer = server;
      const addr = server.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      const url = `http://127.0.0.1:${port}/?token=${token}`;
      await electron.shell.openExternal(url);
      return { ok: true, url };
    } catch (e) {
      return { ok: false, error: msg(e) };
    }
  });
}

async function handleConsoleRequest(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  consoleDir: string,
  token: string,
): Promise<void> {
  try {
    const u = new URL(req.url || '/', 'http://127.0.0.1');
    const authed = u.searchParams.get('token') === token;

    if (u.pathname === '/api/config') {
      if (!authed) return void send(res, 403, 'text/plain', 'forbidden');
      return void send(res, 200, 'application/json', JSON.stringify(await buildConsoleConfig()));
    }
    if (u.pathname === '/api/save' && req.method === 'POST') {
      if (!authed) return void send(res, 403, 'text/plain', 'forbidden');
      const chunks: Buffer[] = [];
      for await (const ch of req) chunks.push(ch as Buffer);
      await saveFromConsole(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'));
      return void send(res, 200, 'application/json', '{"ok":true}');
    }

    // Static console files (path-traversal guarded).
    const rel = u.pathname === '/' ? 'index.html' : u.pathname.replace(/^\/+/, '');
    let filePath = path.join(consoleDir, rel);
    if (filePath !== consoleDir && !filePath.startsWith(consoleDir + path.sep)) {
      return void send(res, 403, 'text/plain', 'forbidden');
    }
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      filePath = path.join(consoleDir, 'index.html');
    }
    res.setHeader('Content-Type', CONSOLE_MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream');
    fs.createReadStream(filePath).pipe(res);
  } catch {
    send(res, 500, 'text/plain', 'error');
  }
}

function send(res: http.ServerResponse, code: number, type: string, body: string): void {
  res.statusCode = code;
  res.setHeader('Content-Type', type);
  res.end(body);
}

/** The launch config + live status the console needs (no secrets — read-only project data). */
async function buildConsoleConfig(): Promise<Record<string, unknown>> {
  const { name, symbol, evm } = loadConfig();
  const l = evm.launch ?? {};
  const out: Record<string, unknown> = {
    name,
    symbol,
    chainId: evm.chainId,
    rpcUrl: evm.rpcUrl,
    contractAddress: l.contractAddress,
    maxSupply: evm.maxSupply,
    placeholderUri: l.placeholderUri ?? '',
    provenanceHash: l.provenanceHash,
    treasury: l.treasury,
    royaltyReceiver: evm.royaltyReceiver,
    royaltyBps: evm.royaltyBps,
  };
  if (l.contractAddress) {
    try {
      const { readSaleState, formatEther } = await loadEvm();
      const s = await readSaleState({ rpcUrl: evm.rpcUrl, chainId: evm.chainId, contractAddress: l.contractAddress });
      out.status = {
        phase: s.phase,
        configLocked: s.configLocked,
        totalMinted: s.totalMinted.toString(),
        maxSupply: s.maxSupply.toString(),
        publicPriceEth: formatEther(s.publicPriceWei),
        allowlistPriceEth: formatEther(s.allowlistPriceWei),
        publicWalletCap: s.publicWalletCap.toString(),
        maxPerTx: s.maxPerTx.toString(),
        revealed: s.revealed,
        metadataFrozen: s.metadataFrozen,
      };
    } catch {
      /* status is best-effort */
    }
  }
  return out;
}

/** Persist results the console produced (a wallet-signed deploy address / allowlist proofs). */
async function saveFromConsole(data: { contractAddress?: unknown; allowlist?: unknown }): Promise<void> {
  const { raw, cfgPath, evm } = loadConfig();
  if (typeof data.contractAddress === 'string' && /^0x[0-9a-fA-F]{40}$/.test(data.contractAddress)) {
    raw.chain.evm.launch = { ...(raw.chain.evm.launch ?? {}), contractAddress: data.contractAddress };
    if (raw.site && typeof raw.site === 'object') {
      raw.site.mint = { chainId: evm.chainId, rpcUrl: evm.rpcUrl, contractAddress: data.contractAddress };
    }
  }
  if (data.allowlist && typeof data.allowlist === 'object') {
    const contract = raw.chain.evm.launch?.contractAddress;
    if (raw.site && typeof raw.site === 'object' && contract) {
      raw.site.mint = {
        ...(raw.site.mint ?? {}),
        chainId: evm.chainId,
        rpcUrl: evm.rpcUrl,
        contractAddress: contract,
        allowlist: data.allowlist,
      };
    }
  }
  fs.writeFileSync(cfgPath, JSON.stringify(raw, null, 2));
}
