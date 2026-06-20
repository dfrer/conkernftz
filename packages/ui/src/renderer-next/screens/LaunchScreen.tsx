import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Panel } from '../components/Panel';
import { StageHeader } from '../components/StageHeader';
import { Button } from '../components/Button';
import { Field, Input } from '../components/Field';
import { Badge } from '../components/Badge';
import { EmptyState } from '../components/EmptyState';
import { useToast } from '../components/Toast';
import { bridge, isBridged, type LaunchStatus, type LaunchEstimate } from '../lib/bridge';

/**
 * Launch stage — deploy and operate the on-chain mint contract without touching a terminal.
 * Every action calls a `foundry:launch*` IPC handler (which drives the tested chain-evm adapter
 * with the project's configured deployer key). Mainnet writes require typing the chain's confirm
 * token; testnets are free. This is slice 1: status + deploy + caps/prices/phase (the path to a
 * mintable contract). Reveal / withdraw / allowlist land next.
 */
export function LaunchScreen() {
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

  const refresh = useCallback(async () => {
    const fb = bridge();
    if (!fb) return;
    const r = await fb.launchStatus();
    if (r.ok && r.json) {
      setStatus(r.json);
      setStatusErr(null);
    } else {
      setStatus(null);
      setStatusErr(r.error ?? 'Could not read contract status.');
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

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

  return (
    <>
      <StageHeader
        kicker="DEPLOY"
        title="Launch"
        actions={
          <Button size="sm" variant="ghost" onClick={() => void refresh()} disabled={!!busy}>
            Refresh
          </Button>
        }
      />

      {/* --- Status --- */}
      <Panel title="Contract status">
        {statusErr ? <p className="muted" style={{ color: '#ff6b6b' }}>{statusErr}</p> : null}
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

      {/* --- Mainnet guard --- */}
      {status && !onTestnet ? (
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
              <Stat label="Funded">{estimate.sufficient ? <Badge tone="ok">yes</Badge> : <span style={{ color: '#ff6b6b' }}>NO</span>}</Stat>
            </div>
          ) : null}
          <div style={{ display: 'flex', gap: 8 }}>
            <Button onClick={() => void onPreflight()} disabled={!!busy}>
              {busy === 'preflight' ? 'Checking…' : 'Preflight (dry-run)'}
            </Button>
            <Button
              variant="primary"
              disabled={!!busy || (!onTestnet && !confirmToken)}
              onClick={() => void act('deploy', () => bridge()!.launchDeploy({ confirm }), 'Contract deployed')}
            >
              {busy === 'deploy' ? 'Deploying…' : 'Deploy contract'}
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
              disabled={!!busy || status?.configLocked}
              onClick={() => void act('caps', () => bridge()!.launchSetCaps({ publicWalletCap: Number(walletCap), maxPerTx: Number(maxPerTx), confirm }), 'Caps set')}
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
              disabled={!!busy || status?.configLocked}
              onClick={() => void act('prices', () => bridge()!.launchSetPrices({ allowlistEth, publicEth, confirm }), 'Prices set')}
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
                disabled={!!busy || status?.phase === p}
                onClick={() => {
                  if (p === 'public' && !window.confirm('Opening the Public phase permanently FREEZES prices, caps, and the allowlist root. Continue?')) return;
                  void act('phase', () => bridge()!.launchSetPhase({ phase: p, confirm }), `Phase → ${p}`);
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
              disabled={!!busy || !allowlist || status?.configLocked}
              onClick={() =>
                allowlist &&
                void act(
                  'allowlist',
                  () => bridge()!.launchSetAllowlist({ text: allowlist.text, format: allowlist.format, confirm }),
                  'Allowlist root set + proofs embedded',
                )
              }
            >
              {busy === 'allowlist' ? 'Building…' : 'Build & set root'}
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
          <div className="grid cols-auto" style={{ gap: 10, alignItems: 'end' }}>
            <Field label="Revealed base URI">
              <Input value={baseUri} onChange={(e) => setBaseUri(e.target.value)} placeholder="ipfs://<cid>/" disabled={status?.metadataFrozen} />
            </Field>
            <Button
              disabled={!!busy || !baseUri || status?.metadataFrozen}
              onClick={() => void act('reveal', () => bridge()!.launchReveal({ baseUri, confirm }), 'Revealed')}
            >
              Reveal
            </Button>
            <Button
              variant="danger"
              disabled={!!busy || status?.metadataFrozen}
              onClick={() => {
                if (!window.confirm('Freeze metadata permanently? This can never be undone — no further reveals will be possible.')) return;
                void act('freeze', () => bridge()!.launchFreeze({ confirm }), 'Metadata frozen');
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
            disabled={!!busy}
            onClick={() => void act('withdraw', () => bridge()!.launchWithdraw({ confirm }), 'Withdrawn to treasury')}
          >
            {busy === 'withdraw' ? 'Withdrawing…' : 'Withdraw'}
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
