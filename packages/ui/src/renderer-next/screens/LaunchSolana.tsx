import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Panel } from '../components/Panel';
import { StageHeader } from '../components/StageHeader';
import { Button } from '../components/Button';
import { Field, Input } from '../components/Field';
import { Badge } from '../components/Badge';
import { EmptyState } from '../components/EmptyState';
import { useToast } from '../components/Toast';
import { bridge, isBridged, type SolanaLaunchStatus } from '../lib/bridge';

/**
 * Launch stage — Solana (Core Candy Machine). The chain-equal counterpart of the EVM LaunchScreen:
 * read live status, create the collection + Candy Machine from the built/uploaded items, and insert
 * the config lines. Writes sign with the configured wallet keypair in the main process (key-file
 * model, like the CLI). Mainnet-beta writes require typing the cluster name. Browser-wallet
 * (Phantom) signing lands in the next slice.
 */
export function LaunchSolana() {
  const toast = useToast();
  const [status, setStatus] = useState<SolanaLaunchStatus | null>(null);
  const [statusErr, setStatusErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmToken, setConfirmToken] = useState('');

  const refresh = useCallback(async () => {
    const fb = bridge();
    if (!fb) return;
    const s = await fb.solanaLaunchStatus();
    if (s.ok && s.json) {
      setStatus(s.json);
      setStatusErr(null);
    } else {
      setStatus(null);
      setStatusErr(s.error ?? 'Could not read Candy Machine status.');
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (!isBridged()) {
    return (
      <>
        <StageHeader kicker="DEPLOY" title="Launch" />
        <EmptyState code="NO BRIDGE" title="Desktop app required" hint="Deploying and managing the Candy Machine runs in the ConkerNFTZ desktop app." />
      </>
    );
  }

  const mainnet = status?.mainnet ?? false;
  const confirm = mainnet ? confirmToken : undefined;
  const created = !!status?.configured;
  const canWrite = !mainnet || !!confirmToken;

  async function act(
    label: string,
    fn: () => Promise<{ ok: boolean; error?: string }>,
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

      <Panel title="Candy Machine status">
        {statusErr ? <p className="muted" style={{ color: 'var(--danger)' }}>{statusErr}</p> : null}
        {status ? (
          <div className="grid cols-auto" style={{ gap: 10 }}>
            <Stat label="Cluster">
              {status.cluster} {mainnet ? <Badge tone="accent">MAINNET-BETA</Badge> : <Badge tone="ok">{status.cluster}</Badge>}
            </Stat>
            {created ? (
              <>
                <Stat label="Candy Machine"><code>{status.candyMachine}</code></Stat>
                <Stat label="Collection"><code>{status.collection}</code></Stat>
                <Stat label="Items">
                  {status.itemsRedeemed} minted · {status.itemsLoaded}/{status.itemsAvailable} loaded
                </Stat>
                <Stat label="State">
                  {status.fullyLoaded ? <Badge tone="ok">fully loaded</Badge> : <Badge>loading</Badge>}
                  {status.soldOut ? <Badge tone="accent">sold out</Badge> : null}
                </Stat>
              </>
            ) : (
              <Stat label="Candy Machine">not created yet</Stat>
            )}
          </div>
        ) : statusErr ? null : (
          <p className="muted">Reading…</p>
        )}
      </Panel>

      <Panel title="Signing">
        <p className="muted" style={{ margin: 0 }}>
          Candy Machine operations sign with your configured wallet keypair (<code>chain.solana.walletKeypairPath</code>)
          in the desktop app — the same model as the CLI. Browser-wallet (Phantom) signing is coming next.
        </p>
      </Panel>

      {mainnet ? (
        <Panel title="⚠ Mainnet-beta — confirmation required">
          <p className="muted">
            This is mainnet-beta (real funds). Writes are blocked until you type the cluster name as confirmation.
            Only launch to mainnet after an external audit.
          </p>
          <Field label="Type to confirm">
            <Input value={confirmToken} onChange={(e) => setConfirmToken(e.target.value)} placeholder="mainnet-beta" />
          </Field>
        </Panel>
      ) : null}

      {!created ? (
        <Panel title="Create Candy Machine">
          <p className="muted">
            Creates the collection + Candy Machine sized to your built editions (with guards from
            <code> chain.solana.candyMachine</code>). Build, then Publish (upload), so the items have metadata URIs first.
          </p>
          <Button
            variant="primary"
            disabled={!!busy || !canWrite}
            onClick={() => void act('create', () => bridge()!.solanaCreate({ confirm }), 'Candy Machine created')}
          >
            {busy === 'create' ? 'Creating…' : 'Create Candy Machine'}
          </Button>
        </Panel>
      ) : null}

      {created ? (
        <Panel title="Insert items">
          <p className="muted">
            Inserts your uploaded token config lines (name + metadata URI) into the Candy Machine.{' '}
            {status?.fullyLoaded ? 'All items are already loaded.' : `${status?.itemsLoaded ?? 0}/${status?.itemsAvailable ?? 0} loaded.`}
          </p>
          <Button
            disabled={!!busy || !canWrite || !!status?.fullyLoaded}
            onClick={() => void act('insert', () => bridge()!.solanaInsertItems({ confirm }), 'Items inserted')}
          >
            {busy === 'insert' ? 'Inserting…' : 'Insert items'}
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
