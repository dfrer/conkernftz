export {};
// Live Preview: IPC-driven only (core compositor); local canvas fallback removed

function $(id: string): HTMLElement | null { return document.getElementById(id); }

function cloneResetEl(el: HTMLElement | null): HTMLElement | null {
  if (!el || !el.parentElement) return el;
  const clone = el.cloneNode(true) as HTMLElement;
  el.parentElement.replaceChild(clone, el);
  return clone;
}

async function readEffectiveConfig(): Promise<any | null> {
  try {
    const cfg = await (window as any).foundry.readConfig();
    if (!cfg || !cfg.ok || !cfg.json) return null;
    return cfg.json;
  } catch { return null; }
}

async function composeLocalFallback(cfg: any): Promise<string | null> {
  try {
    const baseRes = await (window as any).foundry.getProjectDir();
    const baseDir = (baseRes && baseRes.projectDir) ? String(baseRes.projectDir).replace(/\\/g,'/') : '';
    const width = Number(cfg?.image?.width || 1024);
    const height = Number(cfg?.image?.height || 1024);
    const bg = String(cfg?.image?.background || 'transparent');
    const layers = Array.isArray(cfg?.layers) ? cfg.layers : [];
    if (!layers.length) return null;
    const picks: Array<{ url: string; opacity: number; x: number; y: number }> = [];
    for (const layer of layers) {
      if (!layer || !layer.path) continue;
      const listing = await (window as any).foundry.listDir(layer.path);
      if (!listing || !listing.ok || !Array.isArray(listing.items)) continue;
      const files = (listing.items as string[]).filter((n: string) => !n.endsWith('/') && /\.(png|webp|gif)$/i.test(n));
      if (!files.length) continue;
      const name = files[0]!;
      const url = encodeURI('file:///' + baseDir + '/' + String(layer.path).replace(/\\/g,'/').replace(/^\/+/, '') + '/' + name).replace(/#/g, '%23');
      const opacity = typeof layer.opacity === 'number' ? layer.opacity : (typeof layer.effects?.opacity === 'number' ? layer.effects.opacity : 1);
      const x = Number(layer.effects?.offsetX || 0);
      const y = Number(layer.effects?.offsetY || 0);
      picks.push({ url, opacity: Math.max(0, Math.min(1, Number(opacity) || 1)), x, y });
    }
    if (!picks.length) return null;
    const imgs = await Promise.all(
      picks.map((p) => new Promise<HTMLImageElement>((resolve, reject) => { const img = new Image(); img.onload = () => resolve(img); img.onerror = () => reject(new Error('img load failed')); img.src = p.url; }))
    ).catch(() => null as any);
    if (!imgs || !Array.isArray(imgs)) return null;
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext('2d'); if (!ctx) return null;
    if (bg && bg !== 'transparent') { ctx.fillStyle = bg; ctx.fillRect(0,0,width,height); }
    for (let i = 0; i < picks.length; i++) { const p = picks[i]!; const img = imgs[i]!; ctx.globalAlpha = typeof p.opacity === 'number' ? p.opacity : 1; try { ctx.drawImage(img, (p.x||0), (p.y||0), width, height); } catch {} }
    ctx.globalAlpha = 1;
    const b64 = canvas.toDataURL('image/png');
    return b64 || null;
  } catch { return null; }
}
async function runLive(count: number, seed?: string): Promise<string[]> {
  const cfg = await readEffectiveConfig();
  if (!cfg) return [];
  const howMany = Math.max(1, Math.min(12, Number(count) || 4));
  const res = await (window as any).foundry.previewLive(cfg, howMany, seed || undefined).catch(() => null);
  if (res && res.ok && Array.isArray(res.images)) {
    // Prefer format returned by IPC; fallback to config to decide MIME
    const fmtKey = String(res.format || '').toLowerCase() === 'webp' || (cfg?.export?.imageFormat === 'webp') ? 'image/webp' : 'image/png';
    return res.images.map((b64: string) => `data:${fmtKey};base64,` + String(b64));
  }
  // Fallbacks: accurate single-image compositor, then local canvas compose
  try {
    const one = await (window as any).foundry.previewEffects(cfg);
    if (one && one.ok && one.b64) {
      const mime = (String(one?.format||'').toLowerCase() === 'webp') ? 'image/webp' : 'image/png';
      return [`data:${mime};base64,` + String(one.b64)];
    }
  } catch {}
  const url = await composeLocalFallback(cfg);
  if (url) return [url];
  return [];
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

  // Make the live preview window draggable
  const livePreview = $('live-preview');
  if (livePreview) {
    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let startLeft = 0;
    let startTop = 0;

    const header = livePreview.querySelector('.lp-header') as HTMLElement;
    if (header) {
      header.style.cursor = 'move';
      header.addEventListener('mousedown', (e) => {
        const target = e.target as HTMLElement | null;
        if (target && (target.closest('.lp-controls') || /^(SELECT|BUTTON|INPUT|LABEL)$/i.test(target.tagName))) {
          return; // allow interacting with controls
        }
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        const rect = livePreview.getBoundingClientRect();
        startLeft = rect.left;
        startTop = rect.top;
        livePreview.style.position = 'fixed';
        livePreview.style.left = startLeft + 'px';
        livePreview.style.top = startTop + 'px';
        livePreview.style.right = 'auto';
        e.preventDefault();
      });
    }

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const deltaX = e.clientX - startX;
      const deltaY = e.clientY - startY;
      livePreview.style.left = (startLeft + deltaX) + 'px';
      livePreview.style.top = (startTop + deltaY) + 'px';
    });

    document.addEventListener('mouseup', () => {
      isDragging = false;
    });
  }

  // Kick immediately if overlay visible on load
  if (!$('live-preview')?.classList.contains('hidden')) { curSeed = newSeed(); renderNow(); }
  // Re-generate only when configuration is saved
  window.addEventListener('foundry:config-saved', () => { curSeed = newSeed(); renderNow(); });
}

// Defer until DOM is ready
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initLivePreview);
else initLivePreview();
