import { useEffect, useRef, useState } from 'react';
import { Panel } from '../components/Panel';
import { StageHeader } from '../components/StageHeader';
import { Button } from '../components/Button';
import { Field, Input, Select } from '../components/Field';
import { EmptyState } from '../components/EmptyState';
import { useToast } from '../components/Toast';
import { SiteRenderer } from '../components/site/SiteRenderer';
import { SiteCanvas } from '../components/site/SiteCanvas';
import { BlockFields } from '../components/site/BlockFields';
import { bridge, isBridged } from '../lib/bridge';
import { useProject } from '../state/project';
import { resolveExperience, type ExperienceConfig } from '../lib/mintExperience';
import { resolveExperienceArt } from '../lib/packLibrary';
import { buildSiteData, siteDataScript, SITE_DATA_FILENAME } from '../lib/siteBundle';
import { useSiteHistory } from '../lib/useSiteHistory';
import {
  BLOCK_KINDS,
  BLOCK_LABELS,
  addBlock,
  blockHasText,
  clampFontScale,
  clampScale,
  SITE_ALIGNS,
  defaultLayout,
  defaultSite,
  moveBlock,
  removeBlock,
  removeBlocks,
  resolveSite,
  setBlockLayout,
  setBlockMobile,
  setCanvas,
  setCursor,
  setLayoutMode,
  setMint,
  setPageBg,
  setTheme,
  SITE_CURSORS,
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
  // Site config + undo/redo (extracted hook). setSite = discrete edit (snapshots); setSiteLive =
  // transient drag frame (no history); beginHistory() snapshots once at drag start.
  const { site, setSite, setSiteLive, beginHistory, undo, redo, canUndo, canRedo } = useSiteHistory(() => {
    const existing = config?.site as Partial<SiteConfig> | undefined;
    const r = existing ? resolveSite(existing) : defaultSite();
    return r.blocks.length ? r : defaultSite();
  });
  const [snap, setSnap] = useState(true);
  const SNAP_GRID = 20; // matches the editor's 20px background grid
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  // The "primary" selection drives the inspector; the full set drives canvas group ops.
  const selectedId = selectedIds[selectedIds.length - 1] ?? null;
  const selectOne = (id: string): void => setSelectedIds([id]);
  // Plain click = select one; Shift/Ctrl = toggle into the multi-selection.
  const selectToggle = (id: string, additive: boolean): void =>
    setSelectedIds((prev) => (additive ? (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]) : [id]));
  const [images, setImages] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [previewingLocal, setPreviewingLocal] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const lsGet = (k: string): string => {
    try {
      return localStorage.getItem(k) ?? '';
    } catch {
      return '';
    }
  };
  const lsSet = (k: string, v: string): void => {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* ignore */
    }
  };
  const [host, setHostRaw] = useState<string>(() => lsGet('cnftz:deployHost') || 'vercel');
  const [vercelToken, setVercelToken] = useState<string>(() => lsGet('cnftz:vercelToken'));
  const [netlifyToken, setNetlifyToken] = useState<string>(() => lsGet('cnftz:netlifyToken'));
  const [netlifySite, setNetlifySite] = useState<string>(() => lsGet('cnftz:netlifySite'));
  const [githubToken, setGithubToken] = useState<string>(() => lsGet('cnftz:githubToken'));
  const [githubRepo, setGithubRepo] = useState<string>(() => lsGet('cnftz:githubRepo'));
  const [customDomain, setCustomDomain] = useState<string>(() => lsGet('cnftz:customDomain'));
  const [viewport, setViewport] = useState<Viewport>('desktop');

  const mode = site.layout ?? 'flow';
  const experience: ExperienceConfig = resolveExperience(config?.mintExperience as Partial<ExperienceConfig> | undefined);
  // Resolve the pack/back/rip art for the live preview (same as the export does) so the mint
  // block shows the REAL pack + layered rip + card backs, not the placeholder pack/◇ cards.
  const [previewExp, setPreviewExp] = useState<ExperienceConfig>(experience);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const r = await resolveExperienceArt(experience);
      if (!cancelled) setPreviewExp(r);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [experience.packId, experience.backId, experience.kind, JSON.stringify(experience.rarityBacks)]);
  const selected = site.blocks.find((b) => b.id === selectedId) ?? site.blocks[0] ?? null;
  const selIndex = selected ? site.blocks.findIndex((b) => b.id === selected.id) : -1;
  const setField = (patch: Record<string, unknown>): void => {
    if (selected) setSite(updateBlock(site, selected.id, patch));
  };

  const add = (kind: BlockKind): void => {
    const next = addBlock(site, kind);
    setSite(next);
    selectOne(next.blocks[next.blocks.length - 1]!.id);
  };

  const applyTemplate = (t: SiteTemplate): void => {
    setSite(t.build());
    setSelectedIds([]);
    toast.push(`Applied “${t.label}” template`, 'ok');
  };

  // Native image picker → data URL, applied wherever an image URL is accepted (Image widget,
  // 88×31 badge, tiled wallpaper). Baked into the config so the exported site stays portable.
  const uploadImage = async (apply: (dataUrl: string) => void): Promise<void> => {
    const fb = bridge();
    if (!fb) {
      toast.push('Image upload needs the desktop app', 'danger');
      return;
    }
    try {
      const r = await fb.pickImage();
      if (r.ok && r.dataUrl) apply(r.dataUrl);
      else if (r.error) toast.push(r.error, 'danger');
    } catch (e) {
      toast.push(String((e as Error)?.message ?? e), 'danger');
    }
  };

  const grid = (n: number): number => (snap ? Math.round(n / SNAP_GRID) * SNAP_GRID : n);
  // Drags use the live setter (one history entry per drag, snapshotted at drag start).
  const onResize = (id: string, w: number, h: number): void =>
    setSiteLive(viewport === 'mobile' ? setBlockMobile(site, id, { w: grid(w), h: grid(h) }) : setBlockLayout(site, id, { w: grid(w), h: grid(h) }));
  const onRotate = (id: string, deg: number): void => setSiteLive(setBlockLayout(site, id, { rot: deg }));
  // Group move: apply every block's absolute target in ONE live update (snapped).
  const onMoveMany = (updates: { id: string; x: number; y: number }[]): void =>
    setSiteLive(
      updates.reduce(
        (s, u) => (viewport === 'mobile' ? setBlockMobile(s, u.id, { x: grid(u.x), y: grid(u.y) }) : setBlockLayout(s, u.id, { x: grid(u.x), y: grid(u.y) })),
        site,
      ),
    );
  const deleteSelected = (): void => {
    if (selectedIds.length === 0) return;
    setSite(removeBlocks(site, selectedIds));
    setSelectedIds([]);
  };

  // Keyboard: Ctrl/Cmd+Z undo, +Shift (or Ctrl+Y) redo, arrow-keys nudge the selected canvas
  // block (Shift = 10px). Ignored while typing in a field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const t = e.target as HTMLElement | null;
      const typing = !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
      const meta = e.ctrlKey || e.metaKey;
      if (meta && (e.key === 'z' || e.key === 'Z')) {
        if (typing) return;
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if (meta && (e.key === 'y' || e.key === 'Y')) {
        if (typing) return;
        e.preventDefault();
        redo();
        return;
      }
      if (!typing && e.key === 'Escape' && selectedIds.length) {
        setSelectedIds([]);
        return;
      }
      if (!typing && mode === 'canvas' && selectedIds.length && (e.key === 'Delete' || e.key === 'Backspace')) {
        e.preventDefault();
        deleteSelected();
        return;
      }
      if (!typing && mode === 'canvas' && selectedId && e.key.startsWith('Arrow')) {
        const step = e.shiftKey ? 10 : 1;
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
        const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
        if (dx === 0 && dy === 0) return;
        e.preventDefault();
        const b = site.blocks.find((x) => x.id === selectedId);
        const base = b?.layout ?? defaultLayout(0);
        if (viewport === 'mobile') {
          const m = base.mobile ?? { x: base.x, y: base.y, w: base.w, h: base.h };
          setSite(setBlockMobile(site, selectedId, { x: Math.max(0, m.x + dx), y: Math.max(0, m.y + dy) }));
        } else {
          setSite(setBlockLayout(site, selectedId, { x: Math.max(0, base.x + dx), y: Math.max(0, base.y + dy) }));
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, selectedId, selectedIds, viewport, site]);

  const loadArt = async (silent = false): Promise<void> => {
    const fb = bridge();
    if (!fb || !config) {
      if (!silent) toast.push('Open a project to load live art', 'danger');
      return;
    }
    setBusy(true);
    try {
      const r = await fb.previewLive(config, 8, `site:${Date.now().toString(36)}`);
      if (r.ok && Array.isArray(r.images)) {
        const mime = r.format === 'webp' ? 'image/webp' : 'image/png';
        setImages(r.images.map((b) => `data:${mime};base64,${b}`));
        if (!silent) toast.push(`Loaded ${r.images.length} preview images`, 'ok');
      } else if (!silent) {
        toast.push(r.error ?? 'Preview failed', 'danger');
      }
    } catch (e) {
      if (!silent) toast.push(String((e as Error)?.message ?? e), 'danger');
    } finally {
      setBusy(false);
    }
  };

  // Auto-load rendered art on first mount so the gallery + mint reveal show REAL card art
  // (not number/placeholder tiles). Silent + once; "Use live art" re-pulls on demand.
  const autoLoaded = useRef(false);
  useEffect(() => {
    if (autoLoaded.current || !project || !isBridged() || images.length) return;
    autoLoaded.current = true;
    void loadArt(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project]);

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
    lsSet('cnftz:vercelToken', v);
  };
  const onHost = (v: string): void => {
    setHostRaw(v);
    lsSet('cnftz:deployHost', v);
  };
  const onNetlifyToken = (v: string): void => {
    setNetlifyToken(v);
    lsSet('cnftz:netlifyToken', v);
  };
  const onNetlifySite = (v: string): void => {
    setNetlifySite(v);
    lsSet('cnftz:netlifySite', v);
  };
  const onGithubToken = (v: string): void => {
    setGithubToken(v);
    lsSet('cnftz:githubToken', v);
  };
  const onGithubRepo = (v: string): void => {
    setGithubRepo(v);
    lsSet('cnftz:githubRepo', v);
  };
  const onCustomDomain = (v: string): void => {
    setCustomDomain(v);
    lsSet('cnftz:customDomain', v);
  };
  const HOST_LABELS: Record<string, string> = {
    vercel: 'Vercel',
    netlify: 'Netlify',
    ipfs: 'IPFS (Pinata)',
    arweave: 'Arweave (Irys)',
    github: 'GitHub Pages',
  };

  const deploy = async (): Promise<void> => {
    const fb = bridge();
    if (!fb || !config) {
      toast.push('Open a project first', 'danger');
      return;
    }
    if (host === 'vercel' && !vercelToken.trim()) {
      toast.push('Add your Vercel token first', 'danger');
      return;
    }
    if (host === 'netlify' && (!netlifyToken.trim() || !netlifySite.trim())) {
      toast.push('Add your Netlify token and site ID first', 'danger');
      return;
    }
    if (host === 'github' && (!githubToken.trim() || !githubRepo.trim())) {
      toast.push('Add your GitHub token and owner/repo first', 'danger');
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
      const label = HOST_LABELS[host] ?? host;
      toast.push(`Deploying to ${label}… (first run can take a minute)`, 'ok');
      const payload =
        host === 'vercel'
          ? { provider: 'vercel', token: vercelToken.trim() }
          : host === 'netlify'
            ? { provider: 'netlify', token: netlifyToken.trim(), siteId: netlifySite.trim() }
            : host === 'github'
              ? { provider: 'github', token: githubToken.trim(), repo: githubRepo.trim(), branch: 'gh-pages', domain: customDomain.trim() }
              : { provider: host }; // ipfs / arweave use the project's storage credentials
      const dep = await fb.deploySite(payload);
      if (dep.ok && dep.url) {
        // GitHub Pages builds asynchronously — the URL can 404 for ~a minute after the push.
        toast.push(host === 'github' ? `Pushed — GitHub Pages may take a minute to go live: ${dep.url}` : `Live at ${dep.url}`, 'ok');
        fb.openExternal(dep.url);
      } else if (dep.ok) {
        toast.push(`Deployed to ${label}`, 'ok');
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
            <Button size="sm" onClick={() => loadArt()} disabled={busy || !isBridged()}>
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
              <Field label="Cursor trail">
                <Select aria-label="Cursor trail" value={site.cursor ?? 'none'} onChange={(e) => setSite(setCursor(site, e.target.value as (typeof SITE_CURSORS)[number]))}>
                  {SITE_CURSORS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
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
                  <Field label="Tile image">
                    <div className="row">
                      <Input value={pageBg.tile} onChange={(e) => setSite(setPageBg(site, { tile: e.target.value }))} placeholder="data: or https URL" aria-label="Background tile" style={{ flex: 1 }} />
                      <Button size="sm" onClick={() => uploadImage((u) => setSite(setPageBg(site, { tile: u })))} disabled={!isBridged()}>
                        Upload…
                      </Button>
                    </div>
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

          <Panel title="Mint contract">
            <p className="muted" style={{ margin: '0 0 8px', fontSize: 12 }}>
              Wire the mint widget to a deployed launch contract (from <code>conkernftz launch deploy</code>).
              Leave the contract blank to keep the widget preview-only. Use a testnet until audited.
            </p>
            <div className="grid cols-auto">
              <Field label="Chain">
                <Select
                  aria-label="Mint chain"
                  value={String(site.mint?.chainId ?? '')}
                  onChange={(e) => setSite(setMint(site, { chainId: Number(e.target.value) || 0 }))}
                >
                  <option value="">— none —</option>
                  <option value="84532">Base Sepolia (testnet)</option>
                  <option value="11155111">Sepolia (testnet)</option>
                  <option value="8453">Base (mainnet)</option>
                  <option value="1">Ethereum (mainnet)</option>
                </Select>
              </Field>
              <Field label="RPC URL">
                <Input
                  value={site.mint?.rpcUrl ?? ''}
                  onChange={(e) => setSite(setMint(site, { rpcUrl: e.target.value }))}
                  placeholder="https://sepolia.base.org"
                  aria-label="Mint RPC URL"
                />
              </Field>
              <Field label="Contract">
                <Input
                  value={site.mint?.contractAddress ?? ''}
                  onChange={(e) => setSite(setMint(site, { contractAddress: e.target.value.trim() }))}
                  placeholder="0x… (from launch deploy)"
                  aria-label="Mint contract address"
                />
              </Field>
            </div>
          </Panel>

          <Panel
            title="Blocks"
            actions={
              <div className="row">
                {selectedIds.length > 1 ? (
                  <Button size="sm" variant="danger" onClick={deleteSelected}>
                    Delete {selectedIds.length} selected
                  </Button>
                ) : null}
                <span className="label">{site.blocks.length} BLOCKS</span>
              </div>
            }
          >
            <div className="stack">
              <span className="label muted">Shift-click to multi-select; drag any selected block to move the group. Del removes them.</span>
              <div className="row" style={{ flexWrap: 'wrap' }}>
                {BLOCK_KINDS.map((k) => (
                  <Button key={k} size="sm" variant="ghost" onClick={() => add(k)}>
                    + {BLOCK_LABELS[k]}
                  </Button>
                ))}
              </div>
              <div className="stack">
                {site.blocks.map((b, i) => (
                  <div key={b.id} className={`row block-row${selectedIds.includes(b.id) ? ' block-row--sel' : ''}`}>
                    <button type="button" className="block-row-label" onClick={(e) => selectToggle(b.id, e.shiftKey || e.ctrlKey || e.metaKey)} aria-label={`Select block ${i + 1} (${BLOCK_LABELS[b.kind]})`}>
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
                <BlockFields block={selected} setField={setField} onUpload={uploadImage} />
                {selected.kind !== 'divider' ? (
                  <>
                    <div className="label">SIZE</div>
                    <Field label="Widget scale %">
                      <div className="row">
                        <input
                          type="range"
                          min="25"
                          max="400"
                          step="5"
                          value={Math.round((selected.scale ?? 1) * 100)}
                          onChange={(e) => setField({ scale: clampScale(Number(e.target.value) / 100) })}
                          aria-label="Widget scale percent"
                          style={{ flex: 1 }}
                        />
                        <Input
                          type="number"
                          min="25"
                          max="400"
                          step="5"
                          value={Math.round((selected.scale ?? 1) * 100)}
                          onChange={(e) => setField({ scale: clampScale((Number(e.target.value) || 100) / 100) })}
                          aria-label="Widget scale percent value"
                          style={{ width: 80 }}
                        />
                      </div>
                    </Field>
                    <span className="label muted">Scales the whole widget — the card-pack, images, everything. Font size below affects text only.</span>
                  </>
                ) : null}
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
                      <Field label="Rotation°"><Input type="number" value={lay.rot ?? 0} onChange={(e) => setSite(setBlockLayout(site, selected.id, { rot: Number(e.target.value) || 0 }))} aria-label="Layout rotation" /></Field>
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

          <Panel
            title={mode === 'canvas' ? `Canvas — ${viewport}` : 'Preview'}
            actions={
              <div className="row">
                <Button size="sm" variant="ghost" onClick={undo} disabled={!canUndo} aria-label="Undo">
                  ↶ Undo
                </Button>
                <Button size="sm" variant="ghost" onClick={redo} disabled={!canRedo} aria-label="Redo">
                  ↷ Redo
                </Button>
                {mode === 'canvas' ? (
                  <label className="row" style={{ gap: 4 }}>
                    <input type="checkbox" checked={snap} onChange={(e) => setSnap(e.target.checked)} aria-label="Snap to grid" />
                    <span className="label">Snap</span>
                  </label>
                ) : null}
              </div>
            }
          >
            {mode === 'canvas' ? (
              <SiteCanvas site={site} images={images} experience={previewExp} viewport={viewport} selectedIds={selectedIds} onSelect={selectToggle} onMoveMany={onMoveMany} onResize={onResize} onRotate={onRotate} onInteractStart={beginHistory} />
            ) : (
              <SiteRenderer site={site} images={images} experience={previewExp} />
            )}
          </Panel>

          <Panel title="Host (deploy)">
            <div className="stack">
              <span className="label muted">
                Generate + deploy the static mint site to your own host. Credentials stay on this machine; the artist owns the deployment.
              </span>
              <Field label="Host">
                <Select aria-label="Deploy host" value={host} onChange={(e) => onHost(e.target.value)}>
                  <option value="vercel">Vercel</option>
                  <option value="netlify">Netlify</option>
                  <option value="github">GitHub Pages</option>
                  <option value="ipfs">IPFS (Pinata)</option>
                  <option value="arweave">Arweave (Irys)</option>
                </Select>
              </Field>
              {host === 'vercel' ? (
                <Field label="Vercel token">
                  <Input type="password" value={vercelToken} onChange={(e) => onVercelToken(e.target.value)} placeholder="Vercel → Account → Settings → Tokens" />
                </Field>
              ) : null}
              {host === 'netlify' ? (
                <div className="grid cols-auto">
                  <Field label="Netlify token">
                    <Input type="password" value={netlifyToken} onChange={(e) => onNetlifyToken(e.target.value)} placeholder="Netlify → User settings → Personal access tokens" />
                  </Field>
                  <Field label="Netlify site ID">
                    <Input value={netlifySite} onChange={(e) => onNetlifySite(e.target.value)} placeholder="create a site first → Site configuration → Site ID" />
                  </Field>
                </div>
              ) : null}
              {host === 'github' ? (
                <>
                  <div className="grid cols-auto">
                    <Field label="GitHub token">
                      <Input type="password" value={githubToken} onChange={(e) => onGithubToken(e.target.value)} placeholder="Settings → Developer settings → tokens (repo scope)" />
                    </Field>
                    <Field label="Repository (owner/repo)">
                      <Input value={githubRepo} onChange={(e) => onGithubRepo(e.target.value)} placeholder="your-name/your-repo" aria-label="GitHub repository" />
                    </Field>
                    <Field label="Custom domain (optional)">
                      <Input value={customDomain} onChange={(e) => onCustomDomain(e.target.value)} placeholder="mint.example.com — writes a CNAME" aria-label="Custom domain" />
                    </Field>
                  </div>
                  <span className="label muted">
                    Pushes the site to the <code>gh-pages</code> branch via the GitHub API and enables Pages. Site lives at <code>https://&lt;owner&gt;.github.io/&lt;repo&gt;/</code> (or your custom domain). The repo must exist.
                  </span>
                </>
              ) : null}
              {host === 'ipfs' || host === 'arweave' ? (
                <span className="label muted">
                  Uses your project storage credentials ({host === 'ipfs' ? 'Pinata JWT' : 'Irys'}) — the same ones the <strong>Publish</strong> stage uses. No extra token needed here. Point a custom domain at it via DNSLink.
                </span>
              ) : null}
              {host === 'vercel' || host === 'netlify' ? (
                <span className="label muted">Add a custom domain in your {HOST_LABELS[host]} dashboard after the first deploy.</span>
              ) : null}
              <div className="row">
                <Button variant="primary" onClick={deploy} disabled={deploying || !isBridged()}>
                  {deploying ? 'Deploying…' : `Deploy to ${HOST_LABELS[host] ?? host}`}
                </Button>
                <span className="label muted">
                  {host === 'ipfs' || host === 'arweave'
                    ? 'Pins the site to decentralized storage and returns a gateway URL.'
                    : host === 'github'
                      ? 'Generates the site, then pushes it to GitHub Pages via the API.'
                      : `Generates the site, then runs the ${HOST_LABELS[host] ?? host} CLI (needs Node + a token).`}
                </span>
              </div>
            </div>
          </Panel>
        </>
      )}
    </div>
  );
}
