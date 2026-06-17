import {
  reorderLayers,
  parseWeightFromFilename,
  traitValueFromFilename,
  setWeightInFilename,
  predictedDistribution,
  histogramFromCounts,
  filterAnimationFiles,
  isVideoFile,
  buildRenamePairs,
  makeSeed,
  type CatalogValue,
} from './studio/pure.js';

// Studio: a self-mounting set of authoring panels (layer order, trait weights, rarity
// histogram, regenerating gallery, animation preview, asset manager). It attaches to the
// `#studio-embed` element if present and uses the preload `window.foundry` IPC bridge. Kept
// independent of app.ts to avoid growing the renderer monolith.

interface StudioLayer {
  name: string;
  path: string;
  rarity?: 'filename' | 'uniform';
}
interface StudioConfig {
  layers?: StudioLayer[];
  rarity?: { delimiter?: string; defaultWeight?: number };
  export?: { outDir?: string; imageFormat?: string };
  image?: { width?: number; height?: number };
}

const IMG_EXT = /\.(png|jpe?g|webp|gif)$/i;

// The methods this module uses from the preload `window.foundry` bridge. Declared locally so
// the module compiles under both the renderer (Bundler) and typecheck (NodeNext) configs
// without depending on the global Window augmentation.
interface FoundryBridge {
  readConfig(): Promise<{ ok: boolean; json?: unknown; error?: string }>;
  writeConfig(json: unknown): Promise<{ ok: boolean; error?: string }>;
  listDir(rel: string): Promise<{ ok: boolean; items?: string[]; error?: string }>;
  readFile(rel: string): Promise<{ ok: boolean; content?: string; error?: string }>;
  readFileBase64(rel: string): Promise<{ ok: boolean; base64?: string; mime?: string; error?: string }>;
  previewLive(config: unknown, count: number, seed?: string): Promise<{ ok: boolean; format?: string; images?: string[]; error?: string }>;
  renameFiles(pairs: Array<{ from: string; to: string }>): Promise<{ ok: boolean; renamed?: number; error?: string }>;
  deleteFile(rel: string): Promise<{ ok: boolean; error?: string }>;
}

function api(): FoundryBridge | undefined {
  if (typeof window === 'undefined') return undefined;
  return (window as unknown as { foundry?: FoundryBridge }).foundry;
}

function joinPath(dir: string, name: string): string {
  return `${dir.replace(/[\\/]+$/, '')}/${name}`;
}

type Props = Record<string, unknown>;
function h<K extends keyof HTMLElementTagNameMap>(tag: K, props?: Props, children?: Array<Node | string>): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v == null) continue;
      if (k === 'class') el.className = String(v);
      else if (k === 'text') el.textContent = String(v);
      else if (k === 'style') el.setAttribute('style', String(v));
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v as EventListener);
      else el.setAttribute(k, String(v));
    }
  }
  if (children) for (const c of children) el.append(c);
  return el;
}

function card(title: string, subtitle: string, body: HTMLElement): HTMLElement {
  const c = h('section', { class: 'studio-card' });
  c.append(h('h3', { text: title }));
  if (subtitle) c.append(h('p', { class: 'studio-muted', text: subtitle }));
  c.append(body);
  return c;
}

async function readConfig(): Promise<StudioConfig | null> {
  try {
    const r = await api()?.readConfig();
    return r && r.ok ? (r.json as StudioConfig) : null;
  } catch {
    return null;
  }
}
async function writeConfig(cfg: StudioConfig): Promise<boolean> {
  try {
    const r = await api()?.writeConfig(cfg);
    return !!(r && r.ok);
  } catch {
    return false;
  }
}
async function listDir(rel: string): Promise<string[]> {
  try {
    const r = await api()?.listDir(rel);
    return r && r.ok && Array.isArray(r.items) ? r.items : [];
  } catch {
    return [];
  }
}
async function listImageFiles(dir: string): Promise<string[]> {
  return (await listDir(dir)).filter((n) => IMG_EXT.test(n));
}

// ---------------- Panels ----------------

function layersPanel(cfg: StudioConfig, refresh: () => void): HTMLElement {
  const layers = cfg.layers ?? [];
  const list = h('ul', { class: 'studio-layer-list' });

  const move = async (from: number, to: number): Promise<void> => {
    const next = reorderLayers(layers, from, to);
    if (await writeConfig({ ...cfg, layers: next })) refresh();
  };

  layers.forEach((layer, i) => {
    const li = h('li', { class: 'studio-layer-item', draggable: 'true', 'data-index': String(i) }, [
      h('span', { class: 'studio-grip', text: '≡' }),
      h('span', { class: 'studio-layer-name', text: layer.name }),
      h('span', { class: 'studio-muted', text: layer.path }),
      h('button', { class: 'studio-btn', text: '▲', title: 'Move up', onclick: () => move(i, i - 1) }),
      h('button', { class: 'studio-btn', text: '▼', title: 'Move down', onclick: () => move(i, i + 1) }),
    ]);
    li.addEventListener('dragstart', (ev) => (ev as DragEvent).dataTransfer?.setData('text/plain', String(i)));
    li.addEventListener('dragover', (ev) => ev.preventDefault());
    li.addEventListener('drop', (ev) => {
      ev.preventDefault();
      const from = Number((ev as DragEvent).dataTransfer?.getData('text/plain'));
      if (Number.isFinite(from)) void move(from, i);
    });
    list.append(li);
  });
  if (!layers.length) list.append(h('li', { class: 'studio-muted', text: 'No layers configured.' }));
  return card('Layer order', 'Drag rows or use ▲▼. The first layer draws first (bottom); later layers draw on top.', list);
}

function weightsPanel(cfg: StudioConfig): HTMLElement {
  const layers = cfg.layers ?? [];
  const delimiter = cfg.rarity?.delimiter ?? '#';
  const defaultWeight = cfg.rarity?.defaultWeight ?? 1;
  const body = h('div');
  const select = h('select', { class: 'studio-select' });
  layers.forEach((l, i) => select.append(h('option', { value: String(i), text: l.name })));
  const panel = h('div', { class: 'studio-weights' });

  const renderLayer = async (idx: number): Promise<void> => {
    panel.replaceChildren();
    const layer = layers[idx];
    if (!layer) return;
    const files = await listImageFiles(layer.path);
    const values: CatalogValue[] = files.map((fn) => ({
      value: traitValueFromFilename(fn, delimiter),
      weight: layer.rarity === 'uniform' ? defaultWeight : parseWeightFromFilename(fn, delimiter, defaultWeight),
      filename: fn,
    }));
    const shareByValue = new Map(predictedDistribution({ name: layer.name, values }).map((d) => [d.value, d.share]));
    for (const v of values) {
      const num = h('span', { class: 'studio-wnum', text: String(v.weight) });
      const pct = h('span', { class: 'studio-muted', text: `${(100 * (shareByValue.get(v.value) ?? 0)).toFixed(1)}%` });
      const slider = h('input', { type: 'range', min: '1', max: '100', value: String(v.weight), class: 'studio-slider' });
      slider.addEventListener('input', () => (num.textContent = slider.value));
      slider.addEventListener('change', async () => {
        const to = setWeightInFilename(v.filename, Number(slider.value), delimiter);
        if (to !== v.filename) {
          await api()?.renameFiles([{ from: joinPath(layer.path, v.filename), to: joinPath(layer.path, to) }]);
          void renderLayer(idx);
        }
      });
      panel.append(h('div', { class: 'studio-weight-row' }, [h('span', { class: 'studio-wval', text: v.value }), slider, num, pct]));
    }
    if (!values.length) panel.append(h('div', { class: 'studio-muted', text: 'No image files in this layer.' }));
    if (layer.rarity === 'uniform') {
      panel.append(h('div', { class: 'studio-muted', text: 'This layer uses uniform rarity; per-file weights are ignored.' }));
    }
  };

  select.addEventListener('change', () => void renderLayer(Number(select.value)));
  if (layers.length) void renderLayer(0);
  body.append(select, panel);
  return card('Trait weights', 'Drag a slider to set a trait’s rarity weight (renames the file to embed it).', body);
}

function histogramPanel(cfg: StudioConfig): HTMLElement {
  const outDir = cfg.export?.outDir ?? 'build';
  const chart = h('div', { class: 'studio-histo' });
  const load = async (): Promise<void> => {
    chart.replaceChildren();
    let data: { traitCounts?: Record<string, Record<string, number>>; editionCount?: number } | null = null;
    try {
      const r = await api()?.readFile(`${outDir}/rarity.json`);
      if (r && r.ok && r.content) data = JSON.parse(r.content);
    } catch {
      /* ignore */
    }
    if (!data || !data.traitCounts) {
      chart.append(h('div', { class: 'studio-muted', text: 'No rarity.json yet — run a build first.' }));
      return;
    }
    const editionCount = Number(data.editionCount ?? 0);
    for (const [trait, counts] of Object.entries(data.traitCounts)) {
      chart.append(h('h4', { class: 'studio-histo-title', text: `${trait} · ${editionCount} editions` }));
      for (const b of histogramFromCounts(counts, editionCount)) {
        const bar = h('div', { class: 'studio-bar', style: `width:${Math.max(2, b.pct * 100).toFixed(1)}%` });
        chart.append(
          h('div', { class: 'studio-bar-row' }, [
            h('span', { class: 'studio-bar-lbl', text: b.value }),
            bar,
            h('span', { class: 'studio-muted', text: `${b.count} (${(b.pct * 100).toFixed(1)}%)` }),
          ]),
        );
      }
    }
  };
  const body = h('div', {}, [h('button', { class: 'studio-btn', text: 'Refresh', onclick: () => void load() }), chart]);
  void load();
  return card('Rarity histogram', 'Actual trait distribution from the last build (reads build/rarity.json).', body);
}

function galleryPanel(cfg: StudioConfig): HTMLElement {
  const countInput = h('input', { type: 'number', min: '1', max: '24', value: '8', class: 'studio-num' });
  const grid = h('div', { class: 'studio-gallery' });
  const status = h('span', { class: 'studio-muted' });
  const regen = async (): Promise<void> => {
    grid.replaceChildren();
    status.textContent = 'Generating…';
    const count = Math.max(1, Math.min(24, Number(countInput.value) || 8));
    try {
      const r = await api()?.previewLive(cfg, count, makeSeed('studio'));
      if (r && r.ok && Array.isArray(r.images)) {
        const mime = r.format === 'webp' ? 'image/webp' : 'image/png';
        for (const b64 of r.images) grid.append(h('img', { class: 'studio-thumb', src: `data:${mime};base64,${b64}` }));
        status.textContent = `${r.images.length} previews`;
      } else {
        status.textContent = (r && r.error) || 'Preview failed';
      }
    } catch (e) {
      status.textContent = String((e as Error)?.message ?? e);
    }
  };
  const body = h('div', {}, [
    h('div', { class: 'studio-row' }, [
      h('label', { text: 'Count' }),
      countInput,
      h('button', { class: 'studio-btn', text: 'Regenerate', onclick: () => void regen() }),
      status,
    ]),
    grid,
  ]);
  return card('Preview gallery', 'Regenerate a fresh random set of previews (new seed each time).', body);
}

function animationPanel(cfg: StudioConfig): HTMLElement {
  const imagesDir = `${cfg.export?.outDir ?? 'build'}/images`;
  const grid = h('div', { class: 'studio-gallery' });
  const status = h('span', { class: 'studio-muted' });
  const load = async (): Promise<void> => {
    grid.replaceChildren();
    status.textContent = 'Loading…';
    const files = filterAnimationFiles(await listDir(imagesDir));
    if (!files.length) {
      status.textContent = 'No animated files in build/images — build with --animate.';
      return;
    }
    let shown = 0;
    for (const fn of files.slice(0, 12)) {
      try {
        const r = await api()?.readFileBase64(`${imagesDir}/${fn}`);
        if (!r || !r.ok || !r.base64) continue;
        const src = `data:${r.mime};base64,${r.base64}`;
        grid.append(
          isVideoFile(fn)
            ? h('video', { class: 'studio-thumb', src, controls: '', loop: '', muted: '' })
            : h('img', { class: 'studio-thumb', src, loading: 'lazy' }),
        );
        shown++;
      } catch {
        /* skip */
      }
    }
    status.textContent = `${shown} animated output(s)`;
  };
  const body = h('div', {}, [
    h('div', { class: 'studio-row' }, [h('button', { class: 'studio-btn', text: 'Load animated outputs', onclick: () => void load() }), status]),
    grid,
  ]);
  return card('Animation preview', 'Preview GIF / MP4 / WebP outputs from the last build.', body);
}

function assetsPanel(cfg: StudioConfig): HTMLElement {
  const layers = cfg.layers ?? [];
  const delimiter = cfg.rarity?.delimiter ?? '#';
  const select = h('select', { class: 'studio-select' });
  layers.forEach((l, i) => select.append(h('option', { value: String(i), text: l.name })));
  const list = h('div', { class: 'studio-assets' });
  const baseInput = h('input', { type: 'text', placeholder: 'Base name (e.g. Trait)', class: 'studio-text' });
  const startInput = h('input', { type: 'number', value: '1', min: '0', class: 'studio-num' });

  const loadList = async (): Promise<void> => {
    list.replaceChildren();
    const layer = layers[Number(select.value)];
    if (!layer) return;
    const files = await listImageFiles(layer.path);
    for (const fn of files) {
      const del = h('button', {
        class: 'studio-btn',
        text: 'Delete',
        onclick: async () => {
          if (window.confirm(`Delete ${fn}?`)) {
            await api()?.deleteFile(joinPath(layer.path, fn));
            void loadList();
          }
        },
      });
      list.append(h('div', { class: 'studio-asset-row' }, [h('span', { class: 'studio-fn', text: fn }), del]));
    }
    if (!files.length) list.append(h('div', { class: 'studio-muted', text: 'No image files in this layer.' }));
  };

  const doRename = async (): Promise<void> => {
    const layer = layers[Number(select.value)];
    const base = baseInput.value.trim();
    if (!layer || !base) return;
    const files = await listImageFiles(layer.path);
    const pairs = buildRenamePairs(files, base, Number(startInput.value) || 1, delimiter).map((p) => ({
      from: joinPath(layer.path, p.from),
      to: joinPath(layer.path, p.to),
    }));
    if (pairs.length) {
      await api()?.renameFiles(pairs);
      void loadList();
    }
  };

  select.addEventListener('change', () => void loadList());
  if (layers.length) void loadList();
  const body = h('div', {}, [
    select,
    h('div', { class: 'studio-row' }, [
      h('label', { text: 'Base' }),
      baseInput,
      h('label', { text: 'Start' }),
      startInput,
      h('button', { class: 'studio-btn', text: 'Renumber files', onclick: () => void doRename() }),
    ]),
    list,
  ]);
  return card('Asset manager', 'Browse, delete, and renumber layer assets.', body);
}

// ---------------- Mount ----------------

async function render(): Promise<void> {
  const root = document.getElementById('studio-embed');
  if (!root) return;
  root.replaceChildren();
  if (!api()) {
    root.append(h('p', { class: 'studio-muted', text: 'UI bridge unavailable.' }));
    return;
  }
  const cfg = await readConfig();
  if (!cfg) {
    root.append(h('p', { class: 'studio-muted', text: 'Select a project to use the Studio.' }));
    return;
  }
  const refresh = (): void => void render();
  root.append(
    layersPanel(cfg, refresh),
    weightsPanel(cfg),
    histogramPanel(cfg),
    galleryPanel(cfg),
    animationPanel(cfg),
    assetsPanel(cfg),
  );
}

function init(): void {
  const root = document.getElementById('studio-embed');
  if (!root) return;
  const header = h('div', { class: 'studio-header' }, [
    h('strong', { text: 'Studio' }),
    h('button', { class: 'studio-btn', text: 'Reload', onclick: () => void render() }),
  ]);
  root.before(header);
  void render();
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
}
