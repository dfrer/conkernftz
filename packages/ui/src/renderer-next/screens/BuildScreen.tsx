import { useEffect, useState } from 'react';
import { Panel } from '../components/Panel';
import { Button } from '../components/Button';
import { Field, Input } from '../components/Field';
import { Badge } from '../components/Badge';
import { EmptyState } from '../components/EmptyState';
import { useToast } from '../components/Toast';
import { bridge, isBridged, type BuildProgressEvent } from '../lib/bridge';
import { useProject } from '../state/project';

interface RarityData {
  traitCounts?: Record<string, Record<string, number>>;
  editionCount?: number;
}

export function BuildScreen() {
  const { project, config } = useProject();
  const toast = useToast();
  const [count, setCount] = useState<number>(Number(config?.editionSize) || 10);
  const [building, setBuilding] = useState(false);
  const [prog, setProg] = useState<BuildProgressEvent | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [rarity, setRarity] = useState<RarityData | null>(null);
  const [audit, setAudit] = useState<{ label: string; json: unknown } | null>(null);

  useEffect(() => {
    if (config?.editionSize) setCount(Number(config.editionSize));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.dir]);

  // Subscribe to build progress once.
  useEffect(() => {
    bridge()?.onBuildProgress((d) => setProg(d));
  }, []);

  const outDir = String(config?.export?.outDir ?? 'build');

  const loadRarity = async () => {
    const fb = bridge();
    if (!fb) return;
    try {
      const r = await fb.readFile(`${outDir}/rarity.json`);
      if (r.ok && r.content) setRarity(JSON.parse(r.content) as RarityData);
    } catch {
      /* ignore */
    }
  };

  const build = async () => {
    const fb = bridge();
    if (!fb) {
      toast.push('Bridge offline — build runs in the desktop app', 'danger');
      return;
    }
    if (!config) {
      toast.push('Open a project first', 'danger');
      return;
    }
    const n = Math.max(1, count);
    setBuilding(true);
    setResult(null);
    setProg({ current: 0, total: n, progress: 0, message: 'Starting…' });
    try {
      const r = await fb.buildWithProgress(n);
      if (r.ok) {
        setResult(r.stdout ?? 'Build complete');
        toast.push('Build complete', 'ok');
        await loadRarity();
      } else {
        toast.push(r.error ?? 'Build failed', 'danger');
      }
    } catch (e) {
      toast.push(String((e as Error)?.message ?? e), 'danger');
    } finally {
      setBuilding(false);
      setProg(null);
    }
  };

  const runAudit = async (which: 'assets' | 'outputs') => {
    const fb = bridge();
    if (!fb) return;
    const r = which === 'assets' ? await fb.auditAssets({ json: true }) : await fb.auditOutputs({ images: true, json: true });
    if (r.ok) setAudit({ label: which, json: r.json });
    else toast.push(r.error ?? 'Audit failed', 'danger');
  };

  const pct = prog ? Math.max(0, Math.min(100, prog.progress || (prog.total ? (prog.current / prog.total) * 100 : 0))) : 0;

  return (
    <div className="stack stagger">
      <div className="main-head">
        <div>
          <div className="label main-kicker">STAGE 03 // PRODUCTION</div>
          <h1 className="main-title">Build</h1>
        </div>
        <div className="row">
          <Field label="Count">
            <Input type="number" min="1" value={count} onChange={(e) => setCount(Number(e.target.value) || 1)} style={{ width: 90 }} disabled={building} />
          </Field>
          <Button variant="primary" onClick={build} disabled={building || !isBridged()}>
            {building ? 'Building…' : 'Build collection'}
          </Button>
        </div>
      </div>

      <Panel
        title="Production"
        actions={building ? <Badge tone="accent">RUNNING</Badge> : result ? <Badge tone="ok">DONE</Badge> : null}
      >
        {!project ? (
          <EmptyState code="NO PROJECT" title="No project loaded" hint="Open a project to build a collection." />
        ) : building || prog ? (
          <div className="stack">
            <div className="progress">
              <div className="progress-bar" style={{ width: `${pct}%` }} />
            </div>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <span className="label">{prog?.message ?? 'Working…'}</span>
              <span className="mono muted">
                {prog?.current ?? 0}/{prog?.total ?? count} · {pct.toFixed(0)}%
              </span>
            </div>
            <div className="row">
              {prog?.isPaused ? (
                <Button size="sm" onClick={() => bridge()?.resumeBuild()}>
                  Resume
                </Button>
              ) : (
                <Button size="sm" onClick={() => bridge()?.pauseBuild()}>
                  Pause
                </Button>
              )}
              <Button size="sm" variant="danger" onClick={() => bridge()?.stopBuild()}>
                Stop
              </Button>
            </div>
          </div>
        ) : result ? (
          <div className="mono">{result}</div>
        ) : (
          <EmptyState
            code="IDLE"
            title="Ready to build"
            hint={
              isBridged()
                ? `Generate ${count} editions (images + metadata) with progress, pause, resume and stop.`
                : 'Bridge offline — build runs inside the desktop app.'
            }
            action={
              <Button variant="primary" onClick={build} disabled={!isBridged()}>
                Build collection
              </Button>
            }
          />
        )}
      </Panel>

      <Panel title="Rarity report" actions={<Button size="sm" onClick={loadRarity}>Reload</Button>}>
        {!rarity || !rarity.traitCounts ? (
          <EmptyState code="NO REPORT" title="No rarity.json yet" hint="Build the collection to generate the rarity report." />
        ) : (
          <RarityReport data={rarity} />
        )}
      </Panel>

      <Panel
        title="Audit"
        actions={
          <div className="row">
            <Button size="sm" onClick={() => runAudit('assets')}>
              Audit assets
            </Button>
            <Button size="sm" onClick={() => runAudit('outputs')}>
              Audit outputs
            </Button>
          </div>
        }
      >
        {audit ? (
          <pre className="audit-out mono">{JSON.stringify(audit.json, null, 2)}</pre>
        ) : (
          <span className="label muted">Scan layer assets or built outputs for duplicates and issues.</span>
        )}
      </Panel>
    </div>
  );
}

function RarityReport({ data }: { data: RarityData }) {
  const editions = Number(data.editionCount ?? 0);
  const traits = Object.entries(data.traitCounts ?? {});
  return (
    <div className="stack">
      <span className="label">
        {editions} EDITIONS · {traits.length} TRAITS
      </span>
      {traits.map(([trait, counts]) => (
        <div key={trait} className="stack" style={{ gap: 4 }}>
          <span className="mono" style={{ color: 'var(--accent)' }}>
            {trait}
          </span>
          {Object.entries(counts)
            .sort((a, b) => b[1] - a[1])
            .map(([value, n]) => {
              const p = editions ? (n / editions) * 100 : 0;
              return (
                <div key={value} className="histo-row">
                  <span className="mono" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {value}
                  </span>
                  <div className="histo-bar">
                    <span style={{ width: `${Math.max(2, p)}%` }} />
                  </div>
                  <span className="mono muted">
                    {n} · {p.toFixed(1)}%
                  </span>
                </div>
              );
            })}
        </div>
      ))}
    </div>
  );
}
