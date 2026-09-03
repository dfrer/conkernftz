import { useEffect, useRef, useState } from 'react';
import { Panel } from '../components/Panel';
import { StageHeader } from '../components/StageHeader';
import { Button } from '../components/Button';
import { Field, Input, Select } from '../components/Field';
import { Badge } from '../components/Badge';
import { EmptyState } from '../components/EmptyState';
import { EffectsEditor } from '../components/EffectsEditor';
import { OverridesEditor } from '../components/OverridesEditor';
import { RenamerPanel } from '../components/RenamerPanel';
import { TraitBrowser } from '../components/TraitBrowser';
import { RarityBar } from '../components/RarityBar';
import { SpawnEditor } from '../components/SpawnEditor';
import { RulesEditor, type RulesObj } from '../components/RulesEditor';
import { LayerRulesEditor } from '../components/LayerRulesEditor';
import { Tabs, TabPanel, type TabDef } from '../components/Tabs';
import { useToast } from '../components/Toast';
import { cx } from '../lib/cx';
import { bridge } from '../lib/bridge';
import { isCatalogImage } from '../lib/rename';
import { computeTraitTable } from '../lib/traits';
import { useProject, type LayerCfg, type AssetOverrideCfg } from '../state/project';

export function DesignScreen() {
  const { project, config, dirty, save, updateConfig, loading } = useProject();
  const toast = useToast();
  const [counts, setCounts] = useState<Record<number, number | null>>({});
  const [thumbs, setThumbs] = useState<Record<number, string | null>>({});
  const [fileNames, setFileNames] = useState<{ scope: string; entries: Record<number, string[]> }>({ scope: '', entries: {} });
  const thumbRequest = useRef<Record<string, number>>({});
  const projectScopeRef = useRef<string | null>(project?.dir ?? null);
  projectScopeRef.current = project?.dir ?? null;
  const [selected, setSelected] = useState<number | null>(null);
  const [browsing, setBrowsing] = useState<number | null>(null);
  const [tab, setTab] = useState('layers');

  const projectScope = project?.dir ?? '';
  const layersKey = `${projectScope}\0${(config?.layers ?? []).map((l) => l.path).join('|')}`;
  const scopedFileNames = fileNames.scope === layersKey ? fileNames.entries : {};
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
            const r = await fb.listDir(l.path);
            next[i] = r.ok && Array.isArray(r.items) ? r.items.filter(isCatalogImage).length : null;
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

  // Per layer: list the folder once, then derive a representative thumbnail (first image) and
  // keep the image filenames (so the row can show a rarity-distribution bar without refetching).
  useEffect(() => {
    const fb = bridge();
    const layers = config?.layers ?? [];
    if (!fb || layers.length === 0) {
      setThumbs({});
      setFileNames({ scope: layersKey, entries: {} });
      return;
    }
    setThumbs({});
    setFileNames({ scope: layersKey, entries: {} });
    let cancelled = false;
    (async () => {
      const next: Record<number, string | null> = {};
      const names: Record<number, string[]> = {};
      await Promise.all(
        layers.map(async (l, i) => {
          try {
            const dir = await fb.listDir(l.path);
            const imgs = dir.ok && Array.isArray(dir.items) ? dir.items.filter(isCatalogImage) : [];
            names[i] = imgs;
            const name = imgs[0];
            if (!name) {
              next[i] = null;
              return;
            }
            const rel = `${l.path.replace(/[\\/]+$/, '')}/${name}`;
            const r = await fb.readFileBase64(rel);
            next[i] = r.ok && r.base64 ? `data:${r.mime || 'image/png'};base64,${r.base64}` : null;
          } catch {
            next[i] = null;
            names[i] = [];
          }
        }),
      );
      if (!cancelled && projectScopeRef.current === projectScope) {
        setThumbs(next);
        setFileNames({ scope: layersKey, entries: names });
      }
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
        <StageHeader kicker="STAGE 01 // COMPOSITION" title="Design" />
        <EmptyState
          code="NO PROJECT"
          title="No project loaded"
          hint="Open a project from the Projects stage to edit its layers and rarity."
        />
      </div>
    );
  }
  if (!config) {
    return (
      <div className="stack stagger">
        <StageHeader kicker="STAGE 01 // COMPOSITION" title="Design" />
        <EmptyState
          code="NO CONFIG"
          title="No foundry.config.json"
          hint={loading ? 'Loading…' : 'This folder has no readable config.'}
        />
      </div>
    );
  }

  const layers = config.layers ?? [];
  const rarity = (config.rarity ?? {}) as { delimiter?: string; defaultWeight?: number };
  const delimiter = rarity.delimiter ?? '#';
  const defaultWeight = rarity.defaultWeight ?? 1;
  const output = (config.export ?? {}) as {
    outDir?: string;
    previewOutDir?: string;
    imageFormat?: string;
    includePreviewContactSheet?: boolean;
  };
  const uniqueness = (config.uniqueness ?? {}) as { hash?: string; ignore?: string[] };
  const experimental = (config.experimental ?? {}) as {
    compositor?: { superSample?: number; forceCpu?: boolean };
    generation?: { shuffleLayers?: boolean };
  };
  const spawnMapPath = String(
    (config.spawn as { mapPath?: string } | undefined)?.mapPath ?? 'spawn-map.json',
  );
  const transformTraitCatalog = layers.flatMap((layer, index) => {
    if (!layer.name.trim()) return [];
    const traits = computeTraitTable(scopedFileNames[index] ?? [], {
      delimiter,
      defaultWeight,
      uniform: layer.rarity === 'uniform',
    });
    return [
      {
        id: `${project.dir}\0${index}\0${layer.path}`,
        layer: layer.name,
        path: layer.path,
        values: traits.rows.map((row) => row.value),
        filenames: traits.rows.map((row) => row.file),
        baseEffects: { blend: layer.blend, opacity: layer.opacity, ...(layer.effects ?? {}) },
        overrides: layer.overrides,
      },
    ];
  });
  const setBasic = (key: string, value: unknown) =>
    updateConfig((d) => {
      (d as Record<string, unknown>)[key] = value;
    });
  const setImage = (key: string, value: unknown) =>
    updateConfig((d) => {
      d.image = { ...(d.image ?? {}), [key]: value };
    });
  const setOutput = (patch: Record<string, unknown>) =>
    updateConfig((d) => {
      d.export = { ...(d.export ?? {}), ...patch };
    });
  const setExperimental = (area: 'compositor' | 'generation', patch: Record<string, unknown>) =>
    updateConfig((d) => {
      const draft = d as Record<string, unknown>;
      const current = (draft.experimental ?? {}) as Record<string, unknown>;
      const currentArea = (current[area] ?? {}) as Record<string, unknown>;
      draft.experimental = { ...current, [area]: { ...currentArea, ...patch } };
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
      d.layers = [
        ...(d.layers ?? []),
        { name: `Layer ${n}`, path: 'layers/new', rarity: 'filename', required: true },
      ];
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

  // A trait rename changes the filesystem, not foundry.config.json. Keep the layer row's
  // rarity bar and representative thumbnail in sync with the directory listing that the
  // TraitBrowser just reloaded, without touching project dirty state.
  const onTraitFilesChange = (scope: string, index: number, layer: LayerCfg, names: string[]) => {
    if (projectScopeRef.current !== scope) return;
    setFileNames((current) =>
      current.scope === layersKey
        ? { ...current, entries: { ...current.entries, [index]: names } }
        : current,
    );
    const requestKey = `${scope}\0${index}`;
    const request = (thumbRequest.current[requestKey] ?? 0) + 1;
    thumbRequest.current[requestKey] = request;
    const first = names[0];
    const fb = bridge();
    if (!first || !fb) {
      setThumbs((current) => ({ ...current, [index]: null }));
      return;
    }
    void fb
      .readFileBase64(`${layer.path.replace(/[\\/]+$/, '')}/${first}`)
      .then((result) => {
        if (projectScopeRef.current !== scope || thumbRequest.current[requestKey] !== request)
          return;
        setThumbs((current) => ({
          ...current,
          [index]:
            result.ok && result.base64
              ? `data:${result.mime || 'image/png'};base64,${result.base64}`
              : null,
        }));
      })
      .catch(() => {
        if (projectScopeRef.current === scope && thumbRequest.current[requestKey] === request)
          setThumbs((current) => ({ ...current, [index]: null }));
      });
  };

  const tabDefs: TabDef[] = [
    { id: 'basics', label: 'Basics' },
    { id: 'layers', label: 'Layers', badge: layers.length || undefined },
    { id: 'assets', label: 'Assets & rarity' },
    { id: 'rules', label: 'Rules' },
  ];

  return (
    <div className="stack stagger">
      <StageHeader
        kicker="STAGE 01 // COMPOSITION"
        title="Design"
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
              <Input
                value={config.symbol ?? ''}
                onChange={(e) => setBasic('symbol', e.target.value)}
              />
            </Field>
            <Field label="Edition size">
              <Input
                type="number"
                value={config.editionSize ?? ''}
                onChange={(e) => setBasic('editionSize', Number(e.target.value) || 0)}
              />
            </Field>
            <Field label="Image width">
              <Input
                type="number"
                value={config.image?.width ?? ''}
                onChange={(e) => setImage('width', Number(e.target.value) || 0)}
              />
            </Field>
            <Field label="Image height">
              <Input
                type="number"
                value={config.image?.height ?? ''}
                onChange={(e) => setImage('height', Number(e.target.value) || 0)}
              />
            </Field>
            <Field label="Background">
              <Input
                value={config.image?.background ?? ''}
                onChange={(e) => setImage('background', e.target.value)}
                placeholder="transparent or #RRGGBB"
              />
            </Field>
          </div>
        </Panel>
        <Panel title="Output, uniqueness & engine">
          <div className="stack">
            <div className="grid cols-auto">
              <Field label="Output folder">
                <Input
                  value={output.outDir ?? ''}
                  onChange={(event) => setOutput({ outDir: event.target.value })}
                  placeholder="build"
                />
              </Field>
              <Field label="Preview output folder">
                <Input
                  value={output.previewOutDir ?? ''}
                  onChange={(event) =>
                    setOutput({ previewOutDir: event.target.value.trim() || undefined })
                  }
                  placeholder="preview"
                />
              </Field>
              <Field label="Image format">
                <Select
                  value={output.imageFormat ?? 'png'}
                  onChange={(event) => setOutput({ imageFormat: event.target.value })}
                >
                  <option value="png">png</option>
                  <option value="webp">webp</option>
                  <option value="gif">gif</option>
                </Select>
              </Field>
              <Field label="Ignored uniqueness traits">
                <Input
                  value={(uniqueness.ignore ?? []).join(', ')}
                  onChange={(event) =>
                    updateConfig((d) => {
                      const draft = d as Record<string, unknown>;
                      const current = (draft.uniqueness ?? {}) as Record<string, unknown>;
                      draft.uniqueness = {
                        ...current,
                        hash: uniqueness.hash ?? 'sha256',
                        ignore: event.target.value
                          .split(',')
                          .map((item) => item.trim())
                          .filter(Boolean),
                      };
                    })
                  }
                  placeholder="Layer:Value, Layer:Value"
                />
              </Field>
            </div>
            <label className="row">
              <input
                type="checkbox"
                checked={!!output.includePreviewContactSheet}
                onChange={(event) =>
                  setOutput({ includePreviewContactSheet: event.target.checked })
                }
              />{' '}
              <span className="label">Include preview contact sheet</span>
            </label>
            <div className="grid cols-auto">
              <Field label="Compositor supersampling">
                <Input
                  type="number"
                  min="1"
                  max="4"
                  value={experimental.compositor?.superSample ?? 1}
                  onChange={(event) =>
                    setExperimental('compositor', {
                      superSample: Math.max(1, Math.min(4, Number(event.target.value) || 1)),
                    })
                  }
                />
              </Field>
              <label className="row self-end">
                <input
                  type="checkbox"
                  checked={!!experimental.compositor?.forceCpu}
                  onChange={(event) =>
                    setExperimental('compositor', { forceCpu: event.target.checked })
                  }
                />{' '}
                <span className="label">Force CPU compositor</span>
              </label>
              <label className="row self-end">
                <input
                  type="checkbox"
                  checked={!!experimental.generation?.shuffleLayers}
                  onChange={(event) =>
                    setExperimental('generation', { shuffleLayers: event.target.checked })
                  }
                />{' '}
                <span className="label">Shuffle layers</span>
              </label>
            </div>
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
            <EmptyState
              code="NO LAYERS"
              title="No layers yet"
              hint="Add a layer and point it at an image folder."
              action={<Button onClick={addLayer}>+ Add layer</Button>}
            />
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
                  <Input
                    value={l.name}
                    onChange={(e) => setLayer(i, { name: e.target.value })}
                    aria-label={`Layer ${i + 1} name`}
                  />
                  <Input
                    value={l.path}
                    onChange={(e) => setLayer(i, { path: e.target.value })}
                    aria-label={`Layer ${i + 1} path`}
                  />
                  <Select
                    value={l.rarity ?? 'filename'}
                    onChange={(e) =>
                      setLayer(i, { rarity: e.target.value as 'filename' | 'uniform' })
                    }
                    aria-label={`Layer ${i + 1} rarity`}
                  >
                    <option value="filename">filename</option>
                    <option value="uniform">uniform</option>
                  </Select>
                  <input
                    type="checkbox"
                    checked={!!l.required}
                    onChange={(e) => setLayer(i, { required: e.target.checked })}
                    aria-label={`Layer ${i + 1} required`}
                  />
                  <Input
                    type="number"
                    step="0.05"
                    min="0"
                    max="1"
                    value={l.opacity ?? ''}
                    onChange={(e) =>
                      setLayer(i, {
                        opacity: e.target.value === '' ? undefined : Number(e.target.value),
                      })
                    }
                    aria-label={`Layer ${i + 1} opacity`}
                  />
                  <span className="stack" style={{ gap: 4, minWidth: 0 }}>
                    <span className="mono muted">{counts[i] == null ? '—' : counts[i]}</span>
                    <RarityBar
                      rows={computeTraitTable(scopedFileNames[i] ?? [], {
                        delimiter,
                        defaultWeight,
                        uniform: l.rarity === 'uniform',
                      }).rows.map((r) => ({ value: r.value, probability: r.probability }))}
                    />
                  </span>
                  <span className="row">
                    <Button
                      size="sm"
                      onClick={() => setBrowsing(browsing === i ? null : i)}
                      aria-label={`Browse layer ${i + 1} traits`}
                      aria-expanded={browsing === i}
                    >
                      traits
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => setSelected(selected === i ? null : i)}
                      aria-label={`Edit layer ${i + 1} effects`}
                    >
                      fx
                    </Button>
                    <Button
                      size="sm"
                      icon
                      onClick={() => move(i, i - 1)}
                      aria-label="Move up"
                      disabled={i === 0}
                    >
                      ▲
                    </Button>
                    <Button
                      size="sm"
                      icon
                      onClick={() => move(i, i + 1)}
                      aria-label="Move down"
                      disabled={i === layers.length - 1}
                    >
                      ▼
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      icon
                      onClick={() => removeLayer(i)}
                      aria-label="Remove layer"
                    >
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
            <TraitBrowser
              layer={layers[browsing]!}
              delimiter={delimiter}
              defaultWeight={defaultWeight}
              scopeKey={project.dir}
              onFilesChange={(names) =>
                onTraitFilesChange(project.dir, browsing, layers[browsing]!, names)
              }
            />
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
            <div className="mt-4">
              <LayerRulesEditor
                layer={layers[selected]!}
                onChange={(patch) => setLayer(selected, patch)}
              />
            </div>
            <div className="mt-4">
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
                if (cur !== p)
                  updateConfig((d) => {
                    d.spawn = { ...((d.spawn as object) ?? {}), mapPath: p };
                  });
              }}
            />
          </div>
        ) : (
          <EmptyState
            code="NO LAYERS"
            title="No layers yet"
            hint="Add a layer in the Layers tab to set rarity weights and spawn maps."
          />
        )}
      </TabPanel>

      <TabPanel id="rules" active={tab}>
        <RulesEditor
          value={(config.rules ?? {}) as RulesObj}
        layerNames={layers.map((layer) => layer.name).filter(Boolean)}
        traitCatalog={transformTraitCatalog}
        imageWidth={config.image?.width ?? 1024}
        imageHeight={config.image?.height ?? 1024}
        projectScope={project.dir}
          setRules={(next) =>
            updateConfig((d) => {
              d.rules = next;
            })
          }
        />
      </TabPanel>
    </div>
  );
}
