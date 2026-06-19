import { useEffect, useMemo, useState } from 'react';
import { Panel } from './Panel';
import { Button } from './Button';
import { Field, Input, Select } from './Field';
import { Badge } from './Badge';
import { useToast } from './Toast';
import { bridge } from '../lib/bridge';
import { isImage, traitValueOf, weightOf, uniformWeightRenames, sequenceRenames, type RenamePair } from '../lib/rename';
import type { LayerCfg } from '../state/project';

function join(dir: string, name: string): string {
  return `${dir.replace(/[\\/]+$/, '')}/${name}`;
}

export function RenamerPanel({ layers, delimiter, defaultWeight = 1 }: { layers: LayerCfg[]; delimiter: string; defaultWeight?: number }) {
  const toast = useToast();
  const [idx, setIdx] = useState(0);
  const [files, setFiles] = useState<string[]>([]);
  const [mode, setMode] = useState<'weight' | 'sequence'>('weight');
  const [weight, setWeight] = useState(1);
  const [base, setBase] = useState('');
  const [start, setStart] = useState(1);
  const [pad, setPad] = useState(3);
  const [keepWeight, setKeepWeight] = useState(true);
  const [busy, setBusy] = useState(false);

  const layer = layers[idx];

  const load = async () => {
    const fb = bridge();
    if (!fb || !layer) {
      setFiles([]);
      return;
    }
    try {
      const r = await fb.listDir(layer.path);
      setFiles(r.ok && Array.isArray(r.items) ? r.items.filter(isImage) : []);
    } catch {
      setFiles([]);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, layer?.path]);

  const pairs: RenamePair[] = useMemo(() => {
    if (mode === 'weight') return uniformWeightRenames(files, Math.max(1, weight), delimiter);
    return sequenceRenames(files, (base || 'Trait').trim(), start, pad, delimiter, keepWeight, defaultWeight);
  }, [files, mode, weight, base, start, pad, keepWeight, delimiter, defaultWeight]);

  const apply = async () => {
    const fb = bridge();
    if (!fb || !layer) {
      toast.push('Bridge offline', 'danger');
      return;
    }
    if (!pairs.length) {
      toast.push('Nothing to rename', 'danger');
      return;
    }
    setBusy(true);
    try {
      const r = await fb.renameFiles(pairs.map((p) => ({ from: join(layer.path, p.from), to: join(layer.path, p.to) })));
      toast.push(r.ok ? `Renamed ${r.renamed ?? pairs.length} file(s)` : (r.error ?? 'Rename failed'), r.ok ? 'ok' : 'danger');
      if (r.ok) await load();
    } catch (e) {
      toast.push(String((e as Error)?.message ?? e), 'danger');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel
      title="Assets & rarity (renamer)"
      actions={
        <Button size="sm" variant="primary" onClick={apply} disabled={busy || !pairs.length}>
          {busy ? 'Renaming…' : `Apply (${pairs.length})`}
        </Button>
      }
    >
      <div className="stack">
        <div className="grid cols-auto">
          <Field label="Layer">
            <Select value={String(idx)} onChange={(e) => setIdx(Number(e.target.value))} aria-label="Renamer layer">
              {layers.map((l, i) => (
                <option key={i} value={i}>
                  {l.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Mode">
            <Select value={mode} onChange={(e) => setMode(e.target.value as 'weight' | 'sequence')} aria-label="Rename mode">
              <option value="weight">Set rarity weight</option>
              <option value="sequence">Sequence rename</option>
            </Select>
          </Field>
          {mode === 'weight' ? (
            <Field label="Weight (all)">
              <Input type="number" min="1" value={weight} onChange={(e) => setWeight(Number(e.target.value) || 1)} />
            </Field>
          ) : (
            <>
              <Field label="Base name">
                <Input value={base} onChange={(e) => setBase(e.target.value)} placeholder="Trait" />
              </Field>
              <Field label="Start">
                <Input type="number" min="0" value={start} onChange={(e) => setStart(Number(e.target.value) || 0)} />
              </Field>
              <Field label="Pad">
                <Input type="number" min="0" value={pad} onChange={(e) => setPad(Number(e.target.value) || 0)} />
              </Field>
              <label className="row" style={{ alignSelf: 'end' }}>
                <input type="checkbox" checked={keepWeight} onChange={(e) => setKeepWeight(e.target.checked)} />
                <span className="label">Keep weights</span>
              </label>
            </>
          )}
        </div>

        <div className="row spread">
          <span className="label">{files.length} FILES</span>
          {pairs.length ? <Badge tone="accent">{pairs.length} CHANGES</Badge> : <span className="label muted">no changes</span>}
        </div>

        {files.length === 0 ? (
          <span className="label muted">No image files in this layer (or bridge offline).</span>
        ) : (
          <div className="stack" style={{ gap: 4 }}>
            {(pairs.length ? pairs : files.map((f) => ({ from: f, to: f }))).slice(0, 12).map((p, i) => (
              <div key={i} className="histo-row" style={{ gridTemplateColumns: '1fr 16px 1fr' }}>
                <span className="mono muted truncate">
                  {p.from}
                  {pairs.length ? '' : ` · ${traitValueOf(p.from, delimiter)} (w${weightOf(p.from, delimiter, defaultWeight)})`}
                </span>
                <span className="mono muted">{p.from === p.to ? '·' : '→'}</span>
                <span className="mono truncate">
                  {p.to}
                </span>
              </div>
            ))}
            {(pairs.length || files.length) > 12 ? <span className="label muted">…and more</span> : null}
          </div>
        )}
      </div>
    </Panel>
  );
}
