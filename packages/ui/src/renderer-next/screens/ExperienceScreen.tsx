import { useState } from 'react';
import { Panel } from '../components/Panel';
import { StageHeader } from '../components/StageHeader';
import { Button } from '../components/Button';
import { Field, Input, Select } from '../components/Field';
import { EmptyState } from '../components/EmptyState';
import { useToast } from '../components/Toast';
import { MintExperience } from '../components/MintExperience';
import { bridge, isBridged } from '../lib/bridge';
import { useProject } from '../state/project';
import {
  EXPERIENCE_KINDS,
  EXPERIENCE_PRESETS,
  resolveExperience,
  type ExperienceConfig,
  type ExperienceKind,
} from '../lib/mintExperience';

export function ExperienceScreen() {
  const { project, config, updateConfig, save } = useProject();
  const toast = useToast();
  const [exp, setExp] = useState<ExperienceConfig>(() =>
    resolveExperience(config?.mintExperience as Partial<ExperienceConfig> | undefined),
  );
  const [images, setImages] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [replayKey, setReplayKey] = useState(0);
  const [packPath, setPackPath] = useState('packs/conkerco-default.png');
  const [backPath, setBackPath] = useState('');
  const [loadingArt, setLoadingArt] = useState<string | null>(null);

  const set = (patch: Partial<ExperienceConfig>): void => setExp((e) => resolveExperience({ ...e, ...patch }));

  // Load a finished pack / card-back image from the project into the config as a self-contained
  // data URL (so it renders identically in this preview and the exported static mint site).
  const loadImageArt = async (which: 'packArt' | 'backArt', rel: string): Promise<void> => {
    const fb = bridge();
    if (!fb) {
      toast.push('Bridge offline — load in the desktop app', 'danger');
      return;
    }
    const p = rel.trim();
    if (!p) {
      toast.push('Enter a project-relative image path', 'danger');
      return;
    }
    setLoadingArt(which);
    try {
      const r = await fb.readFileBase64(p);
      if (r.ok && r.base64) {
        set({ [which]: `data:${r.mime || 'image/png'};base64,${r.base64}` } as Partial<ExperienceConfig>);
        toast.push(`${which === 'packArt' ? 'Pack' : 'Card back'} image loaded`, 'ok');
      } else {
        toast.push(r.error ?? 'Could not read that image', 'danger');
      }
    } catch (e) {
      toast.push(String((e as Error)?.message ?? e), 'danger');
    } finally {
      setLoadingArt(null);
    }
  };
  const clearArt = (which: 'packArt' | 'backArt'): void => set({ [which]: undefined } as Partial<ExperienceConfig>);

  const applyPreset = (name: string): void => {
    const p = EXPERIENCE_PRESETS[name];
    if (p) setExp(resolveExperience(p));
  };

  const loadArt = async (): Promise<void> => {
    const fb = bridge();
    if (!fb || !config) {
      toast.push('Open a project to load live art', 'danger');
      return;
    }
    setBusy(true);
    try {
      const r = await fb.previewLive(config, Math.max(1, Math.min(12, exp.packCount)), `exp:${Date.now().toString(36)}`);
      if (r.ok && Array.isArray(r.images)) {
        const mime = r.format === 'webp' ? 'image/webp' : 'image/png';
        setImages(r.images.map((b) => `data:${mime};base64,${b}`));
        toast.push(`Loaded ${r.images.length} preview cards`, 'ok');
      } else {
        toast.push(r.error ?? 'Preview failed', 'danger');
      }
    } catch (e) {
      toast.push(String((e as Error)?.message ?? e), 'danger');
    } finally {
      setBusy(false);
    }
  };

  const onSave = async (): Promise<void> => {
    updateConfig((d) => {
      (d as Record<string, unknown>).mintExperience = exp;
    });
    const ok = await save();
    if (ok) toast.push('Mint experience saved', 'ok');
  };

  return (
    <div className="stack stagger">
      <StageHeader
        kicker="STAGE // MINT FX"
        title="Mint experience"
        actions={
          <div className="row">
            <Button onClick={onSave} variant="primary" disabled={!project}>
              Save
            </Button>
          </div>
        }
      />

      {!project ? (
        <EmptyState code="NO PROJECT" title="No project loaded" hint="Open a project to design its mint experience." />
      ) : (
        <>
          <Panel title="Experience">
            <div className="stack">
              <div className="grid cols-auto">
                <Field label="Preset">
                  <Select aria-label="Preset" value="" onChange={(e) => e.target.value && applyPreset(e.target.value)}>
                    <option value="">Custom…</option>
                    {Object.keys(EXPERIENCE_PRESETS).map((k) => (
                      <option key={k} value={k}>
                        {k}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Kind">
                  <Select aria-label="Kind" value={exp.kind} onChange={(e) => set({ kind: e.target.value as ExperienceKind })}>
                    {EXPERIENCE_KINDS.map((k) => (
                      <option key={k} value={k}>
                        {k}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Cards">
                  <Input type="number" min="1" max="12" value={exp.packCount} onChange={(e) => set({ packCount: Number(e.target.value) || 1 })} />
                </Field>
                <Field label="Duration ms">
                  <Input type="number" min="50" max="5000" value={exp.durationMs} onChange={(e) => set({ durationMs: Number(e.target.value) || 600 })} />
                </Field>
                <Field label="Label">
                  <Input value={exp.label} onChange={(e) => set({ label: e.target.value })} />
                </Field>
                <Field label="Accent">
                  <Input value={exp.accent ?? ''} onChange={(e) => set({ accent: e.target.value })} placeholder="(theme accent)" />
                </Field>
              </div>
              <label className="row">
                <input type="checkbox" checked={exp.shake} onChange={(e) => set({ shake: e.target.checked })} aria-label="Pack shakes" />
                <span className="label">Pack shakes (card-pack)</span>
              </label>
              <label className="row">
                <input type="checkbox" checked={exp.autoFlip} onChange={(e) => set({ autoFlip: e.target.checked })} aria-label="Auto-flip cards" />
                <span className="label">Auto-flip cards</span>
              </label>
              <div className="row">
                <Button size="sm" onClick={loadArt} disabled={busy || !isBridged()}>
                  {busy ? 'Loading…' : 'Use live art'}
                </Button>
                <span className="label muted">Pulls rendered previews to use as the revealed card art.</span>
              </div>
            </div>
          </Panel>

          <Panel title="Pack & card art">
            <div className="stack">
              <span className="label muted">
                Use your own finished pack art as the sealed pack that rips open (and an optional custom card back).
                Point to a project-relative image path, then Load — it's embedded into the config so it ships with the
                mint site.
              </span>
              <div className="grid cols-auto">
                <Field label="Pack image (path)">
                  <Input value={packPath} onChange={(e) => setPackPath(e.target.value)} placeholder="packs/your-pack.png" aria-label="Pack image path" />
                </Field>
                <div className="row" style={{ alignSelf: 'end' }}>
                  <Button size="sm" onClick={() => loadImageArt('packArt', packPath)} disabled={loadingArt !== null || !isBridged()}>
                    {loadingArt === 'packArt' ? 'Loading…' : 'Load pack'}
                  </Button>
                  {exp.packArt ? (
                    <Button size="sm" variant="ghost" onClick={() => clearArt('packArt')}>
                      Clear
                    </Button>
                  ) : null}
                </div>
                <Field label="Card back (path, optional)">
                  <Input value={backPath} onChange={(e) => setBackPath(e.target.value)} placeholder="packs/card-back.png" aria-label="Card back path" />
                </Field>
                <div className="row" style={{ alignSelf: 'end' }}>
                  <Button size="sm" onClick={() => loadImageArt('backArt', backPath)} disabled={loadingArt !== null || !isBridged()}>
                    {loadingArt === 'backArt' ? 'Loading…' : 'Load back'}
                  </Button>
                  {exp.backArt ? (
                    <Button size="sm" variant="ghost" onClick={() => clearArt('backArt')}>
                      Clear
                    </Button>
                  ) : null}
                </div>
              </div>
              <div className="row" style={{ gap: 'var(--sp-4)' }}>
                {exp.packArt ? (
                  <div className="stack" style={{ gap: 4 }}>
                    <span className="label">PACK</span>
                    <img src={exp.packArt} alt="Pack art" style={{ height: 130, borderRadius: 'var(--r-sm)', border: 'var(--hair) solid var(--line)' }} />
                  </div>
                ) : null}
                {exp.backArt ? (
                  <div className="stack" style={{ gap: 4 }}>
                    <span className="label">CARD BACK</span>
                    <img src={exp.backArt} alt="Card back art" style={{ height: 130, borderRadius: 'var(--r-sm)', border: 'var(--hair) solid var(--line)' }} />
                  </div>
                ) : null}
              </div>
            </div>
          </Panel>

          <Panel
            title="Preview"
            actions={
              <div className="row">
                <Button size="sm" variant="ghost" onClick={() => setReplayKey((k) => k + 1)}>
                  Replay
                </Button>
                <span className="label">{images.length ? `${images.length} CARDS` : 'PLACEHOLDER ART'}</span>
              </div>
            }
          >
            <MintExperience key={replayKey} config={exp} images={images} />
          </Panel>
        </>
      )}
    </div>
  );
}
