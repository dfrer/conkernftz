import { useEffect, useState } from 'react';
import { Panel } from '../components/Panel';
import { StageHeader } from '../components/StageHeader';
import { Button } from '../components/Button';
import { Field, Input, Select } from '../components/Field';
import { Badge } from '../components/Badge';
import { EmptyState } from '../components/EmptyState';
import { useToast } from '../components/Toast';
import { bridge, isBridged } from '../lib/bridge';
import { useProject } from '../state/project';

interface Manifest {
  provider?: string;
  mode?: string;
  baseUri?: string;
  files?: unknown[];
}

export function PublishScreen() {
  const { project, config } = useProject();
  const toast = useToast();
  const [provider, setProvider] = useState('local');
  const [mode, setMode] = useState('auto');
  const [force, setForce] = useState(false);
  const [from, setFrom] = useState(1);
  const [count, setCount] = useState(1);
  const [busy, setBusy] = useState<string | null>(null);
  const [log, setLog] = useState('');
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [readyEditions, setReadyEditions] = useState(0);
  const [readyMeta, setReadyMeta] = useState(0);

  const storage = (config?.storage ?? {}) as { provider?: string };
  const chain = (config?.chain ?? {}) as { target?: string; solana?: { cluster?: string }; evm?: { chainId?: number } };
  const chainTarget = chain.target ?? 'solana';
  const outDir = String((config?.export as { outDir?: string } | undefined)?.outDir ?? 'build');

  useEffect(() => {
    if (storage.provider) setProvider(storage.provider);
    void loadReadiness();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.dir]);

  // Pipeline preflight: how many editions are built, how much metadata, and whether
  // assets have been uploaded (manifest) — so the operator knows the state before acting.
  const loadReadiness = async () => {
    const fb = bridge();
    if (!fb) return;
    try {
      const imgs = await fb.listImages(`${outDir}/images`);
      setReadyEditions(imgs.ok ? (imgs.count ?? 0) : 0);
    } catch {
      setReadyEditions(0);
    }
    try {
      const md = await fb.listDir(`${outDir}/json`);
      setReadyMeta(md.ok && Array.isArray(md.items) ? md.items.filter((n) => n.endsWith('.json')).length : 0);
    } catch {
      setReadyMeta(0);
    }
    await loadManifest();
  };

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard?.writeText(text);
      toast.push('Copied baseURI', 'ok');
    } catch {
      toast.push('Copy failed', 'danger');
    }
  };

  // Run a conkernftz CLI command in the active project via the bridge and stream output.
  const runCli = async (label: string, args: string[]): Promise<boolean> => {
    const fb = bridge();
    if (!fb) {
      toast.push('Bridge offline — run in the desktop app', 'danger');
      return false;
    }
    setBusy(label);
    setLog((l) => `${l}\n$ conkernftz ${args.join(' ')}\n`);
    try {
      const r = await fb.run(args);
      setLog((l) => `${l}${r.ok ? (r.stdout ?? '(ok)') : (r.error ?? 'failed')}\n`);
      toast.push(r.ok ? `${label} complete` : `${label} failed`, r.ok ? 'ok' : 'danger');
      return r.ok;
    } catch (e) {
      setLog((l) => `${l}${String((e as Error)?.message ?? e)}\n`);
      toast.push(`${label} failed`, 'danger');
      return false;
    } finally {
      setBusy(null);
    }
  };

  const loadManifest = async () => {
    const fb = bridge();
    if (!fb) return;
    try {
      const r = await fb.readFile(`${outDir}/.upload-manifest.json`);
      if (r.ok && r.content) setManifest(JSON.parse(r.content) as Manifest);
    } catch {
      /* ignore */
    }
  };

  const upload = async () => {
    const args = ['upload', '--provider', provider, '--mode', mode];
    if (force) args.push('--force');
    if (await runCli('Upload', args)) await loadReadiness();
  };

  if (!project) {
    return (
      <div className="stack stagger">
        <StageHeader kicker="STAGE 04 // DISPATCH" title="Publish" />
        <EmptyState code="NO PROJECT" title="No project loaded" hint="Open a project to upload assets and mint." />
      </div>
    );
  }

  return (
    <div className="stack stagger">
      <StageHeader
        kicker="STAGE 04 // DISPATCH"
        title="Publish"
        actions={
          <div className="row">
            <Badge tone="accent">
              {chainTarget === 'evm' ? `EVM · chain ${chain.evm?.chainId ?? '?'}` : `SOLANA · ${chain.solana?.cluster ?? 'devnet'}`}
            </Badge>
          </div>
        }
      />

      <Panel title="Readiness" actions={<Button size="sm" onClick={loadReadiness} disabled={!isBridged()}>Refresh</Button>}>
        <div className="row wrap" style={{ gap: 'var(--sp-3)' }}>
          <Badge tone={readyEditions > 0 ? 'ok' : 'default'}>BUILD · {readyEditions} images</Badge>
          <Badge tone={readyMeta > 0 ? 'ok' : 'default'}>METADATA · {readyMeta} json</Badge>
          <Badge tone={manifest ? 'ok' : 'default'}>
            {manifest ? `UPLOADED · ${manifest.provider ?? '?'}/${manifest.mode ?? '?'}` : 'NOT UPLOADED'}
          </Badge>
        </div>
        {manifest?.baseUri ? (
          <div className="row" style={{ marginTop: 'var(--sp-3)', gap: 'var(--sp-2)', alignItems: 'center' }}>
            <span className="mono muted" style={{ wordBreak: 'break-all' }}>baseURI: {manifest.baseUri}</span>
            <Button size="sm" variant="ghost" onClick={() => copyText(manifest.baseUri!)}>
              Copy
            </Button>
          </div>
        ) : (
          <span className="label muted" style={{ display: 'block', marginTop: 'var(--sp-3)' }}>
            Build the collection, then upload — this strip reflects what's ready before you mint.
          </span>
        )}
      </Panel>

      <Panel title="Upload">
        <div className="grid cols-auto">
          <Field label="Provider">
            <Select value={provider} onChange={(e) => setProvider(e.target.value)} aria-label="Storage provider">
              <option value="local">local</option>
              <option value="pinata">pinata (IPFS)</option>
              <option value="irys">irys (Arweave)</option>
            </Select>
          </Field>
          <Field label="Mode">
            <Select value={mode} onChange={(e) => setMode(e.target.value)} aria-label="Upload mode">
              <option value="auto">auto</option>
              <option value="dir">dir (directory CID)</option>
              <option value="files">files</option>
            </Select>
          </Field>
          <label className="row" style={{ alignSelf: 'end' }}>
            <input type="checkbox" checked={force} onChange={(e) => setForce(e.target.checked)} />
            <span className="label">Force re-upload</span>
          </label>
          <div style={{ alignSelf: 'end' }}>
            <Button variant="primary" onClick={upload} disabled={!!busy || !isBridged()}>
              {busy === 'Upload' ? 'Uploading…' : 'Upload assets'}
            </Button>
          </div>
        </div>
        <span className="label muted" style={{ display: 'block', marginTop: 'var(--sp-3)' }}>
          Uploads images + metadata; <code>dir</code> mode writes the contract baseURI to .upload-manifest.json (shown in
          Readiness above).
        </span>
      </Panel>

      <Panel title={chainTarget === 'evm' ? 'Mint — EVM' : 'Mint — Solana'}>
        <div className="grid cols-auto">
          <Field label="From #">
            <Input type="number" min="1" value={from} onChange={(e) => setFrom(Number(e.target.value) || 1)} />
          </Field>
          <Field label="Count">
            <Input type="number" min="1" value={count} onChange={(e) => setCount(Number(e.target.value) || 1)} />
          </Field>
        </div>
        <div className="row wrap" style={{ marginTop: 'var(--sp-4)' }}>
          {chainTarget === 'evm' ? (
            <>
              <Button onClick={() => runCli('Deploy', ['deploy'])} disabled={!!busy || !isBridged()}>
                Deploy contract
              </Button>
              <Button
                variant="primary"
                onClick={() => runCli('Owner mint', ['mint', '--from', String(from), '--count', String(count)])}
                disabled={!!busy || !isBridged()}
              >
                Owner mint
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="primary"
                onClick={() => runCli('Mint', ['mint', '--from', String(from), '--count', String(count)])}
                disabled={!!busy || !isBridged()}
              >
                Mint (direct)
              </Button>
              <Button onClick={() => runCli('Candy create', ['candy', 'create'])} disabled={!!busy || !isBridged()}>
                Candy: create
              </Button>
              <Button onClick={() => runCli('Candy upload', ['candy', 'upload'])} disabled={!!busy || !isBridged()}>
                Candy: upload
              </Button>
              <Button onClick={() => runCli('Candy mint', ['candy', 'mint'])} disabled={!!busy || !isBridged()}>
                Candy: mint
              </Button>
            </>
          )}
        </div>
        <span className="label muted" style={{ display: 'block', marginTop: 'var(--sp-3)' }}>
          On-chain writes default to testnet/devnet; mainnet stays gated behind explicit CLI flags.
        </span>
      </Panel>

      <Panel title="Console" actions={log ? <Button size="sm" variant="ghost" onClick={() => setLog('')}>Clear</Button> : null}>
        {log.trim() ? <pre className="audit-out mono">{log.trim()}</pre> : <span className="label muted">CLI output appears here.</span>}
      </Panel>
    </div>
  );
}
