import { useEffect, useState } from 'react';
import { Panel } from '../components/Panel';
import { StageHeader } from '../components/StageHeader';
import { Button } from '../components/Button';
import { Field, Input, Select } from '../components/Field';
import { EmptyState } from '../components/EmptyState';
import { useToast } from '../components/Toast';
import { MintExperience } from '../components/MintExperience';
import { cx } from '../lib/cx';
import { bridge, isBridged } from '../lib/bridge';
import { listPacks, readPackDataUrl, resolveExperienceArt, type PackEntry } from '../lib/packLibrary';
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
  const [packs, setPacks] = useState<PackEntry[]>([]);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [art, setArt] = useState<Partial<ExperienceConfig>>({});

  const set = (patch: Partial<ExperienceConfig>): void => setExp((e) => resolveExperience({ ...e, ...patch }));

  // Load the app-level pack library (thumbnails for the picker).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const list = await listPacks();
      if (cancelled) return;
      setPacks(list);
      const next: Record<string, string> = {};
      await Promise.all(
        list.map(async (p) => {
          const url = await readPackDataUrl(p.id);
          if (url) next[p.id] = url;
        }),
      );
      if (!cancelled) setThumbs(next);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Resolve the chosen pack/back/rarity ids → images for the live preview (pack, default
  // back, per-tier backs, and the torn-open pack variant).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const r = await resolveExperienceArt(exp);
      if (!cancelled)
        setArt({
          packArt: r.packArt,
          backArt: r.backArt,
          tierBacks: r.tierBacks,
          packOpenArt: r.packOpenArt,
          packOpenFrontArt: r.packOpenFrontArt,
          packOpenBackArt: r.packOpenBackArt,
        });
    })();
    return () => {
      cancelled = true;
    };
  }, [exp.packId, exp.backId, exp.rarityBacks]);

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

  // Preview uses the resolved art (packId/backId → data URL), falling back to any inline art.
  const previewExp: ExperienceConfig = { ...exp, ...art };

  // --- rarity backs ---
  const backsList = packs.filter((p) => p.kind === 'back');
  const rules = exp.rarityBacks ?? [];
  const addRule = (): void => {
    const first = backsList[0];
    if (!first) {
      toast.push('Add a card back to the library first', 'danger');
      return;
    }
    set({ rarityBacks: [...rules, { tier: `Tier ${rules.length + 1}`, backId: first.id }] });
  };
  const updateRule = (i: number, patch: Partial<{ tier: string; backId: string }>): void =>
    set({ rarityBacks: rules.map((r, j) => (j === i ? { ...r, ...patch } : r)) });
  const removeRule = (i: number): void => set({ rarityBacks: rules.filter((_, j) => j !== i) });

  // Preview simulation: make the last card use the first rarity tier so the rare back shows.
  const previewTiers =
    rules.length > 0 ? Array.from({ length: exp.packCount }, (_, i) => (i === exp.packCount - 1 ? rules[0]!.tier : '')) : [];

  const picker = (kind: 'pack' | 'back', selectedId: string | undefined, onPick: (id: string | undefined) => void) => {
    const items = packs.filter((p) => p.kind === kind);
    return (
      <div className="stack" style={{ gap: 4 }}>
        <span className="label">{kind === 'pack' ? 'PACK' : 'CARD BACK'}</span>
        <div className="row wrap">
          <button type="button" className={cx('pack-pick', !selectedId && 'pack-pick--sel')} onClick={() => onPick(undefined)}>
            None
          </button>
          {items.map((p) => (
            <button
              key={p.id}
              type="button"
              className={cx('pack-pick', selectedId === p.id && 'pack-pick--sel')}
              onClick={() => onPick(p.id)}
              title={p.name}
              aria-label={`Use ${p.name}`}
              aria-pressed={selectedId === p.id}
            >
              {thumbs[p.id] ? <img src={thumbs[p.id]} alt={p.name} /> : <span className="pack-pick__ph">{p.name}</span>}
            </button>
          ))}
        </div>
      </div>
    );
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
                Pick a pack (and optional card back) from your app-level library — selecting stores a small reference, and
                the image ships with the mint site at export. Add or manage art in the <strong>Packs</strong> stage.
              </span>
              {packs.length === 0 ? (
                <EmptyState code="EMPTY" title="No packs in the library" hint="Add packs in the Packs stage, then pick one here." />
              ) : (
                <>
                  {picker('pack', exp.packId, (id) => set({ packId: id }))}
                  {picker('back', exp.backId, (id) => set({ backId: id }))}
                  <div className="stack" style={{ gap: 4 }}>
                    <div className="row spread">
                      <span className="label">RARITY BACKS (optional)</span>
                      <Button size="sm" onClick={addRule} disabled={backsList.length === 0}>
                        + Rarity rule
                      </Button>
                    </div>
                    <span className="label muted">
                      Cards of a tier flip to a designated back instead of the default. Live mint maps a card's tier from
                      its rarity rank; the preview simulates one rare card.
                    </span>
                    {rules.map((r, i) => (
                      <div className="grid cols-auto" key={i}>
                        <Field label="Tier">
                          <Input value={r.tier} onChange={(e) => updateRule(i, { tier: e.target.value })} aria-label={`Rarity tier ${i + 1}`} />
                        </Field>
                        <Field label="Back">
                          <Select value={r.backId} onChange={(e) => updateRule(i, { backId: e.target.value })} aria-label={`Rarity back ${i + 1}`}>
                            {backsList.map((b) => (
                              <option key={b.id} value={b.id}>
                                {b.name}
                              </option>
                            ))}
                          </Select>
                        </Field>
                        <div style={{ alignSelf: 'end' }}>
                          <Button size="sm" variant="danger" icon onClick={() => removeRule(i)} aria-label={`Remove rarity rule ${i + 1}`}>
                            ✕
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
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
            <MintExperience key={replayKey} config={previewExp} images={images} cardTiers={previewTiers} />
          </Panel>
        </>
      )}
    </div>
  );
}
