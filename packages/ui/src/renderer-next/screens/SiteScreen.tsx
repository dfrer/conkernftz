import { useState } from 'react';
import { Panel } from '../components/Panel';
import { StageHeader } from '../components/StageHeader';
import { Button } from '../components/Button';
import { Field, Input, Select } from '../components/Field';
import { EmptyState } from '../components/EmptyState';
import { useToast } from '../components/Toast';
import { SiteRenderer } from '../components/site/SiteRenderer';
import { SiteCanvas } from '../components/site/SiteCanvas';
import { bridge, isBridged } from '../lib/bridge';
import { useProject } from '../state/project';
import { resolveExperience, type ExperienceConfig } from '../lib/mintExperience';
import { resolveExperienceArt } from '../lib/packLibrary';
import { buildSiteData, siteDataScript, SITE_DATA_FILENAME } from '../lib/siteBundle';
import {
  BLOCK_KINDS,
  BLOCK_LABELS,
  addBlock,
  blockHasText,
  clampFontScale,
  SITE_ALIGNS,
  defaultLayout,
  defaultSite,
  moveBlock,
  removeBlock,
  resolveSite,
  setBlockLayout,
  setBlockMobile,
  setCanvas,
  setLayoutMode,
  setPageBg,
  setTheme,
  updateBlock,
  type Block,
  type BlockKind,
  type SiteConfig,
} from '../lib/site';
import { SITE_TEMPLATES, type SiteTemplate } from '../lib/siteTemplates';

type Viewport = 'desktop' | 'mobile';

// Built-in tiled wallpapers (the GeoCities staple). Small repeating SVG data-URIs that sit
// over the page background color — look best on a dark bg.
const WALLPAPERS: Record<string, string> = {
  none: '',
  stars:
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='60'%3E%3Ccircle cx='10' cy='12' r='1' fill='white'/%3E%3Ccircle cx='42' cy='30' r='1.3' fill='white'/%3E%3Ccircle cx='26' cy='50' r='.8' fill='white'/%3E%3C/svg%3E",
  dots:
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24'%3E%3Ccircle cx='3' cy='3' r='1.5' fill='white' opacity='.25'/%3E%3C/svg%3E",
  grid:
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32'%3E%3Cpath d='M0 0H32V32' fill='none' stroke='white' stroke-opacity='.15'/%3E%3C/svg%3E",
};

export function SiteScreen() {
  const { project, config, updateConfig, save } = useProject();
  const toast = useToast();
  const [site, setSite] = useState<SiteConfig>(() => {
    const existing = config?.site as Partial<SiteConfig> | undefined;
    const r = existing ? resolveSite(existing) : defaultSite();
    return r.blocks.length ? r : defaultSite();
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [images, setImages] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [previewingLocal, setPreviewingLocal] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [vercelToken, setVercelToken] = useState<string>(() => {
    try {
      return localStorage.getItem('cnftz:vercelToken') ?? '';
    } catch {
      return '';
    }
  });
  const [viewport, setViewport] = useState<Viewport>('desktop');

  const mode = site.layout ?? 'flow';
  const experience: ExperienceConfig = resolveExperience(config?.mintExperience as Partial<ExperienceConfig> | undefined);
  const selected = site.blocks.find((b) => b.id === selectedId) ?? site.blocks[0] ?? null;
  const selIndex = selected ? site.blocks.findIndex((b) => b.id === selected.id) : -1;
  const setField = (patch: Record<string, unknown>): void => {
    if (selected) setSite(updateBlock(site, selected.id, patch));
  };

  const add = (kind: BlockKind): void => {
    const next = addBlock(site, kind);
    setSite(next);
    setSelectedId(next.blocks[next.blocks.length - 1]!.id);
  };

  const applyTemplate = (t: SiteTemplate): void => {
    setSite(t.build());
    setSelectedId(null);
    toast.push(`Applied “${t.label}” template`, 'ok');
  };

  const onMove = (id: string, x: number, y: number): void =>
    setSite(viewport === 'mobile' ? setBlockMobile(site, id, { x, y }) : setBlockLayout(site, id, { x, y }));
  const onResize = (id: string, w: number, h: number): void =>
    setSite(viewport === 'mobile' ? setBlockMobile(site, id, { w, h }) : setBlockLayout(site, id, { w, h }));

  const loadArt = async (): Promise<void> => {
    const fb = bridge();
    if (!fb || !config) {
      toast.push('Open a project to load live art', 'danger');
      return;
    }
    setBusy(true);
    try {
      const r = await fb.previewLive(config, 8, `site:${Date.now().toString(36)}`);
      if (r.ok && Array.isArray(r.images)) {
        const mime = r.format === 'webp' ? 'image/webp' : 'image/png';
        setImages(r.images.map((b) => `data:${mime};base64,${b}`));
        toast.push(`Loaded ${r.images.length} preview images`, 'ok');
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
      (d as Record<string, unknown>).site = site;
    });
    const ok = await save();
    if (ok) toast.push('Mint site saved', 'ok');
  };

  const generateSite = async (): Promise<void> => {
    const fb = bridge();
    if (!fb || !config) {
      toast.push('Open a project first', 'danger');
      return;
    }
    setExporting(true);
    try {
      let imgs = images;
      try {
        const r = await fb.previewLive(config, 8, `site:${Date.now().toString(36)}`);
        if (r.ok && Array.isArray(r.images)) {
          const mime = r.format === 'webp' ? 'image/webp' : 'image/png';
          imgs = r.images.map((b) => `data:${mime};base64,${b}`);
          setImages(imgs);
        }
      } catch {
        /* fall back to existing images / placeholders */
      }
      const bundle = buildSiteData({
        name: typeof config.name === 'string' ? config.name : undefined,
        site,
        experience: await resolveExperienceArt(experience),
        images: imgs,
      });
      const res = await fb.exportSite({ dataJs: siteDataScript(bundle), dataFile: SITE_DATA_FILENAME });
      if (res.ok && res.outDir) {
        toast.push(`Static site exported → ${res.outDir}`, 'ok');
        fb.openInExplorer(res.outDir);
      } else {
        toast.push(res.error ?? 'Export failed', 'danger');
      }
    } catch (e) {
      toast.push(String((e as Error)?.message ?? e), 'danger');
    } finally {
      setExporting(false);
    }
  };

  const previewLocal = async (): Promise<void> => {
    const fb = bridge();
    if (!fb || !config) {
      toast.push('Open a project first', 'danger');
      return;
    }
    setPreviewingLocal(true);
    try {
      let imgs = images;
      try {
        const r = await fb.previewLive(config, 8, `site:${Date.now().toString(36)}`);
        if (r.ok && Array.isArray(r.images)) {
          const mime = r.format === 'webp' ? 'image/webp' : 'image/png';
          imgs = r.images.map((b) => `data:${mime};base64,${b}`);
          setImages(imgs);
        }
      } catch {
        /* placeholders ok */
      }
      const bundle = buildSiteData({
        name: typeof config.name === 'string' ? config.name : undefined,
        site,
        experience: await resolveExperienceArt(experience),
        images: imgs,
      });
      const ex = await fb.exportSite({ dataJs: siteDataScript(bundle), dataFile: SITE_DATA_FILENAME });
      if (!ex.ok) {
        toast.push(ex.error ?? 'Export failed', 'danger');
        return;
      }
      const pv = await fb.previewSite();
      if (pv.ok && pv.url) toast.push(`Preview opened — ${pv.url}`, 'ok');
      else toast.push(pv.error ?? 'Preview failed', 'danger');
    } catch (e) {
      toast.push(String((e as Error)?.message ?? e), 'danger');
    } finally {
      setPreviewingLocal(false);
    }
  };

  const onVercelToken = (v: string): void => {
    setVercelToken(v);
    try {
      localStorage.setItem('cnftz:vercelToken', v);
    } catch {
      /* ignore */
    }
  };

  const deploy = async (): Promise<void> => {
    const fb = bridge();
    if (!fb || !config) {
      toast.push('Open a project first', 'danger');
      return;
    }
    if (!vercelToken.trim()) {
      toast.push('Add your Vercel token first', 'danger');
      return;
    }
    setDeploying(true);
    try {
      // 1) generate a fresh export (with live art)
      let imgs = images;
      try {
        const r = await fb.previewLive(config, 8, `site:${Date.now().toString(36)}`);
        if (r.ok && Array.isArray(r.images)) {
          const mime = r.format === 'webp' ? 'image/webp' : 'image/png';
          imgs = r.images.map((b) => `data:${mime};base64,${b}`);
          setImages(imgs);
        }
      } catch {
        /* placeholders ok */
      }
      const bundle = buildSiteData({
        name: typeof config.name === 'string' ? config.name : undefined,
        site,
        experience: await resolveExperienceArt(experience),
        images: imgs,
      });
      const ex = await fb.exportSite({ dataJs: siteDataScript(bundle), dataFile: SITE_DATA_FILENAME });
      if (!ex.ok) {
        toast.push(ex.error ?? 'Export failed', 'danger');
        return;
      }
      // 2) deploy it
      toast.push('Deploying to Vercel… (first run can take a minute)', 'ok');
      const dep = await fb.deploySite({ provider: 'vercel', token: vercelToken.trim() });
      if (dep.ok && dep.url) {
        toast.push(`Live at ${dep.url}`, 'ok');
        fb.openExternal(dep.url);
      } else {
        toast.push(dep.error ?? 'Deploy failed', 'danger');
      }
    } catch (e) {
      toast.push(String((e as Error)?.message ?? e), 'danger');
    } finally {
      setDeploying(false);
    }
  };

  const lay = selected ? (selected.layout ?? defaultLayout(Math.max(0, selIndex))) : null;
  const canvas = site.canvas ?? { width: 960, height: 1400 };
  const pageBg = site.pageBg ?? { kind: 'theme' as const, color: '#101312', tile: '' };

  return (
    <div className="stack stagger">
      <StageHeader
        kicker="STAGE // MINT SITE"
        title="Site builder"
        actions={
          <div className="row">
            <Button size="sm" onClick={loadArt} disabled={busy || !isBridged()}>
              {busy ? 'Loading…' : 'Use live art'}
            </Button>
            <Button size="sm" onClick={generateSite} disabled={exporting || !isBridged()}>
              {exporting ? 'Generating…' : 'Generate site'}
            </Button>
            <Button size="sm" onClick={previewLocal} disabled={previewingLocal || !isBridged()}>
              {previewingLocal ? 'Opening…' : 'Preview locally'}
            </Button>
            <Button onClick={onSave} variant="primary" disabled={!project}>
              Save
            </Button>
          </div>
        }
      />

      {!project ? (
        <EmptyState code="NO PROJECT" title="No project loaded" hint="Open a project to build its mint site." />
      ) : (
        <>
          <Panel title="Templates" actions={<span className="label">START FROM A LAYOUT</span>}>
            <div className="row wrap">
              {SITE_TEMPLATES.map((t) => (
                <button key={t.id} type="button" className="template-card" onClick={() => applyTemplate(t)}>
                  <span className="template-card__name">{t.label}</span>
                  <span className="template-card__desc">{t.description}</span>
                </button>
              ))}
            </div>
          </Panel>

          <Panel title="Layout & page">
            <div className="grid cols-auto">
              <Field label="Layout">
                <Select aria-label="Layout mode" value={mode} onChange={(e) => setSite(setLayoutMode(site, e.target.value as 'flow' | 'canvas'))}>
                  <option value="flow">flow (stacked)</option>
                  <option value="canvas">canvas (free-form / GeoCities)</option>
                </Select>
              </Field>
              {mode === 'canvas' ? (
                <>
                  <Field label="Viewport">
                    <Select aria-label="Viewport" value={viewport} onChange={(e) => setViewport(e.target.value as Viewport)}>
                      <option value="desktop">desktop</option>
                      <option value="mobile">mobile</option>
                    </Select>
                  </Field>
                  <Field label="Canvas W">
                    <Input type="number" min="320" max="4096" value={canvas.width} onChange={(e) => setSite(setCanvas(site, { width: Number(e.target.value) || 960 }))} aria-label="Canvas width" />
                  </Field>
                  <Field label="Canvas H">
                    <Input type="number" min="320" max="12000" value={canvas.height} onChange={(e) => setSite(setCanvas(site, { height: Number(e.target.value) || 1400 }))} aria-label="Canvas height" />
                  </Field>
                </>
              ) : null}
              <Field label="Background">
                <Select aria-label="Page background kind" value={pageBg.kind} onChange={(e) => setSite(setPageBg(site, { kind: e.target.value as 'theme' | 'color' | 'tile' }))}>
                  <option value="theme">theme</option>
                  <option value="color">solid color</option>
                  <option value="tile">tiled image</option>
                </Select>
              </Field>
              {pageBg.kind === 'color' ? (
                <Field label="BG color">
                  <Input value={pageBg.color} onChange={(e) => setSite(setPageBg(site, { color: e.target.value }))} aria-label="Background color" />
                </Field>
              ) : null}
              {pageBg.kind === 'tile' ? (
                <>
                  <Field label="Wallpaper">
                    <Select aria-label="Wallpaper preset" value="" onChange={(e) => e.target.value && setSite(setPageBg(site, { tile: WALLPAPERS[e.target.value] ?? '' }))}>
                      <option value="">Preset…</option>
                      {Object.keys(WALLPAPERS).map((k) => (
                        <option key={k} value={k}>
                          {k}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Tile URL">
                    <Input value={pageBg.tile} onChange={(e) => setSite(setPageBg(site, { tile: e.target.value }))} placeholder="data: or https URL" aria-label="Background tile" />
                  </Field>
                </>
              ) : null}
            </div>
          </Panel>

          <Panel title="Theme">
            <div className="grid cols-auto">
              <Field label="Accent">
                <Input value={site.theme.accent} onChange={(e) => setSite(setTheme(site, { accent: e.target.value }))} />
              </Field>
              <Field label="Theme bg">
                <Select aria-label="Theme background" value={site.theme.background} onChange={(e) => setSite(setTheme(site, { background: e.target.value as SiteConfig['theme']['background'] }))}>
                  <option value="ink">ink</option>
                  <option value="void">void</option>
                  <option value="manila">manila</option>
                  <option value="paper">paper</option>
                </Select>
              </Field>
              <Field label="Font">
                <Select aria-label="Font" value={site.theme.font} onChange={(e) => setSite(setTheme(site, { font: e.target.value as SiteConfig['theme']['font'] }))}>
                  <option value="sans">sans</option>
                  <option value="mono">mono</option>
                  <option value="display">display</option>
                </Select>
              </Field>
            </div>
          </Panel>

          <Panel title="Blocks" actions={<span className="label">{site.blocks.length} BLOCKS</span>}>
            <div className="stack">
              <div className="row" style={{ flexWrap: 'wrap' }}>
                {BLOCK_KINDS.map((k) => (
                  <Button key={k} size="sm" variant="ghost" onClick={() => add(k)}>
                    + {BLOCK_LABELS[k]}
                  </Button>
                ))}
              </div>
              <div className="stack">
                {site.blocks.map((b, i) => (
                  <div key={b.id} className={`row block-row${selected?.id === b.id ? ' block-row--sel' : ''}`}>
                    <button type="button" className="block-row-label" onClick={() => setSelectedId(b.id)} aria-label={`Select block ${i + 1} (${BLOCK_LABELS[b.kind]})`}>
                      <span className="label">{i + 1}. {BLOCK_LABELS[b.kind]}</span>
                    </button>
                    <Button size="sm" variant="ghost" icon onClick={() => setSite(moveBlock(site, b.id, -1))} aria-label={`Move block ${i + 1} up`}>↑</Button>
                    <Button size="sm" variant="ghost" icon onClick={() => setSite(moveBlock(site, b.id, 1))} aria-label={`Move block ${i + 1} down`}>↓</Button>
                    <Button size="sm" variant="danger" icon onClick={() => setSite(removeBlock(site, b.id))} aria-label={`Remove block ${i + 1}`}>✕</Button>
                  </div>
                ))}
              </div>
            </div>
          </Panel>

          {selected ? (
            <Panel title={`Edit — ${BLOCK_LABELS[selected.kind]}`}>
              <div className="stack">
                <BlockFields block={selected} setField={setField} />
                {blockHasText(selected.kind) ? (
                  <>
                    <div className="label">TEXT STYLE</div>
                    <Field label="Font size %">
                      <div className="row">
                        <input
                          type="range"
                          min="50"
                          max="400"
                          step="5"
                          value={Math.round((selected.fontScale ?? 1) * 100)}
                          onChange={(e) => setField({ fontScale: clampFontScale(Number(e.target.value) / 100) })}
                          aria-label="Font size percent"
                          style={{ flex: 1 }}
                        />
                        <Input
                          type="number"
                          min="50"
                          max="400"
                          step="5"
                          value={Math.round((selected.fontScale ?? 1) * 100)}
                          onChange={(e) => setField({ fontScale: clampFontScale((Number(e.target.value) || 100) / 100) })}
                          aria-label="Font size percent value"
                          style={{ width: 80 }}
                        />
                      </div>
                    </Field>
                    <div className="grid cols-auto">
                      <Field label="Align">
                        <Select
                          aria-label="Text align"
                          value={selected.align ?? ''}
                          onChange={(e) => setField({ align: e.target.value || undefined })}
                        >
                          <option value="">(default)</option>
                          {SITE_ALIGNS.map((a) => (
                            <option key={a} value={a}>
                              {a}
                            </option>
                          ))}
                        </Select>
                      </Field>
                      <Field label="Text color">
                        <Input
                          value={selected.color ?? ''}
                          onChange={(e) => setField({ color: e.target.value || undefined })}
                          placeholder="(theme color)"
                          aria-label="Text color"
                        />
                      </Field>
                    </div>
                  </>
                ) : null}
                {mode === 'canvas' && lay ? (
                  <>
                    <div className="label">POSITION (desktop)</div>
                    <div className="grid cols-auto">
                      <Field label="X"><Input type="number" value={lay.x} onChange={(e) => setSite(setBlockLayout(site, selected.id, { x: Number(e.target.value) || 0 }))} aria-label="Layout x" /></Field>
                      <Field label="Y"><Input type="number" value={lay.y} onChange={(e) => setSite(setBlockLayout(site, selected.id, { y: Number(e.target.value) || 0 }))} aria-label="Layout y" /></Field>
                      <Field label="W"><Input type="number" value={lay.w} onChange={(e) => setSite(setBlockLayout(site, selected.id, { w: Number(e.target.value) || 1 }))} aria-label="Layout w" /></Field>
                      <Field label="H"><Input type="number" value={lay.h} onChange={(e) => setSite(setBlockLayout(site, selected.id, { h: Number(e.target.value) || 1 }))} aria-label="Layout h" /></Field>
                      <Field label="Z"><Input type="number" value={lay.z} onChange={(e) => setSite(setBlockLayout(site, selected.id, { z: Number(e.target.value) || 1 }))} aria-label="Layout z" /></Field>
                    </div>
                    <div className="label">MOBILE OVERRIDE {lay.mobile ? '' : '(none — drag in mobile viewport or set below)'}</div>
                    <div className="grid cols-auto">
                      <Field label="X"><Input type="number" value={lay.mobile?.x ?? ''} onChange={(e) => setSite(setBlockMobile(site, selected.id, { x: Number(e.target.value) || 0 }))} aria-label="Mobile x" /></Field>
                      <Field label="Y"><Input type="number" value={lay.mobile?.y ?? ''} onChange={(e) => setSite(setBlockMobile(site, selected.id, { y: Number(e.target.value) || 0 }))} aria-label="Mobile y" /></Field>
                      <Field label="W"><Input type="number" value={lay.mobile?.w ?? ''} onChange={(e) => setSite(setBlockMobile(site, selected.id, { w: Number(e.target.value) || 1 }))} aria-label="Mobile w" /></Field>
                      <Field label="H"><Input type="number" value={lay.mobile?.h ?? ''} onChange={(e) => setSite(setBlockMobile(site, selected.id, { h: Number(e.target.value) || 1 }))} aria-label="Mobile h" /></Field>
                    </div>
                  </>
                ) : null}
              </div>
            </Panel>
          ) : null}

          <Panel title={mode === 'canvas' ? `Canvas — ${viewport}` : 'Preview'}>
            {mode === 'canvas' ? (
              <SiteCanvas site={site} images={images} experience={experience} viewport={viewport} selectedId={selected?.id ?? null} onSelect={setSelectedId} onMove={onMove} onResize={onResize} />
            ) : (
              <SiteRenderer site={site} images={images} experience={experience} />
            )}
          </Panel>

          <Panel title="Host (deploy)">
            <div className="stack">
              <span className="label muted">
                Deploy the generated static site to your own Vercel account. Your token stays on this machine.
              </span>
              <Field label="Vercel token">
                <Input type="password" value={vercelToken} onChange={(e) => onVercelToken(e.target.value)} placeholder="Vercel → Account → Settings → Tokens" />
              </Field>
              <div className="row">
                <Button variant="primary" onClick={deploy} disabled={deploying || !isBridged()}>
                  {deploying ? 'Deploying…' : 'Deploy to Vercel'}
                </Button>
                <span className="label muted">Generates the site, then runs <code>npx vercel deploy --prod</code> (needs Node + a token).</span>
              </div>
            </div>
          </Panel>
        </>
      )}
    </div>
  );
}

function BlockFields({ block, setField }: { block: Block; setField: (patch: Record<string, unknown>) => void }) {
  switch (block.kind) {
    case 'hero':
      return (
        <div className="grid cols-auto">
          <Field label="Title"><Input value={block.title} onChange={(e) => setField({ title: e.target.value })} aria-label="Hero title" /></Field>
          <Field label="Subtitle"><Input value={block.subtitle} onChange={(e) => setField({ subtitle: e.target.value })} aria-label="Hero subtitle" /></Field>
        </div>
      );
    case 'richText':
      return (
        <div className="stack">
          <Field label="Heading"><Input value={block.heading} onChange={(e) => setField({ heading: e.target.value })} aria-label="Text heading" /></Field>
          <Field label="Body"><textarea className="textarea" rows={4} value={block.text} onChange={(e) => setField({ text: e.target.value })} aria-label="Text body" /></Field>
        </div>
      );
    case 'gallery':
      return (
        <div className="grid cols-auto">
          <Field label="Heading"><Input value={block.heading} onChange={(e) => setField({ heading: e.target.value })} aria-label="Gallery heading" /></Field>
          <Field label="Columns"><Input type="number" min="1" max="6" value={block.columns} onChange={(e) => setField({ columns: Number(e.target.value) || 1 })} aria-label="Gallery columns" /></Field>
          <Field label="Count"><Input type="number" min="1" max="24" value={block.count} onChange={(e) => setField({ count: Number(e.target.value) || 1 })} aria-label="Gallery count" /></Field>
        </div>
      );
    case 'mint':
      return (
        <div className="grid cols-auto">
          <Field label="Heading"><Input value={block.heading} onChange={(e) => setField({ heading: e.target.value })} aria-label="Mint heading" /></Field>
          <Field label="Price label"><Input value={block.price} onChange={(e) => setField({ price: e.target.value })} placeholder="0.05 ETH" aria-label="Mint price" /></Field>
          <span className="label muted">Uses the experience from the Mint FX stage.</span>
        </div>
      );
    case 'faq':
      return (
        <div className="stack">
          <Field label="Heading"><Input value={block.heading} onChange={(e) => setField({ heading: e.target.value })} aria-label="FAQ heading" /></Field>
          {block.items.map((it, i) => (
            <div key={i} className="grid cols-auto">
              <Field label={`Q${i + 1}`}><Input value={it.q} onChange={(e) => setField({ items: block.items.map((x, j) => (j === i ? { ...x, q: e.target.value } : x)) })} aria-label={`FAQ question ${i + 1}`} /></Field>
              <Field label={`A${i + 1}`}><Input value={it.a} onChange={(e) => setField({ items: block.items.map((x, j) => (j === i ? { ...x, a: e.target.value } : x)) })} aria-label={`FAQ answer ${i + 1}`} /></Field>
              <div style={{ alignSelf: 'end' }}>
                <Button size="sm" variant="danger" icon onClick={() => setField({ items: block.items.filter((_, j) => j !== i) })} aria-label={`Remove FAQ ${i + 1}`}>✕</Button>
              </div>
            </div>
          ))}
          <div><Button size="sm" onClick={() => setField({ items: [...block.items, { q: 'Question?', a: 'Answer.' }] })}>+ Add Q&amp;A</Button></div>
        </div>
      );
    case 'marquee':
      return <Field label="Marquee text"><Input value={block.text} onChange={(e) => setField({ text: e.target.value })} aria-label="Marquee text" /></Field>;
    case 'blink':
      return (
        <div className="grid cols-auto">
          <Field label="Text"><Input value={block.text} onChange={(e) => setField({ text: e.target.value })} aria-label="Blink text" /></Field>
          <Field label="Color"><Input value={block.color} onChange={(e) => setField({ color: e.target.value })} aria-label="Blink color" /></Field>
        </div>
      );
    case 'image':
      return (
        <div className="grid cols-auto">
          <Field label="Image URL"><Input value={block.src} onChange={(e) => setField({ src: e.target.value })} placeholder="data: or https URL / GIF" aria-label="Image src" /></Field>
          <Field label="Alt"><Input value={block.alt} onChange={(e) => setField({ alt: e.target.value })} aria-label="Image alt" /></Field>
        </div>
      );
    case 'hitCounter':
      return (
        <div className="grid cols-auto">
          <Field label="Label"><Input value={block.label} onChange={(e) => setField({ label: e.target.value })} aria-label="Counter label" /></Field>
          <Field label="Start"><Input type="number" min="0" value={block.start} onChange={(e) => setField({ start: Number(e.target.value) || 0 })} aria-label="Counter start" /></Field>
        </div>
      );
    case 'html':
      return <Field label="Raw HTML"><textarea className="textarea" rows={6} spellCheck={false} value={block.html} onChange={(e) => setField({ html: e.target.value })} aria-label="Raw HTML" /></Field>;
    case 'wordArt':
      return (
        <div className="grid cols-auto">
          <Field label="Text"><Input value={block.text} onChange={(e) => setField({ text: e.target.value })} aria-label="WordArt text" /></Field>
          <Field label="Style">
            <Select aria-label="WordArt style" value={block.style} onChange={(e) => setField({ style: e.target.value })}>
              <option value="rainbow">rainbow</option>
              <option value="chrome">chrome</option>
              <option value="fire">fire</option>
            </Select>
          </Field>
        </div>
      );
    case 'button':
      return (
        <div className="grid cols-auto">
          <Field label="Label"><Input value={block.text} onChange={(e) => setField({ text: e.target.value })} aria-label="Button label" /></Field>
          <Field label="Link"><Input value={block.href} onChange={(e) => setField({ href: e.target.value })} placeholder="https://" aria-label="Button href" /></Field>
        </div>
      );
    case 'webRing':
      return <Field label="Ring name"><Input value={block.name} onChange={(e) => setField({ name: e.target.value })} aria-label="Web ring name" /></Field>;
    case 'underConstruction':
      return <Field label="Banner text"><Input value={block.text} onChange={(e) => setField({ text: e.target.value })} aria-label="Construction text" /></Field>;
    case 'divider':
      return <span className="label muted">A horizontal rule. No options.</span>;
  }
}
