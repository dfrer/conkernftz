import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Panel } from '../components/Panel';
import { StageHeader } from '../components/StageHeader';
import { Button } from '../components/Button';
import { Field, Input } from '../components/Field';
import { Badge } from '../components/Badge';
import { EmptyState } from '../components/EmptyState';
import { useToast } from '../components/Toast';
import { bridge, isBridged, type LaunchStatus, type LaunchEstimate } from '../lib/bridge';
import { dumpAllowlist, parseAllowlist } from '@conkernftz/chain-evm';
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
} from '../lib/launchSign';
import type { WalletSession } from '../lib/walletConnect';
import { getProjectId, setProjectId } from '../lib/walletConnectSettings';

type OpResult = { ok: boolean; error?: string; json?: unknown };

/**
 * Launch stage — deploy and operate the on-chain mint contract without touching a terminal.
 * Every action calls a `foundry:launch*` IPC handler (which drives the tested chain-evm adapter
 * with the project's configured deployer key). Mainnet writes require typing the chain's confirm
 * token; testnets are free. This is slice 1: status + deploy + caps/prices/phase (the path to a
 * mintable contract). Reveal / withdraw / allowlist land next.
 */
export function LaunchScreen({ onNavigate }: { onNavigate?: (stage: string) => void }) {
  const toast = useToast();
  const [status, setStatus] = useState<LaunchStatus | null>(null);
  const [statusErr, setStatusErr] = useState<string | null>(null);
  const [estimate, setEstimate] = useState<LaunchEstimate | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const [walletCap, setWalletCap] = useState('5');
  const [maxPerTx, setMaxPerTx] = useState('3');
  const [allowlistEth, setAllowlistEth] = useState('0');
  const [publicEth, setPublicEth] = useState('0.001');
  const [confirmToken, setConfirmToken] = useState('');
  const [baseUri, setBaseUri] = useState('');
  const [allowlist, setAllowlist] = useState<{ name: string; text: string; format: 'csv' | 'json' } | null>(null);
  // Upload manifest (.upload-manifest.json) — its baseURI auto-fills the reveal field so the
  // operator never has to hand-copy a CID from Publish.
  const [manifest, setManifest] = useState<{ baseUri?: string } | null>(null);

  // Signer: 'keyfile' goes through the IPC handlers (configured deployer key); 'wallet' signs
  // every tx in the user's own wallet via WalletConnect (non-custodial, no key file).
  const [signer, setSigner] = useState<'keyfile' | 'wallet'>('keyfile');
  const [wcProjectId, setWcProjectId] = useState<string>(() => getProjectId());
  const [session, setSession] = useState<WalletSession | null>(null);
  // Raw project config (for the wallet path's deploy inputs + persisting the address).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [cfg, setCfg] = useState<any>(null);

  const refresh = useCallback(async () => {
    const fb = bridge();
    if (!fb) return;
    const [s, c] = await Promise.all([fb.launchStatus(), fb.readConfig()]);
    if (s.ok && s.json) {
      setStatus(s.json);
      setStatusErr(null);
    } else {
      setStatus(null);
      setStatusErr(s.error ?? 'Could not read contract status.');
    }
    if (c.ok && c.json) {
      setCfg(c.json);
      // Read the upload manifest so the reveal step can offer the uploaded metadata baseURI.
      // Best-effort: a missing/unreadable manifest just means no pre-fill (never breaks refresh).
      try {
        const outDir = (c.json as { export?: { outDir?: string } })?.export?.outDir ?? 'build';
        const m = await fb.readFile(`${outDir}/.upload-manifest.json`);
        setManifest(m?.ok && m.content ? JSON.parse(m.content) : null);
      } catch {
        setManifest(null);
      }
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Once the manifest is known, pre-fill the (still-empty) reveal base URI from it. The operator
  // can still edit it; we never overwrite a value they've typed or an already-revealed contract.
  useEffect(() => {
    if (manifest?.baseUri && !baseUri && !status?.revealed) setBaseUri(manifest.baseUri);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manifest]);

  if (!isBridged()) {
    return (
      <>
        <StageHeader kicker="DEPLOY" title="Launch" />
        <EmptyState code="NO BRIDGE" title="Desktop app required" hint="Deploying and managing the mint contract runs in the ConkerNFTZ desktop app." />
      </>
    );
  }

  const onTestnet = status ? status.testnet : true;
  // Mainnet writes need the typed confirm token; testnet writes pass nothing.
  const confirm = onTestnet ? undefined : confirmToken;
  const deployed = !!status?.configured;

  async function act(
    label: string,
    fn: () => Promise<{ ok: boolean; error?: string; json?: unknown }>,
    okMsg: string,
  ): Promise<void> {
    setBusy(label);
    try {
      const r = await fn();
      if (r.ok) {
        toast.push(okMsg, 'ok');
        await refresh();
      } else {
        toast.push(r.error ?? 'Action failed', 'danger');
      }
    } catch (e) {
      toast.push(String((e as Error)?.message ?? e), 'danger');
    } finally {
      setBusy(null);
    }
  }

  const onPreflight = async (): Promise<void> => {
    setBusy('preflight');
    try {
      const r = await bridge()!.launchEstimate();
      if (r.ok && r.json) setEstimate(r.json);
      else toast.push(r.error ?? 'Preflight failed', 'danger');
    } finally {
      setBusy(null);
    }
  };

  // --- wallet (WalletConnect) signing path -----------------------------------------------------
  const deployInputs = (): DeployInputs => {
    const evm = cfg.chain.evm;
    const l = evm.launch ?? {};
    return {
      name: cfg.name,
      symbol: cfg.symbol ?? '',
      maxSupply: evm.maxSupply,
      placeholderUri: l.placeholderUri ?? '',
      provenanceHash: l.provenanceHash,
      treasury: l.treasury,
      royaltyReceiver: evm.royaltyReceiver,
      royaltyBps: evm.royaltyBps,
    };
  };

  async function wDeploy(): Promise<OpResult> {
    if (!session || !cfg) return { ok: false, error: 'Connect your wallet first.' };
    const evm = cfg.chain.evm;
    const txHash = await walletDeploy(session.provider, session.address, deployInputs());
    const address = await waitForContractAddress(evm.rpcUrl, txHash);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const c = (await bridge()!.readConfig()).json as any;
    c.chain.evm.launch = { ...(c.chain.evm.launch ?? {}), contractAddress: address };
    if (c.site && typeof c.site === 'object') {
      c.site.mint = { chainId: evm.chainId, rpcUrl: evm.rpcUrl, contractAddress: address };
    }
    await bridge()!.writeConfig(c);
    return { ok: true, json: { address } };
  }

  async function wWrite(data: `0x${string}`, valueWei = 0n): Promise<OpResult> {
    if (!session) return { ok: false, error: 'Connect your wallet first.' };
    const contract = status?.contractAddress;
    if (!contract) return { ok: false, error: 'No contract deployed.' };
    const txHash = await walletSend(session.provider, session.address, contract, data, valueWei);
    return { ok: true, json: { txHash } };
  }

  async function wAllowlist(text: string, format: 'csv' | 'json'): Promise<OpResult> {
    if (!session || !cfg) return { ok: false, error: 'Connect your wallet first.' };
    const contract = status?.contractAddress;
    if (!contract) return { ok: false, error: 'No contract deployed.' };
    const dump = dumpAllowlist(parseAllowlist(text, format)); // throws on bad/duplicate entries
    await walletSend(session.provider, session.address, contract, callSetAllowlistRoot(dump.root));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const c = (await bridge()!.readConfig()).json as any;
    if (c.site && typeof c.site === 'object') {
      c.site.mint = {
        ...(c.site.mint ?? {}),
        chainId: cfg.chain.evm.chainId,
        rpcUrl: cfg.chain.evm.rpcUrl,
        contractAddress: contract,
        allowlist: dump,
      };
      await bridge()!.writeConfig(c);
    }
    return { ok: true, json: { root: dump.root, count: dump.count } };
  }

  const wallet = signer === 'wallet';
  // The dispatcher: each action routes to the wallet path or the key-file IPC handler.
  const ops = {
    deploy: (): Promise<OpResult> => (wallet ? wDeploy() : bridge()!.launchDeploy({ confirm })),
    caps: (): Promise<OpResult> =>
      wallet
        ? wWrite(callSetCaps(Number(walletCap), Number(maxPerTx)))
        : bridge()!.launchSetCaps({ publicWalletCap: Number(walletCap), maxPerTx: Number(maxPerTx), confirm }),
    prices: (): Promise<OpResult> =>
      wallet
        ? wWrite(callSetPrices(allowlistEth, publicEth))
        : bridge()!.launchSetPrices({ allowlistEth, publicEth, confirm }),
    phase: (p: LaunchPhase): Promise<OpResult> =>
      wallet ? wWrite(callSetPhase(p)) : bridge()!.launchSetPhase({ phase: p, confirm }),
    reveal: (): Promise<OpResult> =>
      wallet ? wWrite(callReveal(baseUri)) : bridge()!.launchReveal({ baseUri, confirm }),
    freeze: (): Promise<OpResult> => (wallet ? wWrite(callFreeze()) : bridge()!.launchFreeze({ confirm })),
    withdraw: (): Promise<OpResult> => (wallet ? wWrite(callWithdraw()) : bridge()!.launchWithdraw({ confirm })),
    allowlist: (): Promise<OpResult> =>
      wallet
        ? wAllowlist(allowlist!.text, allowlist!.format)
        : bridge()!.launchSetAllowlist({ text: allowlist!.text, format: allowlist!.format, confirm }),
  };

  async function onConnectWallet(): Promise<void> {
    if (!cfg) {
      toast.push('Project config still loading…', 'danger');
      return;
    }
    setBusy('connect');
    try {
      const { connectWallet } = await import('../lib/walletConnect');
      setProjectId(wcProjectId);
      const s = await connectWallet(wcProjectId, cfg.chain.evm.chainId, cfg.chain.evm.rpcUrl);
      setSession(s);
      toast.push(`Connected ${s.address.slice(0, 6)}…${s.address.slice(-4)}`, 'ok');
    } catch (e) {
      toast.push(String((e as Error)?.message ?? e), 'danger');
    } finally {
      setBusy(null);
    }
  }

  async function onOpenConsole(): Promise<void> {
    setBusy('console');
    try {
      const r = await bridge()!.launchConsole();
      if (r.ok) toast.push('Opened the signing console in your browser', 'ok');
      else toast.push(r.error ?? 'Could not open the console', 'danger');
    } catch (e) {
      toast.push(String((e as Error)?.message ?? e), 'danger');
    } finally {
      setBusy(null);
    }
  }

  // Can a write proceed? Wallet mode needs a session; key-file mainnet needs the confirm token.
  const canWrite = wallet ? !!session : onTestnet || !!confirmToken;

  return (
    <>
      <StageHeader
        kicker="STAGE 07 // DEPLOYMENT"
        title="Launch"
        actions={
          <Button size="sm" variant="ghost" onClick={() => void refresh()} disabled={!!busy}>
            Refresh
          </Button>
        }
      />

      {/* --- Status --- */}
      <Panel title="Contract status">
        {statusErr ? <p className="muted" style={{ color: 'var(--danger)' }}>{statusErr}</p> : null}
        {status ? (
          <div className="grid cols-auto" style={{ gap: 10 }}>
            <Stat label="Network">
              chain {status.chainId} {onTestnet ? <Badge tone="ok">testnet</Badge> : <Badge tone="accent">MAINNET</Badge>}
            </Stat>
            {deployed ? (
              <>
                <Stat label="Contract"><code>{status.contractAddress}</code></Stat>
                <Stat label="Phase">
                  {status.phase}{status.configLocked ? ' · locked' : ''}
                </Stat>
                <Stat label="Minted">{status.totalMinted} / {status.maxSupply}</Stat>
                <Stat label="Public price">{status.publicPriceEth} ETH</Stat>
                <Stat label="Allowlist price">{status.allowlistPriceEth} ETH</Stat>
                <Stat label="Caps">wallet {status.publicWalletCap} · tx {status.maxPerTx}</Stat>
                <Stat label="Revealed">{status.revealed ? 'yes' : 'no'}{status.metadataFrozen ? ' · frozen' : ''}</Stat>
              </>
            ) : (
              <Stat label="Contract">not deployed yet</Stat>
            )}
          </div>
        ) : statusErr ? null : (
          <p className="muted">Reading…</p>
        )}
      </Panel>

      {/* --- Signing --- */}
      <Panel title="Signing">
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span className="label" style={{ alignSelf: 'center' }}>Sign with:</span>
          <Button size="sm" variant={!wallet ? 'primary' : 'default'} onClick={() => setSigner('keyfile')}>
            Deployer key file
          </Button>
          <Button size="sm" variant={wallet ? 'primary' : 'default'} onClick={() => setSigner('wallet')}>
            Connect wallet
          </Button>
        </div>
        {wallet ? (
          <div style={{ marginTop: 10 }}>
            {session ? (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <Badge tone="ok">connected</Badge>
                <code>{session.address}</code>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    void session.disconnect();
                    setSession(null);
                  }}
                >
                  Disconnect
                </Button>
              </div>
            ) : (
              <div className="grid cols-auto" style={{ gap: 10, alignItems: 'end' }}>
                <Field label="WalletConnect projectId">
                  <Input value={wcProjectId} onChange={(e) => setWcProjectId(e.target.value)} placeholder="free at cloud.reown.com" />
                </Field>
                <Button loading={busy === 'connect'} disabled={!!busy || !wcProjectId} onClick={() => void onConnectWallet()}>
                  Connect wallet
                </Button>
              </div>
            )}
            <p className="muted" style={{ marginTop: 6, fontSize: 12 }}>
              Non-custodial — your wallet signs every deploy/admin transaction; no key file on disk. Get a free
              projectId at cloud.reown.com. The in-app connect uses WalletConnect (scan with a phone wallet).
            </p>
          </div>
        ) : null}
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--line)' }}>
          <p className="muted" style={{ margin: '0 0 6px', fontSize: 12 }}>
            Using a desktop wallet <strong>extension</strong> (MetaMask in your browser)? It can’t connect to a
            desktop app directly — open the signing console in your browser instead, where the extension lives.
          </p>
          <Button size="sm" variant="ghost" loading={busy === 'console'} disabled={!!busy} onClick={() => void onOpenConsole()}>
            Sign in browser (MetaMask extension) →
          </Button>
        </div>
      </Panel>

      {/* --- Mainnet guard (key-file mode; in wallet mode your wallet is the gate) --- */}
      {status && !onTestnet && !wallet ? (
        <Panel title="⚠ Mainnet — confirmation required">
          <p className="muted">
            This is a mainnet (real funds). On-chain writes are blocked until you type the chain name
            as confirmation. Only deploy to mainnet after an external audit.
          </p>
          <Field label={`Type to confirm`}>
            <Input value={confirmToken} onChange={(e) => setConfirmToken(e.target.value)} placeholder="e.g. base / ethereum" />
          </Field>
        </Panel>
      ) : null}

      {/* --- Deploy --- */}
      {!deployed ? (
        <Panel title="Deploy">
          <p className="muted">
            Deploys the launch contract using your project’s <code>chain.evm</code> config (network, treasury,
            max supply) and saves the address back into the project. Run a preflight first to check gas + balance.
          </p>
          {estimate ? (
            <div className="grid cols-auto" style={{ gap: 10, margin: '8px 0' }}>
              <Stat label="Deployer"><code>{estimate.deployer}</code></Stat>
              <Stat label="Balance">{estimate.balanceEth} ETH</Stat>
              <Stat label="Est. cost">~{estimate.costEth} ETH</Stat>
              <Stat label="Funded">{estimate.sufficient ? <Badge tone="ok">yes</Badge> : <span style={{ color: 'var(--danger)' }}>NO</span>}</Stat>
            </div>
          ) : null}
          <div style={{ display: 'flex', gap: 8 }}>
            <Button loading={busy === 'preflight'} onClick={() => void onPreflight()} disabled={!!busy}>
              Preflight (dry-run)
            </Button>
            <Button
              variant="primary"
              loading={busy === 'deploy'}
              disabled={!!busy || !canWrite}
              onClick={() => void act('deploy', ops.deploy, 'Contract deployed')}
            >
              Deploy contract
            </Button>
          </div>
        </Panel>
      ) : null}

      {/* --- Sale config --- */}
      {deployed ? (
        <Panel title="Sale setup">
          <p className="muted">
            Set caps and prices <strong>before</strong> opening the public phase — opening Public permanently
            freezes prices, caps, and the allowlist root.
          </p>

          <div className="grid cols-auto" style={{ gap: 10, alignItems: 'end' }}>
            <Field label="Per-wallet cap">
              <Input type="number" min={0} value={walletCap} onChange={(e) => setWalletCap(e.target.value)} disabled={status?.configLocked} />
            </Field>
            <Field label="Max per tx">
              <Input type="number" min={1} value={maxPerTx} onChange={(e) => setMaxPerTx(e.target.value)} disabled={status?.configLocked} />
            </Field>
            <Button
              disabled={!!busy || status?.configLocked || !canWrite}
              onClick={() => void act('caps', ops.caps, 'Caps set')}
            >
              Save caps
            </Button>
          </div>

          <div className="grid cols-auto" style={{ gap: 10, alignItems: 'end', marginTop: 10 }}>
            <Field label="Allowlist price (ETH)">
              <Input value={allowlistEth} onChange={(e) => setAllowlistEth(e.target.value)} disabled={status?.configLocked} />
            </Field>
            <Field label="Public price (ETH)">
              <Input value={publicEth} onChange={(e) => setPublicEth(e.target.value)} disabled={status?.configLocked} />
            </Field>
            <Button
              disabled={!!busy || status?.configLocked || !canWrite}
              onClick={() => void act('prices', ops.prices, 'Prices set')}
            >
              Save prices
            </Button>
          </div>

          {status?.configLocked ? <p className="muted" style={{ marginTop: 8 }}>Prices & caps are locked (public phase opened).</p> : null}

          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <span className="label" style={{ alignSelf: 'center' }}>Phase:</span>
            {(['closed', 'allowlist', 'public'] as const).map((p) => (
              <Button
                key={p}
                size="sm"
                variant={status?.phase === p ? 'primary' : 'default'}
                disabled={!!busy || status?.phase === p || !canWrite}
                onClick={() => {
                  if (p === 'public' && !window.confirm('Opening the Public phase permanently FREEZES prices, caps, and the allowlist root. Continue?')) return;
                  void act('phase', () => ops.phase(p), `Phase → ${p}`);
                }}
              >
                {p}
              </Button>
            ))}
          </div>
        </Panel>
      ) : null}

      {/* --- Allowlist --- */}
      {deployed ? (
        <Panel title="Allowlist">
          <p className="muted">
            Upload a CSV (<code>address,maxQty</code> per line) or JSON. ConkerNFTZ builds the Merkle root,
            sets it on-chain, and embeds the proofs in your site so allowlisted wallets can mint.
            {status?.configLocked ? ' The root is locked (public phase opened).' : ''}
          </p>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              type="file"
              accept=".csv,.json,.txt"
              disabled={status?.configLocked}
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                const text = await f.text();
                setAllowlist({ name: f.name, text, format: /\.json$/i.test(f.name) ? 'json' : 'csv' });
              }}
            />
            {allowlist ? <span className="muted">{allowlist.name}</span> : null}
            <Button
              loading={busy === 'allowlist'}
              disabled={!!busy || !allowlist || status?.configLocked || !canWrite}
              onClick={() => void act('allowlist', ops.allowlist, 'Allowlist root set + proofs embedded')}
            >
              Build &amp; set root
            </Button>
          </div>
        </Panel>
      ) : null}

      {/* --- Reveal & metadata --- */}
      {deployed ? (
        <Panel title="Reveal & metadata">
          <p className="muted">
            Before reveal, every token shows the placeholder. Reveal points <code>tokenURI</code> at your
            uploaded metadata (token N → <code>&lt;baseUri&gt;N.json</code>). Freeze makes it permanent.
          </p>
          <div className="reveal-steps" role="list" aria-label="Reveal progress">
            <RevealStep n={1} label="Upload metadata" done={!!manifest?.baseUri} active={!manifest?.baseUri} />
            <span className="reveal-steps-arrow" aria-hidden>→</span>
            <RevealStep n={2} label="Reveal" done={!!status?.revealed} active={!!manifest?.baseUri && !status?.revealed} />
            <span className="reveal-steps-arrow" aria-hidden>→</span>
            <RevealStep n={3} label="Freeze" done={!!status?.metadataFrozen} active={!!status?.revealed && !status?.metadataFrozen} optional />
          </div>
          {status?.revealed ? (
            <p className="muted">
              <Badge tone="ok">revealed</Badge> Tokens now resolve to the live metadata.
              {status?.metadataFrozen ? ' Metadata is frozen — permanent.' : ' You can re-reveal until you freeze.'}
            </p>
          ) : manifest?.baseUri ? (
            <p className="muted">
              Uploaded metadata detected — baseURI pre-filled below: <code className="break-all">{manifest.baseUri}</code>
            </p>
          ) : (
            <div className="row" style={{ alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <p className="muted" style={{ margin: 0 }}>
                No upload found yet. Upload your revealed metadata first — its baseURI will appear here automatically.
              </p>
              {onNavigate ? (
                <Button size="sm" onClick={() => onNavigate('publish')}>
                  Go to Publish →
                </Button>
              ) : null}
            </div>
          )}
          <div className="grid cols-auto" style={{ gap: 10, alignItems: 'end' }}>
            <Field label="Revealed base URI">
              <Input value={baseUri} onChange={(e) => setBaseUri(e.target.value)} placeholder="ipfs://<cid>/" disabled={status?.metadataFrozen} />
            </Field>
            {manifest?.baseUri && manifest.baseUri !== baseUri && !status?.metadataFrozen ? (
              <Button variant="ghost" onClick={() => setBaseUri(manifest.baseUri!)}>
                Use uploaded baseURI
              </Button>
            ) : null}
            <Button
              disabled={!!busy || !baseUri || status?.metadataFrozen || !canWrite}
              onClick={() => void act('reveal', ops.reveal, 'Revealed')}
            >
              Reveal
            </Button>
            <Button
              variant="danger"
              disabled={!!busy || status?.metadataFrozen || !canWrite}
              onClick={() => {
                if (!window.confirm('Freeze metadata permanently? This can never be undone — no further reveals will be possible.')) return;
                void act('freeze', ops.freeze, 'Metadata frozen');
              }}
            >
              {status?.metadataFrozen ? 'Frozen' : 'Freeze (permanent)'}
            </Button>
          </div>
        </Panel>
      ) : null}

      {/* --- Proceeds --- */}
      {deployed ? (
        <Panel title="Proceeds">
          <p className="muted">Withdraw the contract balance to the treasury ({status?.treasury}).</p>
          <Button
            loading={busy === 'withdraw'}
            disabled={!!busy || !canWrite}
            onClick={() => void act('withdraw', ops.withdraw, 'Withdrawn to treasury')}
          >
            Withdraw
          </Button>
        </Panel>
      ) : null}
    </>
  );
}

function Stat({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="label" style={{ opacity: 0.7 }}>{label}</div>
      <div>{children}</div>
    </div>
  );
}

/** One node in the reveal upload→reveal→freeze progress indicator. */
function RevealStep({ n, label, done, active, optional }: { n: number; label: string; done?: boolean; active?: boolean; optional?: boolean }) {
  const cls = ['rstep', done ? 'rstep--done' : '', active && !done ? 'rstep--active' : ''].filter(Boolean).join(' ');
  return (
    <span className={cls} role="listitem">
      <span className="rstep-dot" aria-hidden>{done ? '✓' : n}</span>
      <span className="rstep-label">{label}{optional ? ' · optional' : ''}</span>
    </span>
  );
}
