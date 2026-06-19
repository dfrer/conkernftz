import { useEffect, useState, type ReactNode } from 'react';
import { Panel } from '../components/Panel';
import { Button } from '../components/Button';
import { Field, Input, Select } from '../components/Field';
import { Badge } from '../components/Badge';
import { EmptyState } from '../components/EmptyState';
import { EffectsEditor } from '../components/EffectsEditor';
import { OverridesEditor } from '../components/OverridesEditor';
import { RenamerPanel } from '../components/RenamerPanel';
import { TraitBrowser } from '../components/TraitBrowser';
import { SpawnEditor } from '../components/SpawnEditor';
import { RulesEditor, type RulesObj } from '../components/RulesEditor';
import { Tabs, TabPanel, type TabDef } from '../components/Tabs';
import { useToast } from '../components/Toast';
import { cx } from '../lib/cx';
import { bridge } from '../lib/bridge';
import { useProject, type LayerCfg, type AssetOverrideCfg } from '../state/project';

function StageHead({ children, actions }: { children?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="main-head">
      <div>
        <div className="label main-kicker">STAGE 01 // COMPOSITION</div>
        <h1 className="main-title">Design</h1>
      </div>
      {actions}
      {children}
    </div>
  );
}

export function DesignScreen() {
  const { project, config, dirty, save, updateConfig, loading } = useProject();
  const toast = useToast();
  const [counts, setCounts] = useState<Record<number, number | null>>({});
  const [thumbs, setThumbs] = useState<Record<number, string | null>>({});
  const [selected, setSelected] = useState<number | null>(null);
  const [browsing, setBrowsing] = useState<number | null>(null);
  const [tab, setTab] = useState('layers');

  const layersKey = (config?.layers ?? []).map((l) => l.path).join('|');
  useEffect(() => {
    const fb = bridge();
    const layers = config?.layers ?? [];
    if (!fb || layers.length === 0) {
      setCounts({});
      return;
    }
    let cancelled = false;
    (async () => {
      const next: Record<number, number | null> = {};
      await Promise.all(
        layers.map(async (l, i) => {
          try {
            const r = await fb.listImages(l.path);
            next[i] = r.ok ? (r.count ?? 0) : null;
          } catch {
            next[i] = null;
          }
        }),
      );
      if (!cancelled) setCounts(next);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layersKey]);

  // Load a representative thumbnail (first image) per layer so the table shows the art.
  useEffect(() => {
    const fb = bridge();
    const layers = config?.layers ?? [];
    if (!fb || layers.length === 0) {
      setThumbs({});
      return;
    }
    let cancelled = false;
    (async () => {
      const next: Record<number, string | null> = {};
      await Promise.all(
        layers.map(async (l, i) => {
          try {
            const dir = await fb.listDir(l.path);
            const name =
              dir.ok && Array.isArray(dir.items)
                ? dir.items.find((n) => !n.endsWith('/') && /\.(png|webp|gif|svg|jpe?g)$/i.test(n))
                : undefined;
            if (!name) {
              next[i] = null;
              return;
            }
            const rel = `${l.path.replace(/[\\/]+$/, '')}/${name}`;
            const r = await fb.readFileBase64(rel);
            next[i] = r.ok && r.base64 ? `data:${r.mime || 'image/png'};base64,${r.base64}` : null;
          } catch {
            next[i] = null;
          }
        }),
      );
      if (!cancelled) setThumbs(next);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layersKey]);

  // Reset the selected/expanded layer when a project loads.
  useEffect(() => {
    setSelected(null);
    setBrowsing(null);
  }, [project?.dir]);

  if (!project) {
    return (
      <div className="stack stagger">
        <StageHead />
        <EmptyState code="NO PROJECT" title="No project loaded" hint="Open a project from the Projects stage to edit its layers and rarity." />
      </div>
    );
  }
  if (!config) {
    return (
      <div className="stack stagger">
        <StageHead />
        <EmptyState code="NO CONFIG" title="No foundry.config.json" hint={loading ? 'Loading…' : 'This folder has no readable config.'} />
      </div>
    );
  }

  const layers = config.layers ?? [];
  const rarity = (config.rarity ?? {}) as { delimiter?: string; defaultWeight?: number };
  const delimiter = rarity.delimiter ?? '#';
  const defaultWeight = rarity.defaultWeight ?? 1;
  const spawnMapPath = String((config.spawn as { mapPath?: string } | undefined)?.mapPath ?? 'spawn-map.json');
  const setBasic = (key: string, value: unknown) =>
    updateConfig((d) => {
      (d as Record<string, unknown>)[key] = value;
    });
  const setImage = (key: string, value: unknown) =>
    updateConfig((d) => {
      d.image = { ...(d.image ?? {}), [key]: value };
    });
  const setLayer = (i: number, patch: Partial<LayerCfg>) =>
    updateConfig((d) => {
      const ls = d.layers ?? [];
      ls[i] = { ...ls[i], ...patch } as LayerCfg;
      d.layers = ls;
    });
  const updateLayer = (i: number, fn: (l: LayerCfg) => void) =>
    updateConfig((d) => {
      const l = (d.layers ?? [])[i];
      if (l) fn(l);
    });
  const addLayer = () =>
    updateConfig((d) => {
      const n = (d.layers?.length ?? 0) + 1;
      d.layers = [...(d.layers ?? []), { name: `Layer ${n}`, path: 'layers/new', rarity: 'filename', required: true }];
    });
  const removeLayer = (i: number) => {
    updateConfig((d) => {
      const ls = [...(d.layers ?? [])];
      ls.splice(i, 1);
      d.layers = ls;
    });
    setSelected((s) => (s === i ? null : s));
    setBrowsing((b) => (b === i ? null : b));
  };
  const move = (i: number, to: number) => {
    updateConfig((d) => {
      const ls = [...(d.layers ?? [])];
      if (to < 0 || to >= ls.length) return;
      const [x] = ls.splice(i, 1);
      ls.splice(to, 0, x as LayerCfg);
      d.layers = ls;
    });
    setSelected(null);
    setBrowsing(null);
  };

  const onSave = async () => {
    const ok = await save();
    toast.push(ok ? 'Config saved' : 'Save failed', ok ? 'ok' : 'danger');
  };

  const tabDefs: TabDef[] = [
    { id: 'basics', label: 'Basics' },
    { id: 'layers', label: 'Layers', badge: layers.length || undefined },
    { id: 'assets', label: 'Assets & rarity' },
    { id: 'rules', label: 'Rules' },
  ];

  return (
    <div className="stack stagger">
      <StageHead
        actions={
          <div className="row">
            {dirty ? <Badge tone="accent">UNSAVED</Badge> : null}
            <Button variant="primary" disabled={!dirty} onClick={onSave}>
              Save config
            </Button>
          </div>
        }
      />

      <Tabs tabs={tabDefs} active={tab} onChange={setTab} ariaLabel="Design sections" />

      <TabPanel id="basics" active={tab}>
      <Panel title="Basics">
        <div className="grid cols-auto">
          <Field label="Collection name">
            <Input value={config.name ?? ''} onChange={(e) => setBasic('name', e.target.value)} />
          </Field>
          <Field label="Symbol">
            <Input value={config.symbol ?? ''} onChange={(e) => setBasic('symbol', e.target.value)} />
          </Field>
          <Field label="Edition size">
            <Input type="number" value={config.editionSize ?? ''} onChange={(e) => setBasic('editionSize', Number(e.target.value) || 0)} />
          </Field>
          <Field label="Image width">
            <Input type="number" value={config.image?.width ?? ''} onChange={(e) => setImage('width', Number(e.target.value) || 0)} />
          </Field>
          <Field label="Image height">
            <Input type="number" value={config.image?.height ?? ''} onChange={(e) => setImage('height', Number(e.target.value) || 0)} />
          </Field>
          <Field label="Background">
            <Input value={config.image?.background ?? ''} onChange={(e) => setImage('background', e.target.value)} placeholder="transparent or #RRGGBB" />
          </Field>
        </div>
      </Panel>
      </TabPanel>

      <TabPanel id="layers" active={tab}>
      <Panel
        title="Layers"
        actions={
          <Button size="sm" onClick={addLayer}>
            + Add layer
          </Button>
        }
      >
        {layers.length === 0 ? (
          <EmptyState code="NO LAYERS" title="No layers yet" hint="Add a layer and point it at an image folder." action={<Button onClick={addLayer}>+ Add layer</Button>} />
        ) : (
          <div className="stack">
            <div className="layer-row layer-row--head label">
              <span>#</span>
              <span>Art</span>
              <span>Name</span>
              <span>Path</span>
              <span>Rarity</span>
              <span>Req</span>
              <span>Opacity</span>
              <span>Assets</span>
              <span>Actions</span>
            </div>
            {layers.map((l, i) => (
              <div className={cx('layer-row', selected === i && 'layer-row--active')} key={i}>
                <span className="nav-index">{String(i + 1).padStart(2, '0')}</span>
                {thumbs[i] ? (
                  <img className="layer-thumb" src={thumbs[i]!} alt="" />
                ) : (
                  <span className="layer-thumb layer-thumb--ph" aria-hidden />
                )}
                <Input value={l.name} onChange={(e) => setLayer(i, { name: e.target.value })} aria-label={`Layer ${i + 1} name`} />
                <Input value={l.path} onChange={(e) => setLayer(i, { path: e.target.value })} aria-label={`Layer ${i + 1} path`} />
                <Select value={l.rarity ?? 'filename'} onChange={(e) => setLayer(i, { rarity: e.target.value as 'filename' | 'uniform' })} aria-label={`Layer ${i + 1} rarity`}>
                  <option value="filename">filename</option>
                  <option value="uniform">uniform</option>
                </Select>
                <input type="checkbox" checked={!!l.required} onChange={(e) => setLayer(i, { required: e.target.checked })} aria-label={`Layer ${i + 1} required`} />
                <Input
                  type="number"
                  step="0.05"
                  min="0"
                  max="1"
                  value={l.opacity ?? ''}
                  onChange={(e) => setLayer(i, { opacity: e.target.value === '' ? undefined : Number(e.target.value) })}
                  aria-label={`Layer ${i + 1} opacity`}
                />
                <span className="mono muted">{counts[i] == null ? '—' : counts[i]}</span>
                <span className="row">
                  <Button
                    size="sm"
                    onClick={() => setBrowsing(browsing === i ? null : i)}
                    aria-label={`Browse layer ${i + 1} traits`}
                    aria-expanded={browsing === i}
                  >
                    traits
                  </Button>
                  <Button size="sm" onClick={() => setSelected(selected === i ? null : i)} aria-label={`Edit layer ${i + 1} effects`}>
                    fx
                  </Button>
                  <Button size="sm" icon onClick={() => move(i, i - 1)} aria-label="Move up" disabled={i === 0}>
                    ▲
                  </Button>
                  <Button size="sm" icon onClick={() => move(i, i + 1)} aria-label="Move down" disabled={i === layers.length - 1}>
                    ▼
                  </Button>
                  <Button size="sm" variant="danger" icon onClick={() => removeLayer(i)} aria-label="Remove layer">
                    ✕
                  </Button>
                </span>
              </div>
            ))}
          </div>
        )}
      </Panel>

      {browsing != null && layers[browsing] ? (
        <Panel
          title={`Traits — ${layers[browsing]!.name}`}
          actions={
            <Button size="sm" variant="ghost" onClick={() => setBrowsing(null)}>
              Close
            </Button>
          }
        >
          <TraitBrowser layer={layers[browsing]!} delimiter={delimiter} defaultWeight={defaultWeight} />
        </Panel>
      ) : null}

      {selected != null && layers[selected] ? (
        <Panel
          title={`Effects — ${layers[selected]!.name}`}
          actions={
            <Button size="sm" variant="ghost" onClick={() => setSelected(null)}>
              Close
            </Button>
          }
        >
          <EffectsEditor
            effects={layers[selected]!.effects ?? {}}
            onChange={(mut) =>
              updateLayer(selected, (l) => {
                l.effects = l.effects ?? {};
                mut(l.effects);
              })
            }
          />
          <div style={{ marginTop: 'var(--sp-4)' }}>
            <OverridesEditor
              overrides={(layers[selected]!.overrides ?? []) as AssetOverrideCfg[]}
              onChange={(mut) =>
                updateConfig((d) => {
                  const l = (d.layers ?? [])[selected];
                  if (l) {
                    l.overrides = Array.isArray(l.overrides) ? l.overrides : [];
                    mut(l.overrides as AssetOverrideCfg[]);
                  }
                })
              }
            />
          </div>
        </Panel>
      ) : null}
      </TabPanel>

      <TabPanel id="assets" active={tab}>
        {layers.length > 0 ? (
          <div className="stack">
            <RenamerPanel layers={layers} delimiter={delimiter} defaultWeight={defaultWeight} />
            <SpawnEditor
              layers={layers}
              mapPath={spawnMapPath}
              onMapPathChange={(p) => {
                const cur = (config.spawn as { mapPath?: string } | undefined)?.mapPath;
                if (cur !== p) updateConfig((d) => { d.spawn = { ...((d.spawn as object) ?? {}), mapPath: p }; });
              }}
            />
          </div>
        ) : (
          <EmptyState code="NO LAYERS" title="No layers yet" hint="Add a layer in the Layers tab to set rarity weights and spawn maps." />
        )}
      </TabPanel>

      <TabPanel id="rules" active={tab}>
        <RulesEditor value={(config.rules ?? {}) as RulesObj} setRules={(next) => updateConfig((d) => { d.rules = next; })} />
      </TabPanel>
    </div>
  );
}
