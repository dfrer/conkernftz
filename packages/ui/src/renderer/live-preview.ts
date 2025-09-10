// Lightweight Live Preview rebuilt from scratch
// - Pure renderer-side (Canvas 2D), no native deps
// - Reads current config + layers, samples one asset per layer
// - Draws to canvas in order with basic blend/opacity/offset support

type LayerLike = {
  name?: string;
  path: string;
  blend?: string;
  opacity?: number;
  effects?: { blend?: string; opacity?: number; offsetX?: number; offsetY?: number };
};

function $(id: string): HTMLElement | null { return document.getElementById(id); }

function cloneResetEl(el: HTMLElement | null): HTMLElement | null {
  if (!el || !el.parentElement) return el;
  const clone = el.cloneNode(true) as HTMLElement;
  el.parentElement.replaceChild(clone, el);
  return clone;
}

function joinPath(a: string, b: string): string {
  const norm = (s: string) => String(s || '').replace(/\\/g, '/');
  const x = norm(a).replace(/\/$/, '');
  const y = norm(b).replace(/^\//, '');
  return x ? `${x}/${y}` : y;
}

function fileUrlAbs(absPath: string): string {
  const norm = String(absPath || '').replace(/\\/g, '/');
  return encodeURI('file:///' + norm).replace(/#/g, '%23');
}

async function readEffectiveConfig(): Promise<any | null> {
  try {
    const cfg = await (window as any).foundry.readConfig();
    if (!cfg || !cfg.ok || !cfg.json) return null;
    return cfg.json;
  } catch { return null; }
}

async function listImagesIn(dirRelOrAbs: string): Promise<string[]> {
  try {
    const res = await (window as any).foundry.listDir(dirRelOrAbs);
    if (!res || !res.ok || !Array.isArray(res.items)) return [];
    return res.items.filter((n: string) => !n.endsWith('/') && /\.(png|webp|gif)$/i.test(n));
  } catch { return []; }
}

function pick<T>(arr: T[]): T | null {
  if (!arr.length) return null;
  const idx = Math.floor(Math.random() * arr.length);
  const v = (arr as Array<T | undefined>)[idx];
  return (v === undefined ? null : v);
}

function mapBlend(mode?: string): GlobalCompositeOperation {
  const m = String(mode || '').toLowerCase();
  switch (m) {
    case 'normal':
    case 'over':
    default:
      return 'source-over';
    case 'multiply': return 'multiply';
    case 'screen': return 'screen';
    case 'overlay': return 'overlay';
    case 'darken': return 'darken';
    case 'lighten': return 'lighten';
    case 'color-dodge': return 'lighter';
    case 'colour-dodge': return 'lighter';
    case 'color-burn': return 'source-over';
    case 'colour-burn': return 'source-over';
    case 'hard-light': return 'hard-light';
    case 'soft-light': return 'soft-light';
    case 'difference': return 'difference';
    case 'exclusion': return 'exclusion';
  }
}

async function drawOne(config: any, seed?: string): Promise<string | null> {
  // Try accurate compositor via IPC first; includes effects like glow/stroke/shadow
  try {
    const res = await (window as any).foundry.previewLive(config, 1, seed || undefined);
    if (res && res.ok && Array.isArray(res.images) && res.images[0]) {
      return 'data:image/png;base64,' + String(res.images[0]);
    }
  } catch {}
  const proj = await (window as any).foundry.getProjectDir();
  const base = (proj && proj.ok && proj.projectDir) ? String(proj.projectDir).replace(/\\/g, '/') : '';
  const width = Number(config?.image?.width || 1024);
  const height = Number(config?.image?.height || 1024);
  const bg = String(config?.image?.background || 'transparent');
  const layers: LayerLike[] = Array.isArray(config?.layers) ? config.layers : [];
  if (!layers.length) return null;

  // Collect chosen assets
  const picks: Array<{ url: string; blend: GlobalCompositeOperation; opacity: number; x: number; y: number }> = [];
  for (const layer of layers) {
    if (!layer || !layer.path) continue;
    const files = await listImagesIn(layer.path);
    const choice = pick(files);
    if (!choice) continue;
    const abs = fileUrlAbs(joinPath(joinPath(base, ''), joinPath(layer.path, choice)));
    const blend = mapBlend(layer.blend ?? layer.effects?.blend);
    const op = (typeof layer.opacity === 'number' ? layer.opacity : (typeof layer.effects?.opacity === 'number' ? layer.effects!.opacity : 1));
    const x = Number(layer.effects?.offsetX || 0);
    const y = Number(layer.effects?.offsetY || 0);
    picks.push({ url: abs, blend, opacity: Math.max(0, Math.min(1, Number(op) || 1)), x, y });
  }
  if (!picks.length) return null;

  // Load images
  const imgs = await Promise.all(
    picks.map((p) => new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('img load failed'));
      img.src = p.url;
    }))
  ).catch(() => null as any);
  if (!imgs || !Array.isArray(imgs)) return null;

  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  if (bg && bg !== 'transparent') { ctx.fillStyle = bg; ctx.fillRect(0, 0, width, height); }

  for (let i = 0; i < picks.length; i++) {
    const p = picks[i]!;
    ctx.globalCompositeOperation = p.blend || 'source-over';
    ctx.globalAlpha = typeof p.opacity === 'number' ? p.opacity : 1;
    const img = imgs[i]!;
    try { ctx.drawImage(img, (p.x || 0), (p.y || 0), width, height); } catch {}
  }
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  const b64 = canvas.toDataURL('image/png').split(',')[1] || '';
  return 'data:image/png;base64,' + b64;
}

async function runLive(count: number, seed?: string): Promise<string[]> {
  const cfg = await readEffectiveConfig();
  if (!cfg) return [];
  // Prefer accurate core compositor via IPC (includes effects)
  try {
    const howMany = Math.max(1, Math.min(12, Number(count) || 4));
    const res = await (window as any).foundry.previewLive(cfg, howMany, seed || undefined);
    if (res && res.ok && Array.isArray(res.images)) {
      return res.images.map((b64: string) => 'data:image/png;base64,' + String(b64));
    }
  } catch {}
  // Fallback to simple client-side composition without effects
  const out: string[] = [];
  for (let i = 0; i < Math.max(1, Math.min(12, count || 4)); i++) {
    const url = await drawOne(cfg, seed);
    if (url) out.push(url);
  }
  return out;
}

function mountGrid(urls: string[], fit: 'contain'|'cover'|'actual', bg: 'check'|'dark'|'light'): void {
  const grid = $('lp-grid') as HTMLElement | null;
  if (!grid) return;
  grid.innerHTML = '';
  const isSingle = urls.length === 1;
  if (isSingle) {
    // Fill entire overlay area with a single image
    grid.style.display = 'block';
    (grid.parentElement as HTMLElement | null)?.style && ((grid.parentElement as HTMLElement).style.overflow = 'hidden');
    grid.style.width = '100%';
    grid.style.height = '100%';
    const wrap = document.createElement('div');
    wrap.className = 'gallery-item';
    wrap.style.width = '100%';
    wrap.style.height = '100%';
    const img = document.createElement('img');
    img.src = urls[0]!;
    img.style.width = '100%';
    img.style.height = '100%';
    img.style.objectFit = fit === 'actual' ? 'contain' : fit; // keep aspect options
    wrap.appendChild(img);
    grid.appendChild(wrap);
  } else {
    // Grid of thumbnails
    grid.style.display = '';
    grid.style.width = '';
    grid.style.height = '';
    urls.forEach((u) => {
      const wrap = document.createElement('div');
      wrap.className = 'gallery-item';
      const img = document.createElement('img');
      img.src = u;
      img.style.objectFit = fit === 'actual' ? 'contain' : fit;
      wrap.appendChild(img);
      grid.appendChild(wrap);
    });
  }
  if (bg === 'dark') grid.style.background = '#111';
  else if (bg === 'light') grid.style.background = '#eee';
  else grid.style.background = 'repeating-conic-gradient(#ccc 0% 25%, transparent 0% 50%) 50% / 16px 16px';
}

// Full-window overlay managed by CSS; no manual resizing

function showOverlay(): void {
  const ov = $('live-preview');
  if (!ov) return;
  ov.classList.remove('hidden');
  ov.setAttribute('aria-hidden', 'false');
}
function hideOverlay(): void {
  const ov = $('live-preview');
  if (!ov) return;
  ov.classList.add('hidden');
  ov.setAttribute('aria-hidden', 'true');
}

function initLivePreview(): void {
  const toggle = cloneResetEl($("live-prev-toggle")) as HTMLButtonElement | null;
  const refresh = cloneResetEl($("live-prev-refresh")) as HTMLButtonElement | null;
  const countEl = $("live-prev-count") as HTMLInputElement | null;
  const autoEl = $("live-prev-auto") as HTMLInputElement | null;
  const closeBtn = cloneResetEl($("lp-close")) as HTMLButtonElement | null;
  const fitEl = $("lp-fit") as HTMLSelectElement | null;
  const bgEl = $("lp-bg") as HTMLSelectElement | null;

  let timer: any = null;
  let curFit: 'contain' | 'cover' | 'actual' = 'cover';
  let curBg: 'check' | 'dark' | 'light' = 'check';
  let lastUrls: string[] = [];
  let curSeed: string = newSeed();

  function newSeed(): string {
    try {
      // Prefer crypto for uniqueness, fallback to time+random
      const buf = new Uint32Array(2);
      (window.crypto || ({} as any)).getRandomValues?.(buf);
      const a = (buf[0] ?? 0) >>> 0;
      const b = (buf[1] ?? 0) >>> 0;
      if (a !== 0 || b !== 0) return `ui-live:${a.toString(16)}${b.toString(16)}`;
    } catch {}
    return `ui-live:${Date.now().toString(36)}:${Math.floor(Math.random()*1e9).toString(36)}`;
  }

  async function renderNow() {
    const n = 1; // single image only
    const urls = await runLive(n, curSeed);
    lastUrls = urls;
    mountGrid(lastUrls, curFit, curBg);
  }
  function startAuto() { /* disabled: only update on config save */ }
  function stopAuto() { if (timer) { clearInterval(timer); timer = null; } }

  if (toggle) toggle.onclick = () => {
    if ($('live-preview')?.classList.contains('hidden')) {
      curSeed = newSeed();
      showOverlay();
      renderNow();
    } else {
      hideOverlay();
    }
  };
  if (refresh) { (refresh as HTMLButtonElement).disabled = true; refresh.onclick = () => {}; }
  if (closeBtn) closeBtn.onclick = () => { hideOverlay(); stopAuto(); };
  if (autoEl) { autoEl.checked = false; autoEl.disabled = true; autoEl.onchange = () => {}; }
  if (countEl) { countEl.value = '1'; countEl.disabled = true; countEl.onchange = () => {}; }
  if (fitEl) { try { fitEl.value = 'cover'; } catch {}; fitEl.onchange = () => { const v = String(fitEl.value||'contain'); curFit = (v==='actual'||v==='cover')?v:'contain'; if (lastUrls.length) mountGrid(lastUrls, curFit, curBg); }; }
  if (bgEl) bgEl.onchange = () => { const v = String(bgEl.value||'check'); curBg = (v==='dark'||v==='light')?v:'check'; if (lastUrls.length) mountGrid(lastUrls, curFit, curBg); };
  const reroll = cloneResetEl($("lp-reroll")) as HTMLButtonElement | null;
  if (reroll) reroll.onclick = () => { curSeed = newSeed(); renderNow(); };

  // Full-window overlay; no manual resize handle

  // Kick immediately if overlay visible on load
  if (!$('live-preview')?.classList.contains('hidden')) { curSeed = newSeed(); renderNow(); }
  // Re-generate only when configuration is saved
  window.addEventListener('foundry:config-saved', () => { curSeed = newSeed(); renderNow(); });
}

// Defer until DOM is ready
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initLivePreview);
else initLivePreview();
