import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { Panel } from './Panel';
import { Button } from './Button';
import { Field, Input, Select } from './Field';
import { Badge } from './Badge';
import { useToast } from './Toast';
import { cx } from '../lib/cx';
import { bridge } from '../lib/bridge';
import { addDot, moveDot, updateDot, removeDot, toggleLayerDot, setRules, clampUnit, emptyMap, layerHasDot, type SpawnMap } from '../lib/spawn';
import type { LayerCfg } from '../state/project';

const D = 300; // canvas display size (px)

export function SpawnEditor({ layers, mapPath, onMapPathChange }: { layers: LayerCfg[]; mapPath: string; onMapPathChange: (p: string) => void }) {
  const toast = useToast();
  const [map, setMap] = useState<SpawnMap>(() => emptyMap());
  const [sel, setSel] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const fb = bridge();
      if (!fb) return;
      try {
        const r = await fb.readFile(mapPath);
        if (!cancelled && r.ok && r.content) {
          const j = JSON.parse(r.content);
          if (j && j.version === 1) {
            setMap(j as SpawnMap);
            setDirty(false);
          }
        }
      } catch {
        /* keep empty map */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mapPath]);

  const edit = (next: SpawnMap) => {
    setMap(next);
    setDirty(true);
  };

  const toUnit = (clientX: number, clientY: number) => {
    const el = svgRef.current;
    if (!el) return { x: 0, y: 0 };
    const r = el.getBoundingClientRect();
    return { x: clampUnit((clientX - r.left) / (r.width || D)), y: clampUnit((clientY - r.top) / (r.height || D)) };
  };

  // Drag handling lives on the window so the pointer can leave the dot while dragging.
  useEffect(() => {
    const move = (e: PointerEvent) => {
      if (!dragRef.current) return;
      const { x, y } = toUnit(e.clientX, e.clientY);
      setMap((m) => moveDot(m, dragRef.current as string, x, y));
      setDirty(true);
    };
    const up = () => {
      dragRef.current = null;
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
  }, []);

  const onCanvasClick = (e: MouseEvent<SVGSVGElement>) => {
    if (dragRef.current) return;
    const { x, y } = toUnit(e.clientX, e.clientY);
    edit(addDot(map, x, y));
  };

  const save = async () => {
    const fb = bridge();
    if (!fb) {
      toast.push('Bridge offline — save from the desktop app', 'danger');
      return;
    }
    setBusy(true);
    try {
      const r = await fb.saveJson(mapPath, map);
      if (r.ok) {
        setDirty(false);
        onMapPathChange(mapPath);
        toast.push('Spawn map saved — Save config to link it', 'ok');
      } else {
        toast.push(r.error ?? 'Save failed', 'danger');
      }
    } catch (e) {
      toast.push(String((e as Error)?.message ?? e), 'danger');
    } finally {
      setBusy(false);
    }
  };

  const selDot = map.dots.find((d) => d.id === sel) ?? null;
  const rules = map.rules ?? {};

  return (
    <Panel
      title="Spawn / placement"
      actions={
        <div className="row">
          <Badge>{map.dots.length} DOTS</Badge>
          {dirty ? <Badge tone="accent">UNSAVED</Badge> : null}
          <Button size="sm" variant="primary" onClick={save} loading={busy}>
            Save spawn map
          </Button>
        </div>
      }
    >
      <div className="row" style={{ alignItems: 'flex-start', gap: 'var(--sp-5)', flexWrap: 'wrap' }}>
        <div>
          <svg
            ref={svgRef}
            width={D}
            height={D}
            viewBox={`0 0 ${D} ${D}`}
            className="spawn-canvas"
            onClick={onCanvasClick}
            role="img"
            aria-label="Spawn canvas"
          >
            <rect x={0} y={0} width={D} height={D} className="spawn-bg" />
            <line className="spawn-cross" x1={D / 2} y1={0} x2={D / 2} y2={D} />
            <line className="spawn-cross" x1={0} y1={D / 2} x2={D} y2={D / 2} />
            {map.dots.map((d) => (
              <circle
                key={d.id}
                cx={d.x * D}
                cy={d.y * D}
                r={sel === d.id ? 8 : 6}
                className={cx('spawn-dot', sel === d.id && 'spawn-dot--sel')}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  setSel(d.id);
                  dragRef.current = d.id;
                }}
              />
            ))}
          </svg>
          <div className="label muted">Click to add a dot · drag to move</div>
        </div>

        <div className="stack" style={{ flex: 1, minWidth: 260 }}>
          {selDot ? (
            <div className="grid cols-auto">
              <Field label="X">
                <Input type="number" step="0.01" min="0" max="1" value={selDot.x.toFixed(3)} onChange={(e) => edit(updateDot(map, selDot.id, { x: clampUnit(Number(e.target.value) || 0) }))} />
              </Field>
              <Field label="Y">
                <Input type="number" step="0.01" min="0" max="1" value={selDot.y.toFixed(3)} onChange={(e) => edit(updateDot(map, selDot.id, { y: clampUnit(Number(e.target.value) || 0) }))} />
              </Field>
              <Field label="Weight">
                <Input type="number" min="0" value={selDot.weight ?? 1} onChange={(e) => edit(updateDot(map, selDot.id, { weight: Number(e.target.value) || 0 }))} />
              </Field>
              <Field label="Jitter px">
                <Input type="number" min="0" value={selDot.jitterRadiusPx ?? ''} onChange={(e) => edit(updateDot(map, selDot.id, { jitterRadiusPx: e.target.value === '' ? undefined : Number(e.target.value) }))} />
              </Field>
              <div style={{ alignSelf: 'end' }}>
                <Button size="sm" variant="danger" onClick={() => { edit(removeDot(map, selDot.id)); setSel(null); }}>
                  Delete dot
                </Button>
              </div>
            </div>
          ) : (
            <span className="label muted">Select a dot to edit its position, weight, and jitter.</span>
          )}

          <div className="grid cols-auto">
            <Field label="Selection">
              <Select value={rules.selection ?? 'weighted'} onChange={(e) => edit(setRules(map, { selection: e.target.value as 'weighted' | 'sequential' }))} aria-label="Selection policy">
                <option value="weighted">weighted</option>
                <option value="sequential">sequential</option>
              </Select>
            </Field>
            <Field label="Fit">
              <Select value={rules.fitMode ?? 'contain'} onChange={(e) => edit(setRules(map, { fitMode: e.target.value as 'contain' | 'cover' | 'stretch' }))} aria-label="Fit mode">
                <option value="contain">contain</option>
                <option value="cover">cover</option>
                <option value="stretch">stretch</option>
              </Select>
            </Field>
            <Field label="Anchor">
              <Select value={rules.anchor ?? 'center'} onChange={(e) => edit(setRules(map, { anchor: e.target.value as 'center' | 'top-left' | 'custom' }))} aria-label="Anchor">
                <option value="center">center</option>
                <option value="top-left">top-left</option>
                <option value="custom">custom</option>
              </Select>
            </Field>
          </div>

          <span className="label">Layer → dots</span>
          {layers.length === 0 ? (
            <span className="label muted">No layers configured.</span>
          ) : (
            layers.map((l) => (
              <div key={l.name} className="row wrap" style={{ gap: 'var(--sp-3)' }}>
                <span className="mono" style={{ minWidth: 120 }}>
                  {l.name}
                </span>
                {map.dots.length === 0 ? (
                  <span className="label muted">add dots first</span>
                ) : (
                  map.dots.map((d) => (
                    <label key={d.id} className="row" style={{ gap: 4 }}>
                      <input type="checkbox" checked={layerHasDot(map, l.name, d.id)} onChange={() => edit(toggleLayerDot(map, l.name, d.id))} aria-label={`${l.name} uses ${d.id}`} />
                      <span className="mono muted">{d.id}</span>
                    </label>
                  ))
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </Panel>
  );
}
