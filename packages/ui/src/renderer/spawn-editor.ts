export {};
type SpawnDot = {
  id: string;
  x: number; // 0..1
  y: number; // 0..1
  weight?: number;
  jitterRadiusPx?: number;
  tags?: string[];
  maxPlacementsPerComposition?: number;
};

type SpawnMap = {
  version: 1;
  authoringSize: { width: number; height: number };
  dots: SpawnDot[];
  mappings?: {
    layerToDotIds?: Record<string, string[]>;
    assetToDotIds?: Record<string, string[]>;
  };
  rules?: {
    selection?: 'weighted' | 'sequential';
    jitter?: { defaultRadiusPx?: number; distribution?: 'uniform' | 'gaussian' };
    collision?: { enabled?: boolean; paddingPx?: number; strategy?: 'retry' | 'skip' | 'fallback'; maxAttemptsPerAsset?: number };
    fitMode?: 'contain' | 'cover' | 'stretch';
    anchor?: 'center' | 'top-left' | 'custom';
  };
};

type EditorState = {
  visible: boolean;
  map: SpawnMap;
  selectedId: string | null;
  isDragging: boolean;
  dragOffset: { dx: number; dy: number } | null;
  gridSnapPx: number; // grid size in pixels; 0 = off
  showIds: boolean;
  showWeights: boolean;
  undo: SpawnMap[];
  redo: SpawnMap[];
  previewImage: HTMLImageElement | null;
};

function $(sel: string): HTMLElement | null { return document.querySelector(sel); }
function byId<T extends HTMLElement = HTMLElement>(id: string): T | null { return document.getElementById(id) as T | null; }

function uuid(): string { return 'd-' + Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6); }

async function readConfig(): Promise<any | null> { try { const res = await (window as any).foundry.readConfig(); return res && res.ok ? res.json : null; } catch { return null; } }
async function writeConfig(json: any): Promise<boolean> { try { const res = await (window as any).foundry.writeConfig(json); return !!(res && res.ok); } catch { return false; } }
async function readFile(path: string): Promise<string | null> { try { const res = await (window as any).foundry.readFile(path); return res && res.ok ? String(res.content || '') : null; } catch { return null; } }
async function saveJson(path: string, json: any): Promise<boolean> { try { const res = await (window as any).foundry.saveJson(path, json); return !!(res && res.ok); } catch { return false; } }

function deepCopy<T>(v: T): T { return JSON.parse(JSON.stringify(v)); }

function clamp01(n: number): number { return n < 0 ? 0 : n > 1 ? 1 : n; }

function pushUndo(st: EditorState): void { st.undo.push(deepCopy(st.map)); if (st.undo.length > 100) st.undo.shift(); st.redo = []; }
function doUndo(st: EditorState): void { if (!st.undo.length) return; st.redo.push(deepCopy(st.map)); const prev = st.undo.pop()!; st.map = prev; st.selectedId = null; render(st); }
function doRedo(st: EditorState): void { if (!st.redo.length) return; st.undo.push(deepCopy(st.map)); const next = st.redo.pop()!; st.map = next; st.selectedId = null; render(st); }

let isEmbed = false;

function ensureOverlay(): void {
  if (byId('spawn-overlay')) return;
  const embedRoot = byId('sp-embed');
  isEmbed = !!embedRoot;
  const wrap = document.createElement('div');
  wrap.id = 'spawn-overlay';
  if (isEmbed) {
    // Inline inside Layers tab
    wrap.className = '';
  } else {
    wrap.className = 'live-preview hidden';
    wrap.setAttribute('aria-hidden', 'true');
  }
  const header = isEmbed ? '' : `
  <div class="lp-header"><div class="lp-title">Spawn Editor</div><div class="lp-controls">
    <button id="sp-close" class="btn-ghost" aria-label="Close">✕</button>
  </div></div>`;
  wrap.innerHTML = `
  ${header}
  <div class="lp-body" style="display:grid; grid-template-columns: 1fr 280px; gap:12px;">
    <div style="position:relative; min-height: 240px;">
      <canvas id="sp-canvas" style="display:block; width:100%; height:100%; background: repeating-conic-gradient(#ccc 0% 25%, transparent 0% 50%) 50% / 16px 16px;"></canvas>
    </div>
    <div style="display:flex; flex-direction:column; gap:8px;">
      <div class="gallery-card" style="padding:8px;">
        <div class="gallery-header"><h3 class="m-0">Dot</h3></div>
        <div class="form-grid cols-2">
          <div><label>X</label><input id="sp-x" type="number" step="0.001" min="0" max="1" /></div>
          <div><label>Y</label><input id="sp-y" type="number" step="0.001" min="0" max="1" /></div>
          <div><label>Weight</label><input id="sp-weight" type="number" step="0.1" min="0" /></div>
          <div><label>Jitter px</label><input id="sp-jitter" type="number" step="1" min="0" /></div>
          <div><label>Max/use</label><input id="sp-max" type="number" step="1" min="0" /></div>
          <div><label>Tags</label><input id="sp-tags" placeholder="a,b,c" /></div>
        </div>
        <div class="row mt-8">
          <button id="sp-add" class="btn-secondary">Add</button>
          <button id="sp-del" class="btn-ghost">Delete</button>
          <button id="sp-dup" class="btn-ghost">Duplicate</button>
        </div>
      </div>
      <div class="gallery-card" style="padding:8px;">
        <div class="gallery-header"><h3 class="m-0">Mappings</h3></div>
        <div class="form-grid cols-1">
          <div><label>Layer → Dot (name)</label><input id="sp-layer-name" placeholder="Layer" /></div>
          <div class="row"><button id="sp-map-layer" class="btn-secondary btn-sm">Assign</button><button id="sp-unmap-layer" class="btn-ghost btn-sm">Unassign</button></div>
          <div><label>Asset → Dot (Layer:Value)</label><input id="sp-asset-key" placeholder="Layer:Value" /></div>
          <div class="row"><button id="sp-map-asset" class="btn-secondary btn-sm">Assign</button><button id="sp-unmap-asset" class="btn-ghost btn-sm">Unassign</button></div>
        </div>
      </div>
      <div class="gallery-card" style="padding:8px;">
        <div class="gallery-header"><h3 class="m-0">Rules</h3></div>
        <div class="form-grid cols-2">
          <div><label>Selection</label><select id="sp-policy"><option value="weighted">Weighted</option><option value="sequential">Sequential</option></select></div>
          <div><label>Fit</label><select id="sp-fit"><option value="contain">Contain</option><option value="cover">Cover</option><option value="stretch">Stretch</option></select></div>
          <div><label>Default jitter</label><input id="sp-jdef" type="number" min="0" step="1" /></div>
          <div><label>Grid px</label><input id="sp-grid" type="number" min="0" step="1" value="0" /></div>
          <div><label>Collision</label><input id="sp-collide" type="checkbox" /></div>
          <div><label>Padding</label><input id="sp-pad" type="number" min="0" step="1" /></div>
          <div><label>Strategy</label><select id="sp-strat"><option value="retry">Retry</option><option value="skip">Skip</option><option value="fallback">Fallback</option></select></div>
          <div><label>Attempts</label><input id="sp-attempts" type="number" min="1" step="1" /></div>
        </div>
      </div>
      <div class="row wrap">
        <button id="sp-import" class="btn-ghost btn-sm">Import</button>
        <button id="sp-export" class="btn-ghost btn-sm">Export</button>
        <button id="sp-save" class="btn-primary btn-sm">Save</button>
      </div>
      <div class="row wrap mini">
        <label class="row gap-6"><input id="sp-show-ids" type="checkbox"/> Show IDs</label>
        <label class="row gap-6"><input id="sp-show-weights" type="checkbox"/> Show Weights</label>
        <div class="flex-1"></div>
        <button id="sp-undo" class="btn-ghost btn-sm">Undo</button>
        <button id="sp-redo" class="btn-ghost btn-sm">Redo</button>
      </div>
    </div>
  </div>
  ${isEmbed ? '' : '<div id="sp-resize" class="lp-resize"></div>'}
  `;
  if (isEmbed && embedRoot) embedRoot.appendChild(wrap); else document.body.appendChild(wrap);
}

async function loadOrCreateMap(): Promise<SpawnMap> {
  const cfg = await readConfig();
  const w = Number(cfg?.image?.width || 1024);
  const h = Number(cfg?.image?.height || 1024);
  const mapPath = cfg?.spawn?.mapPath || 'spawn-map.json';
  const raw = await readFile(mapPath);
  if (raw) {
    try { const json = JSON.parse(raw); if (json && json.version === 1) return json as SpawnMap; } catch {}
  }
  // default
  return { version: 1, authoringSize: { width: w, height: h }, dots: [], mappings: { layerToDotIds: {}, assetToDotIds: {} }, rules: { selection: 'weighted', fitMode: 'contain' } };
}

function show(st: EditorState): void {
  const ov = byId('spawn-overlay'); if (!ov) return; if (!isEmbed) { ov.classList.remove('hidden'); ov.setAttribute('aria-hidden', 'false'); } st.visible = true; draw(st);
}
function hide(st: EditorState): void {
  const ov = byId('spawn-overlay'); if (!ov) return; if (!isEmbed) { ov.classList.add('hidden'); ov.setAttribute('aria-hidden', 'true'); } st.visible = false;
}

function canvasSize(): { w: number; h: number } {
  const ov = byId('spawn-overlay'); if (!ov) return { w: 800, h: 600 };
  const body = ov.querySelector('.lp-body') as HTMLElement; if (!body) return { w: 800, h: 600 };
  const rect = body.getBoundingClientRect();
  const right = body.children.item(1) as HTMLElement | null;
  const sidebarW = right ? (right.getBoundingClientRect().width + 12) : 280;
  const w = Math.max(200, Math.floor(rect.width - sidebarW - 12));
  const h = Math.max(200, Math.floor(rect.height - 12));
  return { w, h };
}

function draw(st: EditorState): void {
  const canvas = byId<HTMLCanvasElement>('sp-canvas'); if (!canvas) return;
  const { w, h } = canvasSize();
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d'); if (!ctx) return;
  ctx.clearRect(0, 0, w, h);
  // Draw current composition preview if available
  if (st.previewImage) {
    try { ctx.drawImage(st.previewImage, 0, 0, w, h); } catch {}
  }
  // background grid remains visible via CSS in transparent regions
  const r = 5;
  for (const d of st.map.dots) {
    const x = Math.round(d.x * w);
    const y = Math.round(d.y * h);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = (st.selectedId === d.id) ? '#1ec8ff' : '#ff4d8a';
    ctx.fill();
    if (st.showIds || st.showWeights) {
      ctx.fillStyle = '#222'; ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 3;
      const label = `${st.showIds ? d.id : ''}${st.showIds && st.showWeights ? ' ' : ''}${st.showWeights ? (d.weight ?? 1) : ''}`;
      if (label) { ctx.strokeText(label, x + 8, y - 8); ctx.fillText(label, x + 8, y - 8); }
    }
  }
}

function render(st: EditorState): void {
  // sync form
  const d = st.map.dots.find(dd => dd.id === st.selectedId) || null;
  const xEl = byId<HTMLInputElement>('sp-x'); const yEl = byId<HTMLInputElement>('sp-y');
  const wEl = byId<HTMLInputElement>('sp-weight'); const jEl = byId<HTMLInputElement>('sp-jitter');
  const mEl = byId<HTMLInputElement>('sp-max'); const tEl = byId<HTMLInputElement>('sp-tags');
  if (xEl && yEl && wEl && jEl && mEl && tEl) {
    xEl.value = d ? String(d.x) : '';
    yEl.value = d ? String(d.y) : '';
    wEl.value = d && d.weight !== undefined ? String(d.weight) : '';
    jEl.value = d && d.jitterRadiusPx !== undefined ? String(d.jitterRadiusPx) : '';
    mEl.value = d && d.maxPlacementsPerComposition !== undefined ? String(d.maxPlacementsPerComposition) : '';
    tEl.value = d && Array.isArray(d.tags) ? d.tags.join(',') : '';
  }
  const pol = byId<HTMLSelectElement>('sp-policy'); const fit = byId<HTMLSelectElement>('sp-fit');
  const jd = byId<HTMLInputElement>('sp-jdef'); const gs = byId<HTMLInputElement>('sp-grid');
  const co = byId<HTMLInputElement>('sp-collide'); const pad = byId<HTMLInputElement>('sp-pad');
  const strat = byId<HTMLSelectElement>('sp-strat'); const att = byId<HTMLInputElement>('sp-attempts');
  if (pol) pol.value = String(st.map.rules?.selection || 'weighted');
  if (fit) fit.value = String(st.map.rules?.fitMode || 'contain');
  if (jd) jd.value = String(st.map.rules?.jitter?.defaultRadiusPx || 0);
  if (gs) gs.value = String(st.gridSnapPx || 0);
  if (co) co.checked = !!st.map.rules?.collision?.enabled;
  if (pad) pad.value = String(st.map.rules?.collision?.paddingPx || 0);
  if (strat) strat.value = String(st.map.rules?.collision?.strategy || 'retry');
  if (att) att.value = String(st.map.rules?.collision?.maxAttemptsPerAsset || 10);
  const si = byId<HTMLInputElement>('sp-show-ids'); const sw = byId<HTMLInputElement>('sp-show-weights');
  if (si) si.checked = st.showIds; if (sw) sw.checked = st.showWeights;
  draw(st);
}

function attachHandlers(st: EditorState): void {
  const canvas = byId<HTMLCanvasElement>('sp-canvas');
  const getDotAt = (px: number, py: number): SpawnDot | null => {
    const { width: w, height: h } = canvas!;
    for (let i = st.map.dots.length - 1; i >= 0; i--) {
      const d = st.map.dots[i]!; const x = d.x * w, y = d.y * h;
      const dx = px - x, dy = py - y; if (dx*dx + dy*dy <= 36) return d; // r=6
    }
    return null;
  };
  if (canvas) {
    canvas.onmousedown = (e) => {
      const rect = canvas.getBoundingClientRect(); const px = e.clientX - rect.left; const py = e.clientY - rect.top;
      const hit = getDotAt(px, py);
      if (hit) {
        st.selectedId = hit.id; st.isDragging = true; st.dragOffset = { dx: px - hit.x * canvas.width, dy: py - hit.y * canvas.height };
      } else {
        // add dot
        pushUndo(st);
        const nx = clamp01(px / canvas.width);
        const ny = clamp01(py / canvas.height);
        const snapped = applySnap(st, nx, ny, canvas.width, canvas.height);
        const dot: SpawnDot = { id: uuid(), x: snapped.x, y: snapped.y, weight: 1 };
        st.map.dots.push(dot); st.selectedId = dot.id;
      }
      render(st);
    };
    window.addEventListener('mousemove', (e) => {
      if (!st.isDragging || !st.selectedId) return;
      const rect = canvas.getBoundingClientRect(); const px = e.clientX - rect.left; const py = e.clientY - rect.top;
      const d = st.map.dots.find(dd => dd.id === st.selectedId); if (!d) return;
      const nx = clamp01((px - (st.dragOffset?.dx || 0)) / canvas.width);
      const ny = clamp01((py - (st.dragOffset?.dy || 0)) / canvas.height);
      const snapped = applySnap(st, nx, ny, canvas.width, canvas.height);
      d.x = snapped.x; d.y = snapped.y; draw(st);
    });
    window.addEventListener('mouseup', () => { st.isDragging = false; st.dragOffset = null; });
  }

  const bindNum = (id: string, fn: (v: number) => void) => { const el = byId<HTMLInputElement>(id); if (el) el.oninput = () => { const n = Number(el.value || ''); if (!Number.isNaN(n)) { pushUndo(st); fn(n); render(st); } }; };
  const bindStr = (id: string, fn: (s: string) => void) => { const el = byId<HTMLInputElement>(id); if (el) el.onchange = () => { pushUndo(st); fn(String(el.value||'')); render(st); }; };
  bindNum('sp-x', (v)=>{ const d = cur(st); if (d) d.x = clamp01(v); });
  bindNum('sp-y', (v)=>{ const d = cur(st); if (d) d.y = clamp01(v); });
  bindNum('sp-weight', (v)=>{ const d = cur(st); if (d) d.weight = Math.max(0, v); });
  bindNum('sp-jitter', (v)=>{ const d = cur(st); if (d) d.jitterRadiusPx = Math.max(0, Math.round(v)); });
  bindNum('sp-max', (v)=>{ const d = cur(st); if (d) d.maxPlacementsPerComposition = Math.max(0, Math.round(v)); });
  bindStr('sp-tags', (s)=>{ const d = cur(st); if (d) d.tags = s.split(',').map(x=>x.trim()).filter(Boolean); });

  const add = byId('sp-add'); if (add) add.onclick = () => { const c = byId<HTMLCanvasElement>('sp-canvas'); if (!c) return; pushUndo(st); const dot: SpawnDot = { id: uuid(), x: 0.5, y: 0.5, weight: 1 }; st.map.dots.push(dot); st.selectedId = dot.id; render(st); };
  const del = byId('sp-del'); if (del) del.onclick = () => { if (!st.selectedId) return; pushUndo(st); st.map.dots = st.map.dots.filter(d=>d.id!==st.selectedId); st.selectedId=null; render(st); };
  const dup = byId('sp-dup'); if (dup) dup.onclick = () => { const d = cur(st); if (!d) return; pushUndo(st); const c = deepCopy(d); c.id = uuid(); st.map.dots.push(c); st.selectedId = c.id; render(st); };

  const mapLayer = byId('sp-map-layer'); if (mapLayer) mapLayer.onclick = () => { const d = cur(st); if (!d) return; const el = byId<HTMLInputElement>('sp-layer-name'); const name = String(el?.value||'').trim(); if (!name) return; pushUndo(st); const arr = st.map.mappings ||= { layerToDotIds: {}, assetToDotIds: {} }; const list = arr.layerToDotIds ||= {}; const ids = list[name] ||= []; if (!ids.includes(d.id)) ids.push(d.id); render(st); };
  const unmapLayer = byId('sp-unmap-layer'); if (unmapLayer) unmapLayer.onclick = () => { const d = cur(st); if (!d) return; const el = byId<HTMLInputElement>('sp-layer-name'); const name = String(el?.value||'').trim(); if (!name) return; pushUndo(st); const m = st.map.mappings?.layerToDotIds; if (!m) return; const ids = m[name]; if (!ids) return; m[name] = ids.filter(id => id !== d.id); render(st); };
  const mapAsset = byId('sp-map-asset'); if (mapAsset) mapAsset.onclick = () => { const d = cur(st); if (!d) return; const el = byId<HTMLInputElement>('sp-asset-key'); const key = String(el?.value||'').trim(); if (!key) return; pushUndo(st); const arr = st.map.mappings ||= { layerToDotIds: {}, assetToDotIds: {} }; const list = arr.assetToDotIds ||= {}; const ids = list[key] ||= []; if (!ids.includes(d.id)) ids.push(d.id); render(st); };
  const unmapAsset = byId('sp-unmap-asset'); if (unmapAsset) unmapAsset.onclick = () => { const d = cur(st); if (!d) return; const el = byId<HTMLInputElement>('sp-asset-key'); const key = String(el?.value||'').trim(); if (!key) return; pushUndo(st); const m = st.map.mappings?.assetToDotIds; if (!m) return; const ids = m[key]; if (!ids) return; m[key] = ids.filter(id => id !== d.id); render(st); };

  const pol = byId<HTMLSelectElement>('sp-policy'); if (pol) pol.onchange = () => { pushUndo(st); st.map.rules = st.map.rules || {}; st.map.rules.selection = (pol.value as any); render(st); };
  const fit = byId<HTMLSelectElement>('sp-fit'); if (fit) fit.onchange = () => { pushUndo(st); st.map.rules = st.map.rules || {}; st.map.rules.fitMode = (fit.value as any); render(st); };
  const jd = byId<HTMLInputElement>('sp-jdef'); if (jd) jd.oninput = () => { pushUndo(st); st.map.rules = st.map.rules || {}; st.map.rules.jitter = st.map.rules.jitter || {}; st.map.rules.jitter.defaultRadiusPx = Math.max(0, Math.round(Number(jd.value||'0')||0)); render(st); };
  const gs = byId<HTMLInputElement>('sp-grid'); if (gs) gs.oninput = () => { st.gridSnapPx = Math.max(0, Math.round(Number(gs.value||'0')||0)); draw(st); };
  const co = byId<HTMLInputElement>('sp-collide'); if (co) co.onchange = () => { pushUndo(st); st.map.rules = st.map.rules || {}; st.map.rules.collision = st.map.rules.collision || {}; st.map.rules.collision.enabled = !!co.checked; render(st); };
  const pad = byId<HTMLInputElement>('sp-pad'); if (pad) pad.oninput = () => { pushUndo(st); st.map.rules = st.map.rules || {}; st.map.rules.collision = st.map.rules.collision || {}; st.map.rules.collision.paddingPx = Math.max(0, Math.round(Number(pad.value||'0')||0)); render(st); };
  const strat = byId<HTMLSelectElement>('sp-strat'); if (strat) strat.onchange = () => { pushUndo(st); st.map.rules = st.map.rules || {}; st.map.rules.collision = st.map.rules.collision || {}; st.map.rules.collision.strategy = (strat.value as any); render(st); };
  const att = byId<HTMLInputElement>('sp-attempts'); if (att) att.oninput = () => { pushUndo(st); st.map.rules = st.map.rules || {}; st.map.rules.collision = st.map.rules.collision || {}; st.map.rules.collision.maxAttemptsPerAsset = Math.max(1, Math.round(Number(att.value||'10')||10)); render(st); };

  const si = byId<HTMLInputElement>('sp-show-ids'); if (si) si.onchange = () => { st.showIds = !!si.checked; draw(st); };
  const sw = byId<HTMLInputElement>('sp-show-weights'); if (sw) sw.onchange = () => { st.showWeights = !!sw.checked; draw(st); };

  const undo = byId('sp-undo'); if (undo) undo.onclick = () => doUndo(st);
  const redo = byId('sp-redo'); if (redo) redo.onclick = () => doRedo(st);

  const close = byId('sp-close'); if (close) close.onclick = () => hide(st);

  const save = byId('sp-save'); if (save) save.onclick = async () => {
    const cfg = await readConfig(); if (!cfg) { alert('No project'); return; }
    const rel = cfg?.spawn?.mapPath || 'spawn-map.json';
    const ok = await saveJson(rel, st.map);
    if (!cfg.spawn) cfg.spawn = {}; cfg.spawn.mapPath = rel;
    await writeConfig(cfg);
    alert(ok ? 'Saved spawn-map.json' : 'Save failed');
    // Reload composition to reflect latest spawn map
    try { await loadCompositionPreview(st); } catch {}
  };
  const exp = byId('sp-export'); if (exp) exp.onclick = async () => {
    const blob = new Blob([JSON.stringify(st.map, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'spawn-map.json'; a.click(); URL.revokeObjectURL(url);
  };
  const imp = byId('sp-import'); if (imp) imp.onclick = async () => {
    const input = document.createElement('input'); input.type = 'file'; input.accept = 'application/json';
    input.onchange = async () => { const f = input.files && input.files[0]; if (!f) return; const text = await f.text(); try { const json = JSON.parse(text); if (json && json.version === 1) { pushUndo(st); st.map = json; st.selectedId = null; render(st); } } catch { alert('Invalid map'); } };
    input.click();
  };
}

function cur(st: EditorState): SpawnDot | null { return st.map.dots.find(d => d.id === st.selectedId) || null; }

function applySnap(st: EditorState, nx: number, ny: number, canvasW: number, canvasH: number): { x: number; y: number } {
  const gx = st.gridSnapPx || 0; if (gx <= 0) return { x: nx, y: ny };
  const px = nx * canvasW; const py = ny * canvasH;
  const sx = Math.round(px / gx) * gx; const sy = Math.round(py / gx) * gx;
  return { x: clamp01(sx / canvasW), y: clamp01(sy / canvasH) };
}

async function loadCompositionPreview(st: EditorState): Promise<void> {
  try {
    const cfg = await readConfig(); if (!cfg) return;
    // Try full generator path first
    try {
      const res = await (window as any).foundry.previewLive(cfg, 1, 'spawn-editor');
      const b64 = (res && res.ok && Array.isArray(res.images) && res.images[0]) ? String(res.images[0]) : '';
      if (b64) {
        const mime = (String(res?.format||'').toLowerCase() === 'webp') ? 'image/webp' : 'image/png';
        const img = new Image(); img.onload = () => { st.previewImage = img; draw(st); }; img.onerror = () => {}; img.src = `data:${mime};base64,` + b64; return;
      }
    } catch (e) { /* fall through */ }
    // Fallback: accurate compositor without generator randomness
    try {
      const one = await (window as any).foundry.previewEffects(cfg);
      const b64 = (one && one.ok && one.b64) ? String(one.b64) : '';
      if (b64) {
        const mime = (String(one?.format||'').toLowerCase() === 'webp') ? 'image/webp' : 'image/png';
        const img = new Image(); img.onload = () => { st.previewImage = img; draw(st); }; img.onerror = () => {}; img.src = `data:${mime};base64,` + b64; return;
      }
    } catch (e) { /* fall through */ }
    // Fallback: last generated preview from folder
    try {
      const last = await loadLastPreviewFromFolder();
      if (last) { const img = new Image(); img.onload = () => { st.previewImage = img; draw(st); }; img.onerror = () => {}; img.src = last; return; }
    } catch (e) { /* fall through */ }
    // Last fallback: quick local composite in renderer
    try {
      const url = await composeLocalFallback(cfg);
      if (url) { const img = new Image(); img.onload = () => { st.previewImage = img; draw(st); }; img.onerror = () => {}; img.src = url; return; }
    } catch (e) { /* give up */ }
  } catch {}
}

async function loadLastPreviewFromFolder(): Promise<string | null> {
  try {
    const cfg = await (window as any).foundry.readConfig(); if (!cfg || !cfg.ok) return null;
    const outDir = (cfg.json.export?.previewOutDir) || (cfg.json.export?.outDir) || 'build';
    const base = await (window as any).foundry.getProjectDir();
    const projectBase = (base && base.projectDir) ? base.projectDir.replace(/\\/g,'/') : '';
    const cleanedOutDir = String(outDir || '').replace(/\\+$/,'').replace(/\/+$/,'');
    const primary = /(^|[\\/])preview$/i.test(cleanedOutDir) ? cleanedOutDir : (cleanedOutDir + '/preview');
    const list = await (window as any).foundry.listDir(primary);
    if (!list || !list.ok || !Array.isArray(list.items)) return null;
    const files = (list.items as string[]).filter((n)=>!/\/$/.test(n) && /\.(png|webp|gif)$/i.test(n)).sort();
    if (!files.length) return null;
    const name = files[files.length - 1]!;
    const url = projectBase ? encodeURI('file:///' + projectBase + '/' + primary.replace(/^\/+/, '') + '/' + name).replace(/#/g, '%23') : null;
    return url;
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
    const picks: Array<{ url: string; blend: GlobalCompositeOperation; opacity: number; x: number; y: number }> = [];
    const mapBlend = (mode?: string): GlobalCompositeOperation => {
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
        case 'color-dodge':
        case 'colour-dodge': return 'lighter';
        case 'difference': return 'difference';
        case 'exclusion': return 'exclusion';
      }
    };
    for (const layer of layers) {
      if (!layer || !layer.path) continue;
      const listing = await (window as any).foundry.listDir(layer.path);
      if (!listing || !listing.ok || !Array.isArray(listing.items)) continue;
      const files = (listing.items as string[]).filter((n)=>!n.endsWith('/') && /\.(png|webp|gif)$/i.test(n));
      if (!files.length) continue;
      const name = files[0]!;
      const url = encodeURI('file:///' + baseDir.replace(/\\/g,'/') + '/' + String(layer.path).replace(/\\/g,'/').replace(/^\/+/, '') + '/' + name).replace(/#/g, '%23');
      const blend = mapBlend(String(layer.blend ?? layer.effects?.blend));
      const opacity = typeof layer.opacity === 'number' ? layer.opacity : (typeof layer.effects?.opacity === 'number' ? layer.effects.opacity : 1);
      const x = Number(layer.effects?.offsetX || 0);
      const y = Number(layer.effects?.offsetY || 0);
      picks.push({ url, blend, opacity: Math.max(0, Math.min(1, Number(opacity) || 1)), x, y });
    }
    if (!picks.length) return null;
    const imgs = await Promise.all(picks.map((p) => new Promise<HTMLImageElement>((resolve, reject) => { const img = new Image(); img.onload = () => resolve(img); img.onerror = () => reject(new Error('img load failed')); img.src = p.url; })) ).catch(() => null as any);
    if (!imgs || !Array.isArray(imgs)) return null;
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext('2d'); if (!ctx) return null;
    if (bg && bg !== 'transparent') { ctx.fillStyle = bg; ctx.fillRect(0,0,width,height); }
    for (let i = 0; i < picks.length; i++) { const p = picks[i]!; const img = imgs[i]!; ctx.globalCompositeOperation = p.blend || 'source-over'; ctx.globalAlpha = typeof p.opacity === 'number' ? p.opacity : 1; try { ctx.drawImage(img, (p.x||0), (p.y||0), width, height); } catch {} }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    const b64 = canvas.toDataURL('image/png').split(',')[1] || '';
    return b64 ? ('data:image/png;base64,' + b64) : null;
  } catch { return null; }
}

async function initSpawnEditor(): Promise<void> {
  ensureOverlay();
  const state: EditorState = { visible: false, map: await loadOrCreateMap(), selectedId: null, isDragging: false, dragOffset: null, gridSnapPx: 0, showIds: false, showWeights: false, undo: [], redo: [], previewImage: null };
  attachHandlers(state);
  render(state);
  await loadCompositionPreview(state);
  window.addEventListener('resize', () => { draw(state); });
  // Auto-show when embedded
  if (isEmbed) { show(state); }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => { initSpawnEditor().catch(()=>{}); });
else initSpawnEditor().catch(()=>{});


