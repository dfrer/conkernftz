import { getInjectedProvider, connect, ensureChain, parseWalletError, type Eip1193Provider } from '../renderer-next/lib/mintWeb3';
import {
  walletDeploy,
  walletSend,
  waitForContractAddress,
  callSetCaps,
  callSetPrices,
  callSetPhase,
  callReveal,
  callFreeze,
  callWithdraw,
  callSetAllowlistRoot,
  type DeployInputs,
  type LaunchPhase,
} from '../renderer-next/lib/launchSign';
import { dumpAllowlist, parseAllowlist, explorerTxUrl } from '@conkernftz/chain-evm';

/**
 * ConkerNFTZ Launch console — runs in the user's browser (served at localhost by the app) so it
 * can use the injected wallet (MetaMask extension), which an Electron app can't reach. It fetches
 * the project's launch config from the app, signs deploy/admin with the browser wallet via the
 * shared launchSign logic, and posts the deployed address / allowlist proofs back to the app to
 * persist. Same-origin (served by the app), guarded by a one-time token in the URL. The DOM is
 * built with createElement/textContent only (no innerHTML).
 */

interface ConsoleStatus {
  phase: 'closed' | 'allowlist' | 'public';
  configLocked: boolean;
  totalMinted: string;
  maxSupply: string;
  publicPriceEth: string;
  allowlistPriceEth: string;
  publicWalletCap: string;
  maxPerTx: string;
  revealed: boolean;
  metadataFrozen: boolean;
}
interface ConsoleConfig {
  name: string;
  symbol: string;
  chainId: number;
  rpcUrl: string;
  contractAddress?: string;
  maxSupply: number;
  placeholderUri: string;
  provenanceHash?: `0x${string}`;
  treasury: string;
  royaltyReceiver?: string;
  royaltyBps?: number;
  status?: ConsoleStatus;
}

const token = new URLSearchParams(location.search).get('token') ?? '';
const app = document.getElementById('app')!;
let cfg: ConsoleConfig | null = null;
let provider: Eip1193Provider | null = null;
let account: `0x${string}` | null = null;
let logEl: HTMLElement | null = null;

// --- safe DOM helpers (no innerHTML) ---------------------------------------------------------
type Attrs = Record<string, string | number | boolean | ((e: Event) => void) | undefined>;
type Child = Node | string | null | undefined | false;
function h(tag: string, attrs: Attrs = {}, ...children: Child[]): HTMLElement {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = String(v);
    else if (k === 'value') (e as HTMLInputElement).value = String(v);
    else if (k === 'disabled') (e as HTMLInputElement).disabled = Boolean(v);
    else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2).toLowerCase(), v as EventListener);
    else e.setAttribute(k, String(v));
  }
  for (const c of children) {
    if (c == null || c === false) continue;
    e.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return e;
}
const inp = (attrs: Attrs = {}): HTMLInputElement => h('input', attrs) as HTMLInputElement;

function setLog(content: Node | string, cls = ''): void {
  if (!logEl) return;
  logEl.className = `muted ${cls}`;
  logEl.replaceChildren(content instanceof Node ? content : document.createTextNode(content));
}
function txLog(prefix: string, hash: string, cls = 'ok'): void {
  const url = cfg ? explorerTxUrl(cfg.chainId, hash) : undefined;
  const tail: Node = url
    ? h('a', { href: url, target: '_blank', rel: 'noreferrer' }, 'view tx')
    : h('code', {}, hash);
  setLog(h('span', {}, `${prefix} — `, tail), cls);
}

async function save(body: Record<string, unknown>): Promise<void> {
  const r = await fetch(`/api/save?token=${encodeURIComponent(token)}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`Failed to save to the app (${r.status}).`);
}

function deployInputs(): DeployInputs {
  const c = cfg!;
  return {
    name: c.name,
    symbol: c.symbol,
    maxSupply: c.maxSupply,
    placeholderUri: c.placeholderUri,
    provenanceHash: c.provenanceHash,
    treasury: c.treasury,
    royaltyReceiver: c.royaltyReceiver,
    royaltyBps: c.royaltyBps,
  };
}

async function onConnect(): Promise<void> {
  provider = getInjectedProvider();
  if (!provider) {
    setLog('No browser wallet found — install MetaMask, then reload.', 'err');
    return;
  }
  try {
    setLog('Approve the connection in your wallet…');
    const { address } = await connect(provider);
    await ensureChain(provider, cfg!.chainId, cfg!.rpcUrl);
    account = address;
    render();
  } catch (e) {
    setLog(parseWalletError(e), 'err');
  }
}

async function guarded(fn: () => Promise<void>): Promise<void> {
  if (!provider || !account) {
    setLog('Connect your wallet first.', 'err');
    return;
  }
  try {
    setLog('Confirm the transaction in your wallet…');
    await fn();
  } catch (e) {
    setLog(parseWalletError(e), 'err');
  }
}

async function doDeploy(): Promise<void> {
  await guarded(async () => {
    const hash = await walletDeploy(provider!, account!, deployInputs());
    setLog('Deploying… waiting for confirmation.');
    const address = await waitForContractAddress(cfg!.rpcUrl, hash);
    await save({ contractAddress: address });
    cfg!.contractAddress = address;
    setLog(`Deployed at ${address}`, 'ok');
    render();
  });
}

async function doWrite(data: `0x${string}`, okMsg: string): Promise<void> {
  await guarded(async () => {
    const hash = await walletSend(provider!, account!, cfg!.contractAddress!, data);
    txLog(okMsg, hash);
  });
}

async function doAllowlist(file: File | undefined): Promise<void> {
  if (!file) {
    setLog('Choose a CSV/JSON file first.', 'err');
    return;
  }
  await guarded(async () => {
    const text = await file.text();
    const dump = dumpAllowlist(parseAllowlist(text, /\.json$/i.test(file.name) ? 'json' : 'csv'));
    const hash = await walletSend(provider!, account!, cfg!.contractAddress!, callSetAllowlistRoot(dump.root));
    await save({ allowlist: dump });
    txLog(`Allowlist set (${dump.count} addresses)`, hash);
  });
}

function card(title: string, ...children: Child[]): HTMLElement {
  return h('div', { class: 'card' }, title ? h('h2', {}, title) : null, ...children);
}
function field(label: string, input: HTMLElement): HTMLElement {
  return h('div', {}, h('label', {}, label), input);
}

function render(): void {
  if (!cfg) {
    app.replaceChildren(h('p', { class: 'err' }, 'Could not load project config from the app. Reopen the console from ConkerNFTZ.'));
    return;
  }
  const c = cfg;
  const s = c.status;
  const deployed = !!c.contractAddress;
  const locked = !!s?.configLocked;
  const frozen = !!s?.metadataFrozen;
  logEl = h('p', { class: 'muted', id: 'log' });

  const head = h(
    'div',
    {},
    h('div', { class: 'kicker' }, 'Sign in browser'),
    h('h1', {}, `${c.name} — Launch console`),
    h('p', { class: 'muted' }, `Chain ${c.chainId} · `, deployed ? h('code', {}, c.contractAddress!) : 'not deployed yet'),
    card(
      '',
      account
        ? h('p', {}, 'Wallet: ', h('code', {}, account), ' ', h('span', { class: 'ok' }, 'connected'))
        : h('button', { id: 'connect', onClick: () => void onConnect() }, 'Connect wallet (MetaMask)'),
      logEl,
    ),
  );

  const sections: HTMLElement[] = [head];

  if (account && !deployed) {
    sections.push(
      card(
        'Deploy',
        h('p', { class: 'muted' }, `Deploys ${c.name} (max supply ${c.maxSupply}, treasury ${c.treasury}) — signed in your wallet.`),
        h('button', { onClick: () => void doDeploy() }, 'Deploy contract'),
      ),
    );
  } else if (account && deployed) {
    const cap = inp({ type: 'number', value: '5', disabled: locked });
    const ptx = inp({ type: 'number', value: '3', disabled: locked });
    const alp = inp({ value: '0', disabled: locked });
    const pp = inp({ value: '0.001', disabled: locked });
    const baseuri = inp({ placeholder: 'ipfs://<cid>/', disabled: frozen });
    const alFile = inp({ type: 'file', accept: '.csv,.json,.txt', disabled: locked });

    sections.push(
      card(
        'Status',
        h('p', { class: 'muted' },
          `Phase ${s?.phase ?? '?'}${locked ? ' · locked' : ''} · minted ${s?.totalMinted ?? '?'}/${s?.maxSupply ?? '?'} · public ${s?.publicPriceEth ?? '?'} ETH · caps ${s?.publicWalletCap ?? '?'}/${s?.maxPerTx ?? '?'} · revealed ${s?.revealed ? 'yes' : 'no'}`),
      ),
      card(
        `Sale setup${locked ? ' (locked)' : ''}`,
        h('div', { class: 'row' },
          field('Per-wallet cap', cap),
          field('Max per tx', ptx),
          h('button', { disabled: locked, onClick: () => void doWrite(callSetCaps(Number(cap.value), Number(ptx.value)), 'Caps set') }, 'Save caps'),
        ),
        h('div', { class: 'row' },
          field('Allowlist price (ETH)', alp),
          field('Public price (ETH)', pp),
          h('button', { disabled: locked, onClick: () => void doWrite(callSetPrices(alp.value, pp.value), 'Prices set') }, 'Save prices'),
        ),
        h('p', { style: 'margin-top:10px' },
          h('span', { class: 'muted' }, 'Phase: '),
          ...(['closed', 'allowlist', 'public'] as LaunchPhase[]).map((p) =>
            h('button', {
              class: 'ghost',
              onClick: () => {
                if (p === 'public' && !confirm('Opening Public permanently freezes prices, caps, and the allowlist root. Continue?')) return;
                void doWrite(callSetPhase(p), `Phase → ${p}`);
              },
            }, p),
          ),
        ),
      ),
      card(
        'Allowlist',
        h('p', { class: 'muted' }, 'CSV (address,maxQty) or JSON. Builds the root, sets it on-chain, embeds proofs in your site.'),
        alFile,
        h('button', { disabled: locked, onClick: () => void doAllowlist(alFile.files?.[0]) }, 'Build & set root'),
      ),
      card(
        'Reveal & metadata',
        h('div', { class: 'row' },
          field('Revealed base URI', baseuri),
          h('button', { disabled: frozen, onClick: () => void doWrite(callReveal(baseuri.value), 'Revealed') }, 'Reveal'),
          h('button', {
            class: 'ghost',
            disabled: frozen,
            onClick: () => {
              if (confirm('Freeze metadata permanently? This can never be undone.')) void doWrite(callFreeze(), 'Metadata frozen');
            },
          }, frozen ? 'Frozen' : 'Freeze'),
        ),
      ),
      card('Proceeds', h('button', { onClick: () => void doWrite(callWithdraw(), 'Withdrawn') }, 'Withdraw to treasury')),
    );
  }

  app.replaceChildren(...sections);
}

async function boot(): Promise<void> {
  try {
    const r = await fetch(`/api/config?token=${encodeURIComponent(token)}`);
    if (!r.ok) throw new Error(String(r.status));
    cfg = await r.json();
  } catch {
    cfg = null;
  }
  render();
}

void boot();
