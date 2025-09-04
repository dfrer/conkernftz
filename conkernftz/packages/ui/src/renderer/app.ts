// @ts-nocheck
import { tokens } from "../design-system/tokens";
console.debug("Design tokens loaded", tokens);

// Renderer logic extracted from index.html
// Ensure bridge exists even if preload failed to load
window.foundry = window.foundry || {
  run: async () => ({ ok: false, error: 'preload not loaded' }),
  chooseProjectDir: async () => ({ ok: false, error: 'preload not loaded' }),
  getProjectDir: async () => ({ ok: true, projectDir: null }),
  setProjectDir: async () => ({ ok: false, error: 'preload not loaded' }),
  readConfig: async () => ({ ok: false, error: 'preload not loaded' }),
  readConfigAt: async () => ({ ok: false, error: 'preload not loaded' }),
  writeConfig: async () => ({ ok: false, error: 'preload not loaded' }),
  chooseDirInsideProject: async () => ({ ok: false, error: 'preload not loaded' }),
  readFile: async () => ({ ok: false, error: 'preload not loaded' }),
  ensureDirs: async () => ({ ok: false, error: 'preload not loaded' }),
  listImages: async () => ({ ok: false, count: 0, error: 'preload not loaded' }),
  openInExplorer: async () => ({ ok: false, error: 'preload not loaded' }),
  listDir: async () => ({ ok: false, items: [], error: 'preload not loaded' }),
  renameFiles: async () => ({ ok: false, error: 'preload not loaded' }),
};
// Views & Tabs
const viewLauncher = document.getElementById('view-launcher');
const viewApp = document.getElementById('view-app');
const tabButtons = Array.from(document.querySelectorAll('.tab-btn'));
const tabMain = document.getElementById('tab-main');
const tabMint = document.getElementById('tab-mint');
const tabOptions = document.getElementById('tab-options');
const tabFal = document.getElementById('tab-fal');
const tabHelp = document.getElementById('tab-help');
const tabAbout = document.getElementById('tab-about');
function switchTab(name) {
  const map = { main: tabMain, mint: tabMint, options: tabOptions, fal: tabFal, help: tabHelp, about: tabAbout };
  Object.entries(map).forEach(([key, pane]) => {
    if (!pane) return;
    if (key === name) pane.classList.remove('hidden'); else pane.classList.add('hidden');
  });
  tabButtons.forEach((b) => b.classList.toggle('active', b.dataset.tab === name));
  try { localStorage.setItem('ui:lastTab', name); } catch {}
  // Ensure subtabs default when entering Main
  if (name === 'main') {
    switchSubtab(localStorage.getItem('ui:lastSubtab') || 'overview');
  }
  // Build help content when entering Help tab
  if (name === 'help') {
    try { buildHelpPage(); } catch {}
  }
  // Re-attach help icons in the newly shown tab
  attachHelpAnchors();
}
tabButtons.forEach((b) => b.addEventListener('click', () => switchTab(b.dataset.tab)));
function showView(which) {
  if (which === 'app') { viewApp.classList.remove('hidden'); viewLauncher.classList.add('hidden'); }
  else { viewLauncher.classList.remove('hidden'); viewApp.classList.add('hidden'); }
}
document.getElementById('btn-switch-project').addEventListener('click', () => showView('launcher'));
const logoOverlayEl = document.querySelector('.logo-overlay');
logoOverlayEl && logoOverlayEl.addEventListener('click', () => showView('launcher'));

// External links (NASA + Twitter) and brand popup
const btnNasa = document.getElementById('btn-nasa');
if (btnNasa) {
  btnNasa.addEventListener('click', (e) => {
    e.preventDefault();
    window.foundry.openExternal('https://northamericansurveillanceassociation.com');
  });
}
const aboutTwitter = document.getElementById('about-twitter');
if (aboutTwitter) {
  aboutTwitter.addEventListener('click', (e) => {
    e.preventDefault();
    window.foundry.openExternal('https://twitter.com/conkernasa');
  });
}
const aboutSite = document.getElementById('about-site');
if (aboutSite) {
  aboutSite.addEventListener('click', (e) => {
    e.preventDefault();
    window.foundry.openExternal('https://northamericansurveillanceassociation.com');
  });
}

// Main subtabs
const subtabButtons = Array.from(document.querySelectorAll('.subtab-btn'));
const subOverview = document.getElementById('main-overview');
const subConfigure = document.getElementById('main-configure');
const subRules = document.getElementById('main-rules');
const subReports = document.getElementById('main-reports');
function switchSubtab(name) {
  const map = { overview: subOverview, configure: subConfigure, rules: subRules, reports: subReports };
  Object.entries(map).forEach(([key, pane]) => {
    if (!pane) return;
    if (key === name) pane.classList.remove('hidden'); else pane.classList.add('hidden');
  });
  subtabButtons.forEach((b) => b.classList.toggle('active', b.dataset.subtab === name));
  try { localStorage.setItem('ui:lastSubtab', name); } catch {}
}
subtabButtons.forEach((b) => b.addEventListener('click', () => switchSubtab(b.dataset.subtab)));

// Recent projects (localStorage)
function readRecents() {
  try { return JSON.parse(localStorage.getItem('foundry:recents') || '[]'); } catch { return []; }
}
function writeRecents(list) {
  try { localStorage.setItem('foundry:recents', JSON.stringify(list)); } catch {}
}
function addRecent(dir) {
  if (!dir) return;
  const list = readRecents();
  const existing = list.find((r) => r.dir === dir);
  const ts = Date.now();
  if (existing) { existing.lastUsed = ts; } else { list.push({ dir, lastUsed: ts }); }
  list.sort((a,b) => (b.lastUsed||0) - (a.lastUsed||0));
  writeRecents(list);
}
function removeRecent(dir) {
  const list = readRecents().filter((r) => r.dir !== dir);
  writeRecents(list);
  renderRecents();
}
function renderRecents() {
  const grid = document.getElementById('projects-grid');
  const createCard = document.getElementById('proj-create');
  const list = readRecents();
  Array.from(grid.querySelectorAll('.proj-card.item')).forEach((n) => n.remove());
  const folderName = (p) => String(p||'').replace(/[\\/]+$/, '').split(/\\|\//).pop();
  list.forEach((r) => {
    const card = document.createElement('div');
    card.className = 'proj-card item';
    const thumbSrc = '';
    card.innerHTML = `
      <img class="proj-thumb" alt="thumb" />
      <div class="proj-name">${folderName(r.dir)}</div>
      <div class="proj-path">${r.dir}</div>
      <div class="proj-actions">
        <button class="proj-remove">Remove</button>
        <button class="btn-primary proj-open">Open</button>
      </div>`;
    const img = card.querySelector('.proj-thumb');
    // Try to infer a preview image (use config.previewOutDir if present)
    (async () => {
      try {
        const norm = (p) => String(p||'').replace(/\\/g,'/');
        const joinAbs = (dir, name) => (norm(dir).replace(/\/$/,'')) + '/' + String(name||'').replace(/^\//,'');
        const isAbs = (p) => /^(?:[a-zA-Z]:[\\/]|\\\\|\/)/.test(String(p||''));
        const absFileUrl = (absPath) => encodeURI('file:///' + norm(absPath));
        // Read project config to detect custom preview output dir
        const cfg = await window.foundry.readConfigAt(r.dir);
        const configured = (cfg && cfg.ok && cfg.json && cfg.json.export && cfg.json.export.previewOutDir) ? String(cfg.json.export.previewOutDir) : null;
        const projectDir = norm(r.dir);
        const candidatePaths = [];
        if (configured && configured.trim()) {
          const clean = norm(configured).replace(/\/$/,'');
          if (isAbs(clean)) {
            candidatePaths.push(clean);
            // Also try configured + '/preview' if not already a preview dir
            if (!/\/(?:preview)$/i.test(clean)) candidatePaths.push(clean + '/preview');
          } else {
            const relAbs = joinAbs(projectDir, clean);
            candidatePaths.push(relAbs);
            if (!/\/(?:preview)$/i.test(clean)) candidatePaths.push(relAbs + '/preview');
          }
        }
        candidatePaths.push(joinAbs(projectDir, 'build/preview'));
        candidatePaths.push(joinAbs(projectDir, 'preview'));
        candidatePaths.push(joinAbs(projectDir, 'build'));

        const imageRegex = /\.(png|webp|gif)$/i;
        let pickedAbs = '';
        for (const target of candidatePaths) {
          const listing = await window.foundry.listDir(target);
          if (!listing.ok || !Array.isArray(listing.items)) continue;
          const files = listing.items.filter((n) => !n.endsWith('/') && imageRegex.test(n));
          if (!files.length) continue;
          const preferred = files.find((n) => /^preview_\d+\./i.test(n))
            || files.find((n) => /^contact-sheet/i.test(n))
            || files[0];
          pickedAbs = joinAbs(target, preferred);
          break;
        }
        if (pickedAbs) {
          img.src = absFileUrl(pickedAbs);
          img.classList.remove('placeholder');
        } else {
          img.removeAttribute('src');
          img.classList.add('placeholder');
        }
      } catch {
        img.removeAttribute('src');
        img.classList.add('placeholder');
      }
    })();
    card.querySelector('.proj-remove').addEventListener('click', (e) => { e.stopPropagation(); removeRecent(r.dir); });
    card.querySelector('.proj-open').addEventListener('click', async (e) => { e.stopPropagation(); await openProject(r.dir); });
    card.addEventListener('click', async () => { await openProject(r.dir); });
    grid.insertBefore(card, createCard);
  });
}

async function openProject(dir) {
  const set = await window.foundry.setProjectDir(dir);
  if (set && set.ok) {
    addRecent(dir);
    showView('app');
    await loadConfigUI();
    await updateAssetCounts();
    await refreshPreviews();
    const lastTab = localStorage.getItem('ui:lastTab') || 'main';
    switchTab(lastTab);
    switchSubtab(localStorage.getItem('ui:lastSubtab') || 'overview');
    setProjectLabels(dir);
    // Build help content and attach contextual help icons
    try { buildHelpPage(); } catch {}
    attachHelpAnchors();
  } else {
    log(set.error || 'Failed to set project');
  }
}

document.getElementById('proj-create').addEventListener('click', async () => {
  const res = await window.foundry.chooseProjectDir();
  if (res && res.ok && res.projectDir) {
    await window.foundry.setProjectDir(res.projectDir);
    addRecent(res.projectDir);
    const init = await window.foundry.run(['init']);
    log(init.ok ? init.stdout : init.error);
    showView('app');
    await loadConfigUI();
    await refreshPreviews();
  }
});
document.getElementById('btn-launcher-browse').addEventListener('click', async () => {
  const res = await window.foundry.chooseProjectDir();
  if (res && res.ok && res.projectDir) {
    await openProject(res.projectDir);
  }
});

const out = document.getElementById('out');
const previews = document.getElementById('previews');
const previewsEmpty = document.getElementById('previews-empty');
const galleryMeta = document.getElementById('gallery-meta');
const lightbox = document.getElementById('lightbox');
const lbImage = document.getElementById('lb-image');
const btnOpenPreviews = document.getElementById('btn-open-previews');
const lbPrev = document.getElementById('lb-prev');
const lbNext = document.getElementById('lb-next');
const lbClose = document.getElementById('lb-close');
const tbody = document.getElementById('layers-tbody');
const btnAddLayer = document.getElementById('btn-add-layer');
const btnSaveConfig = document.getElementById('btn-save-config');
const btnCreateFolders = document.getElementById('btn-create-folders');
const btnRefreshAssets = document.getElementById('btn-refresh-assets');
// Image Renamer refs
const irLayerList = document.getElementById('ir-layer-list');
const irRefresh = document.getElementById('ir-refresh');
const irAddFolder = document.getElementById('ir-add-folder');
const irNameMode = document.getElementById('ir-name-mode');
const irBaseName = document.getElementById('ir-base-name');
const irStart = document.getElementById('ir-start');
const irPad = document.getElementById('ir-pad');
const irNameList = document.getElementById('ir-name-list');
const irIncludeLayer = document.getElementById('ir-include-layer');
const irDelim = document.getElementById('ir-delim');
const irRarityMode = document.getElementById('ir-rarity-mode');
const irWeight = document.getElementById('ir-weight');
const irMin = document.getElementById('ir-min');
const irMax = document.getElementById('ir-max');
const irBulkRename = document.getElementById('ir-bulk-rename');
const irOpenStep = document.getElementById('ir-open-step');
let currentConfig = null;
function log(msg) { out.textContent = String(msg || '') }
let galleryUrls = [];
let cacheBustToken = 0;
let currentIndex = -1;
function setGalleryMeta() {
  if (galleryMeta) galleryMeta.textContent = galleryUrls.length ? (galleryUrls.length + ' image' + (galleryUrls.length === 1 ? '' : 's')) : '';
}
function isAbsolutePath(p) {
  // Windows: C:\ or \\server\share ; POSIX: /
  return /^(?:[a-zA-Z]:[\\/]|\\\\|\/)/.test(p || '');
}
function fileUrl(baseDir, folder, name) {
  const nameNorm = String(name || '').replace(/\\/g, '/').replace(/^\//,'');
  let url = '';
  if (isAbsolutePath(folder)) {
    const folderNorm = String(folder || '').replace(/\\/g, '/').replace(/\/$/,'');
    url = 'file:///' + folderNorm + '/' + nameNorm;
  } else {
    const baseNorm = String(baseDir || '').replace(/\\/g, '/').replace(/\/$/,'');
    const folderNorm = String(folder || '').replace(/\\/g, '/').replace(/^\//,'').replace(/\/$/,'');
    url = 'file:///' + baseNorm + (folderNorm ? '/' + folderNorm : '') + '/' + nameNorm;
  }
  // encodeURI leaves '#' unescaped which breaks file URLs; patch it afterwards
  return encodeURI(url).replace(/#/g, '%23');
}
function mountThumbGrid(baseDir, folder, files) {
  previews.innerHTML = '';
  galleryUrls = files.map((name) => {
    const u = fileUrl(baseDir, folder, name);
    const sep = u.includes('?') ? '&' : '?';
    return u + sep + 'v=' + cacheBustToken;
  });
  setGalleryMeta();
  if (!galleryUrls.length) {
    previewsEmpty.style.display = 'block';
    return;
  }
  previewsEmpty.style.display = 'none';
  galleryUrls.forEach((url, i) => {
    const wrap = document.createElement('div');
    wrap.className = 'thumb';
    wrap.dataset.index = String(i);
    const img = document.createElement('img');
    img.src = url;
    img.alt = 'Preview ' + (i + 1);
    img.onerror = () => { wrap.remove(); };
    const badge = document.createElement('div');
    badge.className = 'badge';
    badge.textContent = String(i + 1);
    wrap.appendChild(img);
    wrap.appendChild(badge);
    previews.appendChild(wrap);
  });
}
function openLightbox(index) {
  if (!galleryUrls.length) return;
  currentIndex = (index + galleryUrls.length) % galleryUrls.length;
  lbImage.src = galleryUrls[currentIndex];
  lightbox.classList.add('open');
  lightbox.setAttribute('aria-hidden', 'false');
}
function closeLightbox() {
  lightbox.classList.remove('open');
  lightbox.setAttribute('aria-hidden', 'true');
}
function nav(delta) {
  if (!galleryUrls.length) return;
  currentIndex = (currentIndex + delta + galleryUrls.length) % galleryUrls.length;
  lbImage.src = galleryUrls[currentIndex];
}
async function refreshPreviews() {
  try {
    previews.innerHTML = '';
    previewsEmpty.style.display = 'none';
    cacheBustToken = Date.now();
    const cfg = await window.foundry.readConfig();
    if (!cfg.ok) return;
    const outDir = (cfg.json.export?.previewOutDir) || (cfg.json.export?.outDir) || 'build';
    const base = await window.foundry.getProjectDir();
    function isPreviewDir(p) { return /(\\|\/)preview$/i.test(String(p || '').replace(/[\\/]+$/,'')); }
    const cleanedOutDir = outDir.replace(/\\+$/,'').replace(/\/+$/,'');
    const primary = (cfg.json.export?.previewOutDir)
      ? cleanedOutDir
      : (isPreviewDir(cleanedOutDir) ? cleanedOutDir : (cleanedOutDir + '/preview'));
    const altPreview = isPreviewDir(cleanedOutDir) ? cleanedOutDir : (cleanedOutDir + '/preview');
    const fallbacks = Array.from(new Set([altPreview, outDir, 'preview'])).filter(p => p !== primary);
    btnOpenPreviews.onclick = () => window.foundry.openInExplorer(primary);
    log('Scanning previews in: ' + primary);
    const projectBase = (base && base.projectDir) ? base.projectDir : '';
    async function listAndRender(dir) {
      const list = await window.foundry.listDir(dir);
      if (list.ok && Array.isArray(list.items) && list.items.length) {
        const imageFiles = list.items
          .filter((n) => !n.endsWith('/'))
          .filter((n) => /\.(png|webp|gif)$/i.test(n));
        if (!imageFiles.length) return false;
        const preferred = imageFiles.filter((n) => /^(preview_|contact-sheet)/i.test(n));
        const files = (preferred.length ? preferred : imageFiles)
          .sort((a, b) => {
            const isSheetA = a.toLowerCase().startsWith('contact-sheet');
            const isSheetB = b.toLowerCase().startsWith('contact-sheet');
            if (isSheetA && !isSheetB) return 1;
            if (!isSheetA && isSheetB) return -1;
            const na = Number((a.match(/preview_(\d+)/i) || [])[1] || 0);
            const nb = Number((b.match(/preview_(\d+)/i) || [])[1] || 0);
            return na - nb;
          });
        log(`Found ${files.length} image(s) in ${dir}`);
        mountThumbGrid(projectBase, dir, files);
        return true;
      }
      if (!list.ok) log(`Failed to list ${dir}: ${list.error || 'unknown error'}`);
      return false;
    }
    // Try primary location then fallbacks
    let rendered = await listAndRender(primary);
    if (!rendered) {
      for (const fb of fallbacks) {
        rendered = await listAndRender(fb);
        if (rendered) break;
      }
    }
    // As a last resort, try to infer sequential preview_#.png names from count
    if (!rendered) {
      const countRes = await window.foundry.listImages(primary);
      if (countRes && countRes.ok && Number(countRes.count) > 0) {
        const tryNames = [];
        const max = Number(countRes.count);
        for (let i = 1; i <= max; i++) tryNames.push(`preview_${i}.png`);
        mountThumbGrid(projectBase, primary, tryNames);
        rendered = true;
      }
    }
    // Small retry in case FS updates are delayed
    if (!rendered) {
      await new Promise(r => setTimeout(r, 250));
      rendered = await listAndRender(primary);
    }
    if (!rendered) {
      previewsEmpty.style.display = 'block';
      log('No previews found in: ' + primary);
    }
  } catch {
    previewsEmpty.style.display = 'block';
  }
}
function blendOptionsHtml(selected) {
  const modes = [
    'normal','clear','source','over','in','out','atop','dest','dest-over','dest-in','dest-out','dest-atop','xor',
    'add','linear-dodge','saturate','multiply','screen','overlay','darken','lighten','color-dodge','colour-dodge','color-burn','colour-burn',
    'hard-light','soft-light','difference','exclusion','subtract','divide','linear-burn','vivid-light','linear-light','pin-light','hard-mix',
    'darker-color','lighter-color','hue','saturation','color','luminosity'
  ];
  return modes.map(m => `<option value="${m}" ${selected === m ? 'selected' : ''}>${m}</option>`).join('');
}
function layerRowTemplate(idx, layer) {
  return `
    <tr data-idx="${idx}" style="border-bottom:1px solid #21262d;">
      <td style="padding:4px 6px; white-space:nowrap;">
        <button class="btn-up" title="Move up" style="padding:4px 6px; background:#30363d;">▲</button>
        <button class="btn-down" title="Move down" style="padding:4px 6px; background:#30363d;">▼</button>
      </td>
      <td style="padding:4px 6px;">
        <input class="layer-name" value="${layer.name || ''}">
      </td>
      <td style="padding:4px 6px;">
        <div style="display:flex; gap:6px; align-items:center;">
          <input class="layer-path" value="${layer.path || ''}" placeholder="layers/<folder>" style="flex:1;">
          <button class="btn-browse" title="Browse" style="padding:4px 6px; background:#30363d;">Browse</button>
        </div>
      </td>
      <td style="padding:4px 6px;">
        <select class="layer-rarity">
          <option value="filename" ${layer.rarity === 'filename' || !layer.rarity ? 'selected' : ''}>filename</option>
          <option value="uniform" ${layer.rarity === 'uniform' ? 'selected' : ''}>uniform</option>
        </select>
      </td>
      <td style="padding:4px 6px; text-align:center;">
        <input class="layer-required" type="checkbox" ${layer.required ? 'checked' : ''}>
      </td>
      <td style="padding:4px 6px;">
        <select class="layer-blend">${blendOptionsHtml(layer.blend || 'normal')}</select>
      </td>
      <td style="padding:4px 6px;">
        <input class="layer-opacity" type="number" min="0" max="1" step="0.01" value="${(typeof layer.opacity === 'number' ? layer.opacity : 1)}">
      </td>
      <td style="padding:4px 6px;">
        <span class="layer-assets" style="opacity:.8;">—</span>
      </td>
      <td style="padding:4px 6px;">
        <button class="btn-remove" style="background:#da3633;">Remove</button>
        <button class="btn-open-folder" title="Open folder" style="padding:4px 6px; background:#30363d; margin-left:6px;">Open</button>
      </td>
    </tr>`;
}
function renderLayersTable() {
  if (!currentConfig) return;
  tbody.innerHTML = '';
  (currentConfig.layers || []).forEach((layer, i) => {
    const tmpl = document.createElement('tbody');
    tmpl.innerHTML = layerRowTemplate(i, layer);
    const row = tmpl.firstElementChild;
    tbody.appendChild(row);
  });
}
// Progress UI elements and helpers
const progressRoot = document.getElementById('task-progress');
const progressBar = document.getElementById('task-progress-bar');
const progressText = document.getElementById('task-progress-text');
const progressPercent = document.getElementById('task-progress-percent');
let progressIntervalId = null;
function showProgressUI(show) {
  if (!progressRoot) return;
  progressRoot.classList.toggle('hidden', !show);
  progressRoot.setAttribute('aria-hidden', show ? 'false' : 'true');
}
function setProgress(percent, message) {
  if (!progressBar || !progressText || !progressPercent) return;
  const p = Math.max(0, Math.min(100, Math.floor(Number(percent) || 0)));
  progressBar.style.width = p + '%';
  progressPercent.textContent = p + '%';
  if (message) progressText.textContent = String(message);
}
function startProgress(message, estimateMs) {
  if (progressIntervalId) { clearInterval(progressIntervalId); progressIntervalId = null; }
  showProgressUI(true);
  setProgress(0, message || 'Working…');
  const start = Date.now();
  const duration = Math.max(2000, Number(estimateMs) || 10000);
  progressIntervalId = setInterval(() => {
    const elapsed = Date.now() - start;
    const frac = Math.min(0.9, (elapsed / duration) * 0.9);
    setProgress(Math.round(frac * 100), message || 'Working…');
  }, 200);
}
function endProgress(message, ok = true) {
  if (progressIntervalId) { clearInterval(progressIntervalId); progressIntervalId = null; }
  setProgress(100, message || (ok ? 'Completed.' : 'Failed.'));
  setTimeout(() => { showProgressUI(false); }, 1000);
}
function readLayersFromTable() {
  const rows = Array.from(tbody.querySelectorAll('tr'));
  return rows.map((tr) => {
    return {
      name: tr.querySelector('.layer-name').value.trim(),
      path: tr.querySelector('.layer-path').value.trim(),
      rarity: tr.querySelector('.layer-rarity').value,
      required: tr.querySelector('.layer-required').checked,
      blend: tr.querySelector('.layer-blend').value,
      opacity: Math.max(0, Math.min(1, Number(tr.querySelector('.layer-opacity').value) || 1)),
    };
  });
}
async function updateAssetCounts() {
  const rows = Array.from(tbody.querySelectorAll('tr'));
  for (const tr of rows) {
    const pathInput = tr.querySelector('.layer-path');
    const assetsSpan = tr.querySelector('.layer-assets');
    const rel = pathInput.value.trim();
    if (!rel) { assetsSpan.textContent = '—'; continue; }
    try {
      const res = await window.foundry.listImages(rel);
      if (res.ok) {
        assetsSpan.textContent = String(res.count) + ' file(s)';
      } else {
        assetsSpan.textContent = '0';
      }
    } catch {
      assetsSpan.textContent = '0';
    }
  }
}
function bindLayerTableEvents() {
  tbody.addEventListener('click', (e) => {
    const target = e.target;
    const tr = target.closest('tr');
    if (!tr) return;
    if (target.classList.contains('btn-remove')) {
      tr.remove();
      updateAssetCounts();
    } else if (target.classList.contains('btn-up')) {
      const prev = tr.previousElementSibling;
      if (prev) tbody.insertBefore(tr, prev);
    } else if (target.classList.contains('btn-down')) {
      const next = tr.nextElementSibling;
      if (next) tbody.insertBefore(next, tr);
    } else if (target.classList.contains('btn-browse')) {
      window.foundry.chooseDirInsideProject().then((res) => {
        if (res.ok && res.path) {
          const input = tr.querySelector('.layer-path');
          input.value = res.path;
          updateAssetCounts();
        }
      });
    } else if (target.classList.contains('btn-open-folder')) {
      const rel = tr.querySelector('.layer-path').value.trim();
      if (rel) window.foundry.openInExplorer(rel);
    }
  });
  tbody.addEventListener('change', (e) => {
    const target = e.target;
    if (target.classList.contains('layer-path')) {
      updateAssetCounts();
    }
  });
}
function populateFormFromConfig(cfg) {
  currentConfig = cfg;
  document.getElementById('cfg-name').value = cfg.name || '';
  document.getElementById('cfg-symbol').value = cfg.symbol || '';
  document.getElementById('cfg-editions').value = String(cfg.editionSize || 1);
  document.getElementById('cfg-image-w').value = String(cfg.image?.width || 1024);
  document.getElementById('cfg-image-h').value = String(cfg.image?.height || 1024);
  document.getElementById('cfg-image-bg').value = cfg.image?.background || '';
  document.getElementById('rarity-delim').value = cfg.rarity?.delimiter || '#';
  document.getElementById('rarity-default').value = String(cfg.rarity?.defaultWeight || 1);
  document.getElementById('uniq-ignore').value = (cfg.uniqueness?.ignore || []).join(', ');
  // rules
  document.getElementById('rules-json').value = JSON.stringify(cfg.rules || { mutuallyExclusive: [], requires: [], maxOccurrences: [] }, null, 2);
  // export
  document.getElementById('export-outdir').value = (cfg.export && cfg.export.outDir) ? cfg.export.outDir : 'build';
  document.getElementById('export-format').value = (cfg.export && cfg.export.imageFormat) ? cfg.export.imageFormat : 'png';
  document.getElementById('export-preview-outdir').value = (cfg.export && cfg.export.previewOutDir) ? cfg.export.previewOutDir : '';
  document.getElementById('export-contact').checked = Boolean(cfg.export?.includePreviewContactSheet ?? true);
  renderLayersTable();
  // Init Image Renamer defaults
  if (irDelim) irDelim.value = cfg.rarity?.delimiter || '#';
  if (irLayerList) renderIrLayerList();
}
async function loadConfigUI() {
  const cfg = await window.foundry.readConfig();
  if (cfg.ok && cfg.json) {
    populateFormFromConfig(cfg.json);
    updateStatsFromConfig(cfg.json);
  }
}
btnAddLayer.addEventListener('click', () => {
  const tr = document.createElement('tbody');
  tr.innerHTML = layerRowTemplate(tbody.children.length, { name: '', path: 'layers/', rarity: 'filename', required: false, blend: 'normal', opacity: 1 });
  tbody.appendChild(tr.firstElementChild);
  updateAssetCounts();
  if (irLayerList) renderIrLayerList();
});
if (btnCreateFolders) btnCreateFolders.addEventListener('click', async () => {
  const layers = readLayersFromTable();
  const paths = layers.map(l => l.path).filter(Boolean);
  const res = await window.foundry.ensureDirs(paths);
  log(res.ok ? 'Folders ensured.' : (res.error || 'Failed to create folders.'));
  updateAssetCounts();
});
if (btnRefreshAssets) btnRefreshAssets.addEventListener('click', () => updateAssetCounts());

function renderIrLayerList() {
  if (!irLayerList) return;
  const layers = readLayersFromTable();
  irLayerList.innerHTML = '';
  layers.forEach((l, idx) => {
    const div = document.createElement('div');
    div.style.border = '1px solid var(--border)';
    div.style.borderRadius = '10px';
    div.style.padding = '8px';
    div.style.background = 'var(--panel-soft)';
    div.innerHTML = `
      <label style="display:flex; align-items:center; gap:8px;">
        <input type="checkbox" class="ir-layer-check" data-path="${l.path||''}" />
        <span style="font-weight:600;">${l.name || ('Layer ' + (idx+1))}</span>
        <span class="muted" style="margin-left:auto;">${l.path || ''}</span>
      </label>`;
    irLayerList.appendChild(div);
  });
}

irRefresh && irRefresh.addEventListener('click', renderIrLayerList);
irAddFolder && irAddFolder.addEventListener('click', async () => {
  const res = await window.foundry.chooseDirInsideProject();
  if (!res.ok || !res.path) return;
  const div = document.createElement('div');
  div.style.border = '1px solid var(--border)';
  div.style.borderRadius = '10px';
  div.style.padding = '8px';
  div.style.background = 'var(--panel-soft)';
  div.innerHTML = `
    <label style=\"display:flex; align-items:center; gap:8px;\">\n            <input type=\"checkbox\" class=\"ir-layer-check\" data-path=\"${res.path}\" checked />\n            <span style=\"font-weight:600;\">(Custom)</span>\n            <span class=\"muted\" style=\"margin-left:auto;\">${res.path}</span>\n          </label>`;
  irLayerList && irLayerList.appendChild(div);
});

function padNumber(n, width) {
  const s = String(n);
  const w = Math.max(0, Number(width)||0);
  return w > 0 ? s.padStart(w, '0') : s;
}

function pickRandom(arr) { return arr[Math.floor(Math.random()*arr.length)]; }

async function buildRenamePlan(paths) {
  const delim = (irDelim && irDelim.value) || '#';
  const nameMode = irNameMode ? irNameMode.value : 'preset-seq';
  const baseName = irBaseName ? irBaseName.value.trim() : '';
  const start = irStart ? (Number(irStart.value) || 1) : 1;
  const pad = irPad ? (Number(irPad.value) || 0) : 0;
  const includeLayer = irIncludeLayer ? irIncludeLayer.checked : false;
  const rarityMode = irRarityMode ? irRarityMode.value : 'keep';
  const uniformWeight = Math.max(1, irWeight ? (Number(irWeight.value) || 1) : 1);
  const minW = Math.max(1, irMin ? (Number(irMin.value) || 1) : 1);
  const maxW = Math.max(minW, irMax ? (Number(irMax.value) || minW) : minW);
  const randomNames = irNameList ? irNameList.value.split(/\r?\n/).map(s=>s.trim()).filter(Boolean) : [];

  const imageRegex = /\.(png|webp|gif)$/i;
  const pairs = [];

  for (const rel of paths) {
    const list = await window.foundry.listDir(rel);
    if (!list.ok || !Array.isArray(list.items)) continue;
    let seq = start;
    const layerPrefix = includeLayer ? (String(rel).replace(/[\\/]+$/,'').split(/\\|\//).pop() || '') + '_' : '';
    const files = list.items.filter((n) => !n.endsWith('/') && imageRegex.test(n));
    for (const file of files) {
      const ext = file.replace(/^[^.]+(\.[^.]+)$/,'$1');
      let name = '';
      if (nameMode === 'keep') {
        name = file.replace(/\.[^.]+$/, '');
      } else if (nameMode === 'random-list' && randomNames.length) {
        name = pickRandom(randomNames);
      } else {
        name = baseName || 'Asset';
        name += padNumber(seq, pad);
        seq++;
      }
      let weight = 1;
      if (rarityMode === 'keep') {
        const m = file.replace(/\.[^.]+$/, '').match(/(.*?)(?:([#@:_-])(\d+))?$/);
        weight = m && m[3] ? Math.max(1, Number(m[3])) : uniformWeight;
      } else if (rarityMode === 'uniform') {
        weight = uniformWeight;
      } else {
        weight = Math.floor(minW + Math.random()*(maxW-minW+1));
      }
      const finalBase = (layerPrefix + name).replace(/\s+/g, ' ').trim();
      const target = `${rel.replace(/[\\/]+$/,'')}/${finalBase}${delim}${weight}${ext}`;
      pairs.push({ from: `${rel.replace(/[\\/]+$/,'')}/${file}`, to: target });
    }
  }
  return pairs;
}

irBulkRename && irBulkRename.addEventListener('click', async () => {
  try {
    const checks = irLayerList ? Array.from(irLayerList.querySelectorAll('.ir-layer-check')) : [];
    const selected = checks.filter((c) => c.checked).map((c) => c.dataset.path || '').filter(Boolean);
    if (!selected.length) { log('Select at least one folder.'); return; }
    const plan = await buildRenamePlan(selected);
    if (!plan.length) { log('No images found to rename.'); return; }
    const res = await window.foundry.renameFiles(plan);
    log(res.ok ? `Renamed ${res.renamed||0} file(s).` : (res.error || 'Rename failed'));
    await updateAssetCounts();
    cacheBustToken = Date.now();
    await refreshPreviews();
  } catch (e) {
    log(String((e && e.message) || e));
  }
});

// Step-through Renamer overlay
const rnOverlay = document.getElementById('renamer');
const rnImage = document.getElementById('rn-image');
const rnMeta = document.getElementById('rn-meta');
const rnClose = document.getElementById('rn-close');
const rnChoose = document.getElementById('rn-choose-folder');
const rnName = document.getElementById('rn-name');
const rnWeight = document.getElementById('rn-weight');
const rnDelim = document.getElementById('rn-delim');
const rnPrev = document.getElementById('rn-prev');
const rnApplyNext = document.getElementById('rn-apply-next');
const rnSkip = document.getElementById('rn-skip');
const rnRandomName = document.getElementById('rn-random-name');
const rnRandomWeight = document.getElementById('rn-random-weight');
const rnIncludeLayer = document.getElementById('rn-include-layer');

let rnFolder = '';
let rnFiles = [];
let rnIdx = 0;
let rnProjectBase = '';

function openRenamer() { rnOverlay && rnOverlay.classList.add('open'); rnOverlay && rnOverlay.setAttribute('aria-hidden','false'); }
function closeRenamer() { rnOverlay && rnOverlay.classList.remove('open'); rnOverlay && rnOverlay.setAttribute('aria-hidden','true'); }

function showCurrent() {
  if (!rnFolder || rnIdx < 0 || rnIdx >= rnFiles.length) return;
  const baseInfo = (rnIdx + 1) + '/' + rnFiles.length;
  if (rnImage) {
    const raw = fileUrl(rnProjectBase, rnFolder, rnFiles[rnIdx]);
    const sep = raw.includes('?') ? '&' : '?';
    rnImage.src = raw + sep + 'v=' + cacheBustToken;
  }
  if (rnMeta) rnMeta.textContent = baseInfo;
  if (rnName) rnName.value = rnFiles[rnIdx].replace(/\.[^.]+$/, '');
  if (rnDelim) rnDelim.value = (irDelim && irDelim.value) || '#';
  if (rnWeight) rnWeight.value = String(Math.max(1, Number(irWeight && irWeight.value || '1')));
}

async function ensureProjectBase() {
  try {
    const base = await window.foundry.getProjectDir();
    rnProjectBase = (base && base.projectDir) ? base.projectDir : '';
  } catch { rnProjectBase = ''; }
}

async function pickFolderForRenamer() {
  const res = await window.foundry.chooseDirInsideProject();
  if (!res.ok || !res.path) return;
  // Normalize rnFolder to POSIX-style for consistent fileUrl joining
  rnFolder = String(res.path).replace(/\\/g, '/').replace(/^\//,'').replace(/\/+/g,'/');
  await ensureProjectBase();
  const list = await window.foundry.listDir(rnFolder);
  if (!list.ok) { log(list.error || 'Failed to list folder'); return; }
  rnFiles = (list.items || []).filter((n) => /\.(png|webp|gif)$/i.test(n));
  rnIdx = 0;
  showCurrent();
}

rnChoose && rnChoose.addEventListener('click', pickFolderForRenamer);
rnClose && rnClose.addEventListener('click', closeRenamer);
irOpenStep && irOpenStep.addEventListener('click', async () => { await ensureProjectBase(); openRenamer(); if (!rnFolder) { await pickFolderForRenamer(); } else { showCurrent(); } });
rnPrev && rnPrev.addEventListener('click', () => { rnIdx = Math.max(0, rnIdx - 1); showCurrent(); });
rnSkip && rnSkip.addEventListener('click', async () => {
  // Re-list to keep in sync in case files were changed externally
  try { const list = await window.foundry.listDir(rnFolder); if (list.ok && Array.isArray(list.items)) { rnFiles = (list.items||[]).filter((n)=>/\.(png|webp|gif)$/i.test(n)); } } catch {}
  rnIdx = Math.min(rnFiles.length - 1, rnIdx + 1); showCurrent();
});
rnApplyNext && rnApplyNext.addEventListener('click', async () => {
  if (!rnFolder || rnIdx < 0 || rnIdx >= rnFiles.length) return;
  const file = rnFiles[rnIdx];
  const ext = file.replace(/^[^.]+(\.[^.]+)$/,'$1');
  const prefix = (rnIncludeLayer && rnIncludeLayer.checked) ? ((String(rnFolder).replace(/[\\/]+$/,'').split(/\\|\//).pop() || '') + '_') : '';
  const nameVal = (rnName && rnName.value ? rnName.value.trim() : 'Asset');
  const delimVal = (rnDelim && rnDelim.value ? rnDelim.value : '#');
  const weightVal = String(Math.max(1, Number(rnWeight && rnWeight.value || '1')));
  const newFileName = prefix + nameVal + delimVal + weightVal + ext;
  const srcPath = rnFolder.replace(/[\\/]+$/,'') + '/' + file;
  const dstPath = rnFolder.replace(/[\\/]+$/,'') + '/' + newFileName;
  const res = await window.foundry.renameFiles([{ from: srcPath, to: dstPath }]);
  if (!res.ok) { log(res.error || 'Rename failed'); return; }
  try {
    // Refresh listing to reflect any collision suffixes applied by backend
    const list = await window.foundry.listDir(rnFolder);
    if (list.ok && Array.isArray(list.items)) {
      rnFiles = (list.items || []).filter((n) => /\.(png|webp|gif)$/i.test(n));
    }
  } catch {}
  // Advance if possible; if at last image, stay on last
  rnIdx = Math.min(rnFiles.length - 1, rnIdx + 1);
  showCurrent();
});
rnRandomName && rnRandomName.addEventListener('click', () => {
  const list = irNameList ? irNameList.value.split(/\r?\n/).map((s)=>s.trim()).filter(Boolean) : [];
  if (list.length && rnName) rnName.value = pickRandom(list);
});
rnRandomWeight && rnRandomWeight.addEventListener('click', () => {
  const minVal = Math.max(1, irMin ? (Number(irMin.value) || 1) : 1);
  const maxVal = Math.max(minVal, irMax ? (Number(irMax.value) || minVal) : minVal);
  if (rnWeight) rnWeight.value = String(Math.floor(minVal + Math.random() * (maxVal - minVal + 1)));
});
if (btnSaveConfig) btnSaveConfig.addEventListener('click', async () => {
  if (!currentConfig) return;
  const updated = { ...currentConfig };
  updated.name = document.getElementById('cfg-name').value.trim() || currentConfig.name;
  updated.symbol = document.getElementById('cfg-symbol').value.trim();
  updated.editionSize = Number(document.getElementById('cfg-editions').value) || currentConfig.editionSize;
  updated.image = {
    width: Number(document.getElementById('cfg-image-w').value) || currentConfig.image.width,
    height: Number(document.getElementById('cfg-image-h').value) || currentConfig.image.height,
    background: document.getElementById('cfg-image-bg').value || currentConfig.image.background || 'transparent',
  };
  updated.rarity = {
    mode: 'filenameDelimiter',
    delimiter: document.getElementById('rarity-delim').value || '#',
    defaultWeight: Math.max(1, Number(document.getElementById('rarity-default').value) || 1),
  };
  const ignoreRaw = document.getElementById('uniq-ignore').value || '';
  updated.uniqueness = {
    hash: 'sha256',
    ignore: ignoreRaw.split(',').map(s => s.trim()).filter(Boolean),
  };
  updated.export = {
    outDir: document.getElementById('export-outdir').value || 'build',
    previewOutDir: (document.getElementById('export-preview-outdir').value || '').trim() || undefined,
    imageFormat: document.getElementById('export-format').value || 'png',
    includePreviewContactSheet: document.getElementById('export-contact').checked,
  };
  updated.layers = readLayersFromTable();
  const res = await window.foundry.writeConfig(updated);
  log(res.ok ? 'Config saved.' : (res.error || 'Failed to save config.'));
});
document.getElementById('btn-validate-rules').addEventListener('click', async () => {
  try {
    const txt = document.getElementById('rules-json').value;
    const parsed = JSON.parse(txt);
    if (!parsed || typeof parsed !== 'object') throw new Error('Rules must be an object');
    log('Rules JSON looks valid.');
  } catch (e) {
    log('Rules invalid: ' + (e?.message || e));
  }
});
document.getElementById('btn-save-rules').addEventListener('click', async () => {
  if (!currentConfig) return;
  try {
    const txt = document.getElementById('rules-json').value;
    const parsed = JSON.parse(txt);
    const updated = { ...currentConfig, rules: parsed };
    const res = await window.foundry.writeConfig(updated);
    if (res.ok) {
      currentConfig = updated;
      log('Rules saved.');
    } else {
      log(res.error || 'Failed to save rules');
    }
  } catch (e) {
    log('Rules invalid JSON: ' + (e?.message || e));
  }
});
document.getElementById('btn-open-rarity').addEventListener('click', async () => {
  try {
    const cfg = await window.foundry.readConfig();
    if (!cfg.ok) return log('Open a project first.');
    const outDir = (cfg.json.export?.outDir) || 'build';
    const res = await window.foundry.readFile(outDir + '/rarity.json');
    if (res.ok) {
      document.getElementById('rarity-out').textContent = res.content;
    } else {
      log(res.error || 'rarity.json not found. Build first.');
    }
  } catch (e) {
    log(String(e?.message || e));
  }
});
// Console toggle
const consoleCard = document.getElementById('console-card');
const btnToggleConsole = document.getElementById('btn-toggle-console');
if (btnToggleConsole && consoleCard) {
  btnToggleConsole.addEventListener('click', () => {
    const pre = consoleCard.querySelector('pre');
    const hidden = pre.style.display === 'none';
    pre.style.display = hidden ? 'block' : 'none';
    btnToggleConsole.textContent = hidden ? 'Hide' : 'Show';
  });
}

// Project label helpers
const projectLabel = document.getElementById('current-project-label');
const projectMini = document.getElementById('current-project-mini');
function setProjectLabels(dir) {
  const name = String(dir || '').replace(/[\\/]+$/, '').split(/\\|\//).pop() || 'No project';
  if (projectLabel) projectLabel.textContent = dir ? name : 'No project';
  if (projectMini) projectMini.textContent = dir || 'No project selected';
}
async function refreshProjectLabels() {
  const base = await window.foundry.getProjectDir();
  setProjectLabels(base && base.projectDir ? base.projectDir : '');
}
// Gallery interactions
previews.addEventListener('click', (e) => {
  const el = e.target.closest('.thumb');
  if (!el) return;
  const idx = Number(el.dataset.index || '0');
  openLightbox(idx);
});
lbClose.addEventListener('click', (e) => { e.stopPropagation(); closeLightbox(); });
lbPrev.addEventListener('click', (e) => { e.stopPropagation(); nav(-1); });
lbNext.addEventListener('click', (e) => { e.stopPropagation(); nav(1); });
// Guard against event bubbling closing the lightbox
;[lbImage, lbPrev, lbNext, lbClose].forEach((el) => {
  el.addEventListener('mousedown', (e) => e.stopPropagation());
  el.addEventListener('click', (e) => e.stopPropagation());
});
// Click outside to close disabled to avoid accidental closures on nav buttons
document.addEventListener('keydown', (e) => {
  if (!lightbox.classList.contains('open')) return;
  if (e.key === 'Escape') closeLightbox();
  if (e.key === 'ArrowLeft') nav(-1);
  if (e.key === 'ArrowRight') nav(1);
});

// Brand logo click: go to launcher view
const brandHome = document.getElementById('brand-home');
if (brandHome) {
  brandHome.addEventListener('click', () => {
    const viewLauncher = document.getElementById('view-launcher');
    const viewApp = document.getElementById('view-app');
    if (viewLauncher && viewApp) {
      viewLauncher.classList.remove('hidden');
      viewApp.classList.add('hidden');
    }
    // Clear active tab highlight when returning home
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  });
}

// Hover intent to keep brand popout open while moving mouse
(function setupBrandPopout() {
  const brand = document.getElementById('brand');
  const header = document.querySelector('header');
  const popout = brand ? brand.querySelector('.brand-popout') : null;
  const handle = null; // handle visually hidden in header redesign
  if (!brand || !popout || !header) return;
  let hideTimer = null;
  function position() {
    const b = brand.getBoundingClientRect();
    const h = header.getBoundingClientRect();
    const topBelowHeader = Math.round(h.bottom);
    const leftOfBrand = Math.round(b.left);
    if (handle) {
      handle.style.top = topBelowHeader + 'px';
      handle.style.left = leftOfBrand + 'px';
      handle.style.width = Math.min(Math.round(b.width), 200) + 'px';
    }
    popout.style.top = (topBelowHeader + 8) + 'px';
    popout.style.left = leftOfBrand + 'px';
  }
  function open() {
    position();
    popout.style.opacity = '1';
    popout.style.pointerEvents = 'auto';
    popout.style.transform = 'translateY(0)';
    if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
  }
  function scheduleClose() {
    if (hideTimer) clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      popout.style.opacity = '0';
      popout.style.pointerEvents = 'none';
      popout.style.transform = 'translateY(-4px)';
    }, 160);
  }
  ;[brand, popout].forEach(el => {
    if (!el) return;
    el.addEventListener('mouseenter', open);
    el.addEventListener('mouseleave', scheduleClose);
  });
  window.addEventListener('resize', position);
  window.addEventListener('scroll', position, { passive: true });
  position();
})();

// Also handle mouse wheel horizontally for navigation
lightbox.addEventListener('wheel', (e) => {
  if (!lightbox.classList.contains('open')) return;
  if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
    e.preventDefault();
    if (e.deltaX > 0) nav(1); else nav(-1);
  }
}, { passive: false });

bindLayerTableEvents();
document.getElementById('btn-choose').onclick = async () => {
  const res = await window.foundry.chooseProjectDir();
  log(res.ok ? ('Project: ' + res.projectDir) : res.error);
  if (res.ok) { addRecent(res.projectDir); await window.foundry.setProjectDir(res.projectDir); await loadConfigUI(); await refreshPreviews(); await refreshProjectLabels(); }
}
document.getElementById('btn-init').onclick = async () => {
  startProgress('Initializing project…', 4000);
  const res = await window.foundry.run(['init']);
  log(res.ok ? res.stdout : res.error);
  endProgress(res.ok ? 'Project initialized' : 'Init failed', res.ok);
  await loadConfigUI();
}
document.getElementById('btn-validate').onclick = async () => {
  startProgress('Validating rules…', 3000);
  const res = await window.foundry.run(['validate']);
  log(res.ok ? res.stdout : res.error);
  endProgress(res.ok ? 'Validation complete' : 'Validation failed', res.ok);
}
document.getElementById('btn-preview').onclick = async () => {
  const cRaw = document.getElementById('preview-count').value;
  const cNum = Math.max(1, Number(cRaw) || 9);
  // Randomize seed so previews differ every run
  const seed = 'run-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
  startProgress('Generating previews…', Math.min(60000, 500 * cNum + 2000));
  const res = await window.foundry.run(['preview', '--count', String(cNum), '--seed', seed]);
  log((res.ok ? res.stdout : res.error) + (res.ok ? ('\nSeed: ' + seed) : ''));
  endProgress(res.ok ? 'Previews generated' : 'Preview failed', res.ok);
  // Give the FS a moment to flush writes on Windows
  setTimeout(() => refreshPreviews(), 200);
}
document.getElementById('btn-build').onclick = async () => {
  const cRaw = document.getElementById('build-count').value;
  const cNum = Math.max(1, Number(cRaw) || 10);
  startProgress('Building collection…', Math.min(120000, 700 * cNum + 3000));
  const res = await window.foundry.run(['build', '--count', String(cNum)]);
  log(res.ok ? res.stdout : res.error);
  endProgress(res.ok ? 'Build complete' : 'Build failed', res.ok);
  refreshPreviews();
}
document.getElementById('btn-upload').onclick = async () => {
  const provider = document.getElementById('upload-provider').value;
  const conc = document.getElementById('upload-concurrency').value;
  startProgress('Uploading assets…', 20000);
  const res = await window.foundry.run(['upload', '--provider', String(provider), '--concurrency', String(conc)]);
  log(res.ok ? res.stdout : res.error);
  endProgress(res.ok ? 'Upload complete' : 'Upload failed', res.ok);
}
document.getElementById('btn-mint').onclick = async () => {
  const from = document.getElementById('mint-from').value;
  const countRaw = document.getElementById('mint-count').value;
  const countNum = Math.max(1, Number(countRaw) || 1);
  startProgress('Minting…', Math.min(180000, 5000 * countNum));
  const res = await window.foundry.run(['mint', '--from', String(from), '--count', String(countNum)]);
  log(res.ok ? res.stdout : res.error);
  endProgress(res.ok ? 'Mint complete' : 'Mint failed', res.ok);
}
// Open project folder
const btnOpenProject = document.getElementById('btn-open-project');
if (btnOpenProject) btnOpenProject.addEventListener('click', async () => {
  const base = await window.foundry.getProjectDir();
  if (base && base.projectDir) await window.foundry.openInExplorer(base.projectDir);
});
// Enhanced UI Options wiring
function applyUiFromStorage() {
  const theme = localStorage.getItem('ui:theme') || 'dark';
  const accent = localStorage.getItem('ui:accent') || '#6a8dff';
  const radius = Number(localStorage.getItem('ui:radius') || '14');
  const blur = Number(localStorage.getItem('ui:blur') || '12');

  const noise = Number(localStorage.getItem('ui:noise') || '0.03');
  const glow = Number(localStorage.getItem('ui:glow') || '0.3');
  
  document.documentElement.classList.toggle('theme-light', theme === 'light');
  
  // Update form controls
  document.getElementById('opt-theme') && (document.getElementById('opt-theme').value = theme);
  document.getElementById('opt-accent') && (document.getElementById('opt-accent').value = accent);
  document.getElementById('opt-radius') && (document.getElementById('opt-radius').value = String(radius));
  document.getElementById('opt-blur') && (document.getElementById('opt-blur').value = String(blur));
  document.getElementById('opt-noise') && (document.getElementById('opt-noise').value = String(noise));
  document.getElementById('opt-glow') && (document.getElementById('opt-glow').value = String(glow));
  
  // Apply CSS variables
  document.documentElement.style.setProperty('--accent', accent);
  const accent2 = accent === '#6a8dff' ? '#ff6adf' : '#6a8dff';
  document.documentElement.style.setProperty('--accent-2', accent2);
  document.documentElement.style.setProperty('--radius', radius + 'px');
  document.documentElement.style.setProperty('--radius-sm', Math.max(6, radius - 6) + 'px');
  document.documentElement.style.setProperty('--radius-lg', Math.min(28, radius + 6) + 'px');
  document.documentElement.style.setProperty('--radius-xl', Math.min(32, radius + 14) + 'px');
  document.documentElement.style.setProperty('--blur', blur + 'px');
  document.documentElement.style.setProperty('--blur-subtle', Math.max(2, blur - 6) + 'px');
  document.documentElement.style.setProperty('--blur-heavy', Math.min(24, blur + 8) + 'px');
  document.documentElement.style.setProperty('--noise-opacity', String(noise));
  document.documentElement.style.setProperty('--accent-glow', `0 0 ${20 * glow}px rgba(106,141,255,${glow})`);
  
  // Add floating class to eligible elements (excluding large windows) - always enabled
  // Apply to small elements only
  document.querySelectorAll('.proj-card, .sidebar-group, .thumb').forEach(el => {
    if (!el.classList.contains('floating')) el.classList.add('floating');
  });
  
  // Apply to gallery cards, but exclude large ones
  document.querySelectorAll('.gallery-card').forEach(el => {
    // Skip large gallery cards (main preview gallery, console, minting, and settings)
    const isMainPreviewGallery = el.querySelector('.gallery-grid') !== null;
    const isConsoleCard = el.id === 'console-card';
    const isLargeSettingsCard = el.querySelector('.gallery-header h3') && 
                               el.querySelector('.gallery-header h3').textContent === 'Customization';
    const isMintingCard = el.querySelector('.gallery-header h3') && 
                         el.querySelector('.gallery-header h3').textContent === 'Minting';
    
    // Only apply floating to small gallery cards (like stats cards)
    if (!isMainPreviewGallery && !isConsoleCard && !isLargeSettingsCard && !isMintingCard) {
      if (!el.classList.contains('floating')) el.classList.add('floating');
    }
  });
}
const optTheme = document.getElementById('opt-theme');
const optAccent = document.getElementById('opt-accent');
const optRadius = document.getElementById('opt-radius');
const optBlur = document.getElementById('opt-blur');
const optNoise = document.getElementById('opt-noise');
const optGlow = document.getElementById('opt-glow');
const optReset = document.getElementById('opt-reset');

optTheme && optTheme.addEventListener('change', (e) => { localStorage.setItem('ui:theme', e.target.value); applyUiFromStorage(); });
optAccent && optAccent.addEventListener('change', (e) => { localStorage.setItem('ui:accent', e.target.value); applyUiFromStorage(); });
optRadius && optRadius.addEventListener('input', (e) => { localStorage.setItem('ui:radius', e.target.value); applyUiFromStorage(); });
optBlur && optBlur.addEventListener('input', (e) => { localStorage.setItem('ui:blur', e.target.value); applyUiFromStorage(); });
optNoise && optNoise.addEventListener('input', (e) => { localStorage.setItem('ui:noise', e.target.value); applyUiFromStorage(); });
optGlow && optGlow.addEventListener('input', (e) => { localStorage.setItem('ui:glow', e.target.value); applyUiFromStorage(); });
optReset && optReset.addEventListener('click', () => { 
  localStorage.removeItem('ui:theme'); 
  localStorage.removeItem('ui:accent'); 
  localStorage.removeItem('ui:radius'); 
  localStorage.removeItem('ui:blur'); 
  localStorage.removeItem('ui:noise');
  localStorage.removeItem('ui:glow');
  applyUiFromStorage(); 
});

// Startup: decide view, render recents, load config if project set
(async function startup() {
  applyUiFromStorage();
  renderRecents();
  const base = await window.foundry.getProjectDir();
  if (base && base.projectDir) {
    showView('app');
    await loadConfigUI();
    await updateAssetCounts();
    await refreshPreviews();
    switchTab(localStorage.getItem('ui:lastTab') || 'main');
    switchSubtab(localStorage.getItem('ui:lastSubtab') || 'overview');
    await refreshProjectLabels();
    // Build help content and attach contextual help icons
    buildHelpPage();
    attachHelpAnchors();
  } else {
    showView('launcher');
  }
})();

// Populate stats from config
function updateStatsFromConfig(cfg) {
  const statCollection = document.getElementById('stat-collection');
  const statEditions = document.getElementById('stat-editions');
  const statDimensions = document.getElementById('stat-dimensions');
  const statLayers = document.getElementById('stat-layers');
  if (statCollection) statCollection.textContent = (cfg.name || '—') + (cfg.symbol ? ' (' + cfg.symbol + ')' : '');
  if (statEditions) statEditions.textContent = String(cfg.editionSize || '—');
  if (statDimensions) statDimensions.textContent = (cfg.image?.width && cfg.image?.height) ? (cfg.image.width + ' × ' + cfg.image.height) : '—';
  if (statLayers) statLayers.textContent = String((cfg.layers || []).length || 0);
}
// =====================
// Help System (4.0.0)
// =====================
const HELP_TOPICS = {
  'sidebar-mint': {
    title: 'Mint sidebar',
    short: 'Upload and mint controls overview.',
    body: `<p>Configure your upload provider and concurrency, then mint in batches. Use the main help for detailed provider setup.</p>`,
    related: ['upload-provider','upload','mint']
  },
  'sidebar-options': {
    title: 'Options sidebar',
    short: 'Customize theme, accent, radius, blur, noise, and glow.',
    body: `<p>These settings only affect the UI look and feel. Your choices are saved locally.</p>`,
    related: ['ui-theme','ui-accent']
  },
  'sidebar-project': {
    title: 'Sidebar: Project',
    short: 'Select, open, initialize, and validate your working folder.',
    body: `
      <p>Use this group to pick or switch your project directory, open it in your OS, and run common setup tasks.</p>
      <ul>
        <li><b>Choose</b>: Pick a folder to work in.</li>
        <li><b>Open Folder</b>: Opens the current project in your OS.</li>
        <li><b>Init</b>: Create starter config and folders.</li>
        <li><b>Validate</b>: Check config and assets for issues.</li>
      </ul>
    `,
    related: ['projects','init','validate']
  },
  'sidebar-generate': {
    title: 'Sidebar: Generate',
    short: 'Preview sample outputs while iterating on art and rules.',
    body: `
      <p>Set a <b>Preview Count</b> and click <b>Generate Previews</b> to render a small gallery. Use this to catch alignment issues or rule conflicts early.</p>
    `,
    related: ['preview','rules']
  },
  'sidebar-build': {
    title: 'Sidebar: Build',
    short: 'Produce the final collection artifacts.',
    body: `
      <p>Use <b>Build Collection</b> to render final images and metadata for your entire edition. Consider building in batches during development.</p>
    `,
    related: ['build','rarity-report']
  },
  'previews': {
    title: 'Previews panel',
    short: 'Shows your latest generated previews.',
    body: `
      <p>Use this panel to visually inspect recent previews. Click an item to open the lightbox and navigate with the arrows.</p>
    `,
    related: ['preview-grid','preview']
  },
  'preview-grid': {
    title: 'Previews grid',
    short: 'Grid of preview thumbnails.',
    body: `<p>The grid scales to your window size. Open the previews folder for raw files.</p>`
  },
  'config': {
    title: 'Project Config overview',
    short: 'Set collection metadata, image dimensions, and defaults.',
    body: `
      <ul>
        <li><b>Name / Symbol</b>: Project identifiers.</li>
        <li><b>Edition Size</b>: Total number of outputs.</li>
        <li><b>Image Background</b>: Color or 'transparent'.</li>
        <li><b>Width / Height</b>: Canvas size in pixels.</li>
      </ul>
    `
  },
  'config-rarity': {
    title: 'Rarity settings',
    short: 'Control filename parsing and default weights.',
    body: `
      <p>Set the filename delimiter used to parse weights (e.g., 'Trait#10.png'). Choose a default weight used when none is specified in filenames.</p>
    `
  },
  'config-dna': {
    title: 'Uniqueness (DNA)',
    short: 'Hash-based uniqueness with optional ignore list.',
    body: `
      <p>We compute a DNA hash for each combination of traits. Add trait types to <b>Ignore Traits</b> to allow duplicates that differ only by those traits.</p>
    `
  },
  'config-layers': {
    title: 'Layers table',
    short: 'Order, paths, strategies, and counts for each layer.',
    body: `
      <ul>
        <li><b>Order</b>: Draw order from top to bottom.</li>
        <li><b>Name</b>: Trait type (e.g., Background, Hat).</li>
        <li><b>Path</b>: Folder containing assets for the layer.</li>
        <li><b>Rarity</b>: Weighting strategy per layer.</li>
        <li><b>Required</b>: Whether this layer must appear.</li>
        <li><b>Blend / Opacity</b>: Composition settings.</li>
        <li><b>Assets</b>: Discovered count for quick sanity checks.</li>
      </ul>
    `,
    related: ['rules','rarity-report']
  },
  'config-renamer': {
    title: 'Image Renamer',
    short: 'Bulk/interactive rename and weight assignment.',
    body: `
      <p>Use bulk rename for patterns across many files, or open the step-through renamer for curated edits. Keep delimiter consistent with rarity settings.</p>
    `,
    related: ['renamer','config-rarity']
  },
  'projects': {
    title: 'Projects: selecting and switching',
    short: 'Pick a working directory to load and save your collection.',
    body: `
      <p>Open a project from the launcher or via the <b>Switch Project</b> button in the header. A project is any folder that contains a <code>foundry.config.json</code> file. All outputs (previews, builds, reports) are written inside this folder.</p>
      <ul>
        <li><b>Choose</b>: Select a folder to work in. If no config exists, you can initialize one.</li>
        <li><b>Open Folder</b>: Opens the current project in your OS file explorer.</li>
        <li><b>Recents</b>: The launcher lists folders you used recently.</li>
      </ul>
    `,
    related: ['init','config']
  },
  'init': {
    title: 'Init: create config and folders',
    short: 'Generate a starter foundry.config.json and scaffold directories.',
    body: `
      <p>Use <b>Init</b> to create a default <code>foundry.config.json</code> and recommended folders. Edit the config in the <b>Main → Configure</b> subtab to set name, edition size, image dimensions, and layers.</p>
      <ul>
        <li>Re-run Init safely; it won’t overwrite existing files.</li>
        <li>After editing the config, click <b>Validate</b> to check for issues.</li>
      </ul>
    `,
    related: ['validate','config']
  },
  'validate': {
    title: 'Validate: sanity-check configuration',
    short: 'Checks your config and files for common mistakes.',
    body: `
      <p><b>Validate</b> parses your config, verifies layer folders, and ensures required fields are present. Fix any reported issues before building.</p>
      <p>Validation also warns about improbable rarity distributions and missing assets.</p>
    `,
    related: ['rarity-report','rules']
  },
  'generate': {
    title: 'Generate & Build',
    short: 'Create images and metadata based on your rules.',
    body: `
      <p><b>Build</b> composes the collection using your layers, rules, and rarity weights. Outputs:</p>
      <ul>
        <li><code>outputs/images/</code>: Final images</li>
        <li><code>outputs/json/</code>: Metadata files</li>
        <li><code>reports/rarity.json</code>: Rarity statistics</li>
      </ul>
      <p>Use <b>Preview</b> for quick sample outputs while iterating on art and rules.</p>
    `,
    related: ['rarity-report','rules']
  },
  'preview': {
    title: 'Generate Previews',
    short: 'Quickly sample compositions before a full build.',
    body: `
      <p>Use <b>Generate Previews</b> to render a small set of images to validate layering, rules, and art alignment without committing to a full build.</p>
      <ul>
        <li>Adjust <b>Preview Count</b> to render more or fewer samples.</li>
        <li>Open the previews folder to inspect outputs at full size.</li>
      </ul>
    `,
    related: ['generate','rules']
  },
  'build': {
    title: 'Build Collection',
    short: 'Produce final images and metadata for the entire edition.',
    body: `
      <p><b>Build Collection</b> creates the complete set of images and JSON files using your configured layers, rarity weights, and rules.</p>
      <ul>
        <li>Run <b>Validate</b> first to catch configuration issues.</li>
        <li>Review the <b>Rarity Report</b> after building and iterate as needed.</li>
      </ul>
    `,
    related: ['rarity-report','upload']
  },
  'rules': {
    title: 'Rules & Export',
    short: 'Control trait compatibility, forced inclusions/exclusions, and file naming.',
    body: `
      <p>Define rules to prevent incompatible trait combos and to guide export naming formats. Rules are applied during <b>Build</b> and affect rarity distribution.</p>
      <ul>
        <li><b>Blocks</b>: Prevent two traits from appearing together.</li>
        <li><b>Requires</b>: If trait A is chosen, enforce trait B.</li>
        <li><b>Export</b>: Customize metadata fields and filenames.</li>
      </ul>
    `,
    related: ['rarity-report']
  },
  'rarity-report': {
    title: 'Rarity Report',
    short: 'Understand trait frequencies and collection rarity.',
    body: `
      <p>After a successful <b>Build</b>, open <code>reports/rarity.json</code> to inspect trait counts and probabilities. Use this to balance your collection before mint.</p>
      <ul>
        <li>Rebuild after changing weights or rules to update the report.</li>
        <li>Use the Renamer to normalize inconsistent trait names.</li>
      </ul>
    `,
    related: ['generate','renamer']
  },
  'renamer': {
    title: 'Step-through Renamer',
    short: 'Batch rename assets and set weights interactively.',
    body: `
      <p>The Renamer lets you step through images, update base names, adjust rarity weight, and include layer prefixes. Apply changes and continue to the next item.</p>
      <ul>
        <li><b>Random Name</b> and <b>Random Weight</b> options help explore alternatives.</li>
        <li>Use <b>Delimiter</b> to control how traits are parsed from filenames.</li>
      </ul>
    `,
    related: ['rarity-report']
  },
  'upload-provider': {
    title: 'Upload Provider',
    short: 'Choose where to host your images and metadata.',
    body: `
      <p>Select <b>Arweave</b> or <b>IPFS</b> to upload build outputs. Provider settings may require environment credentials or a funded wallet (for Arweave Bundlr).</p>
    `,
    related: ['upload','mint']
  },
  'upload-concurrency': {
    title: 'Upload Concurrency',
    short: 'Number of parallel uploads.',
    body: `<p>Higher values speed up uploads but may hit rate limits. Start with 4–8 and adjust based on your network and provider stability.</p>`,
    related: ['upload']
  },
  'upload': {
    title: 'Upload',
    short: 'Send outputs/images and outputs/json to your provider.',
    body: `<p>Uploads the built assets. Ensure you have run <b>Build</b> and reviewed the <b>Rarity Report</b> first.</p>`,
    related: ['generate','mint']
  },
  'mint-from': {
    title: 'Mint From',
    short: 'First token index to mint.',
    body: `<p>Controls the starting index for minting. Use to mint in batches or resume after an interruption.</p>`,
    related: ['mint']
  },
  'mint-count': {
    title: 'Mint Count',
    short: 'How many tokens to mint in one action.',
    body: `<p>Mint in small batches to monitor network fees and success. Combine with <b>Mint From</b> to continue across ranges.</p>`,
    related: ['mint']
  },
  'mint': {
    title: 'Mint',
    short: 'Creates tokens on-chain using your uploaded assets.',
    body: `<p>After successful upload, mint tokens using your chain’s tooling. Configure chain settings in your environment; the UI will expand with chain-specific controls in future versions.</p>`,
    related: ['upload']
  },
  'ui-theme': {
    title: 'Theme',
    short: 'Switch between dark and light modes.',
    body: `<p>Use <b>Options</b> → <b>Theme</b> to toggle. Your choice is saved locally.</p>`,
    related: ['ui-accent']
  },
  'ui-accent': {
    title: 'Accent',
    short: 'Primary highlight colors used across the UI.',
    body: `<p>Pick an accent pair to suit your style. This affects buttons, focus states, and glows.</p>`,
    related: ['ui-theme']
  },
  'ui-radius': {
    title: 'Corner Radius',
    short: 'Adjust rounded corners for panels and controls.',
    body: `<p>Personal preference only; does not impact generated art.</p>`
  },
  'ui-blur': {
    title: 'Glass Blur',
    short: 'Controls background blur intensity.',
    body: `<p>Higher blur increases depth at the cost of GPU usage.</p>`
  },
  'ui-noise': {
    title: 'Background Noise',
    short: 'Subtle texture across the UI background.',
    body: `<p>Use to taste; set to 0 for absolute clean look.</p>`
  },
  'ui-glow': {
    title: 'Glow Intensity',
    short: 'Accent glow around interactive elements.',
    body: `<p>Lower values reduce visual emphasis; higher increases vibrancy.</p>`
  },
  'shortcuts': {
    title: 'Keyboard Shortcuts',
    short: 'Speed up common tasks.',
    body: `
      <ul>
        <li><b>Ctrl/Cmd + O</b>: Switch Project</li>
        <li><b>Ctrl/Cmd + B</b>: Build</li>
        <li><b>Ctrl/Cmd + P</b>: Preview</li>
        <li><b>Ctrl/Cmd + ,</b>: Options</li>
      </ul>
    `
  },
  'troubleshooting': {
    title: 'Troubleshooting',
    short: 'Common issues and fixes.',
    body: `
      <ul>
        <li><b>Build fails</b>: Run <b>Validate</b>, check missing layers, fix rule conflicts.</li>
        <li><b>Uploads stall</b>: Lower <b>Concurrency</b>, check provider status/network.</li>
        <li><b>Wrong rarity</b>: Adjust weights or rules, then rebuild and review the report.</li>
      </ul>
    `
  },
  'glossary': {
    title: 'Glossary',
    short: 'Terms used throughout the app.',
    body: `
      <ul>
        <li><b>Edition</b>: Total number of tokens/images to generate.</li>
        <li><b>Layer</b>: A visual stack level (e.g., Background, Body, Eyes).</li>
        <li><b>Trait</b>: A concrete option within a layer (e.g., Eyes: Laser).</li>
        <li><b>Weight</b>: Probability bias for choosing a trait.</li>
        <li><b>DNA</b>: A hash representing a unique combo of chosen traits.</li>
        <li><b>Rule</b>: Constraint that limits which trait combos are allowed.</li>
        <li><b>Preview</b>: A quick render of sample editions for iteration.</li>
        <li><b>Build</b>: Full render of all editions plus metadata and reports.</li>
      </ul>
    `
  },
  'launcher': {
    title: 'Launcher',
    short: 'Open, create, and manage recent projects.',
    body: `
      <p>Start on the Launcher to select a working folder. The app remembers recents and shows a quick grid.</p>
      <ul>
        <li><b>Browse…</b>: Pick an existing folder. If it lacks a config, you can <b>Init</b> later.</li>
        <li><b>Create or add project</b>: Shortcut to pick a folder and initialize a project.</li>
        <li><b>Recents</b>: Hover a card to <b>Open</b> or <b>Remove</b> it from the list.</li>
      </ul>
      <p>Projects are just folders containing a <code>foundry.config.json</code>.</p>
    `
  },
  'file-structure': {
    title: 'Recommended project structure',
    short: 'Where configs, layers, outputs, and reports live.',
    body: `
      <p>Keep a clean layout for predictable builds and easier collaboration.</p>
      <pre><code>project/
  foundry.config.json
  layers/
    Background/
Blue.png
Red.png
    Body/
Robot#5.png
Human#10.png
    Eyes/
Laser#1.png
Calm#8.png
  outputs/
    images/
    json/
  reports/
    rarity.json
      </code></pre>
      <ul>
        <li>Layer subfolders can be named freely; ensure <b>Path</b> in the Layers table points to each.</li>
        <li>Use rarity weights in filenames (e.g., <code>Trait#10.png</code>) or set <b>Default Weight</b>.</li>
      </ul>
    `
  },
  'layers-actions': {
    title: 'Layers: Actions',
    short: 'Manage layer folders and entries.',
    body: `
      <ul>
        <li><b>Refresh Counts</b>: Re-scan layer folders to update <b>Assets</b> column.</li>
        <li><b>Create Folders</b>: Make missing layer directories based on the table.</li>
        <li><b>Add Layer</b>: Append a new row; set <b>Name</b>, <b>Path</b>, and strategy.</li>
        <li><b>Save Config</b>: Persist all changes to <code>foundry.config.json</code>.</li>
      </ul>
      <p>Tip: Keep layer names stable to avoid breaking trait statistics across builds.</p>
    `
  },
  'console': {
    title: 'Console',
    short: 'View logs, validation results, and task status.',
    body: `
      <p>The Console shows output from operations like <b>Validate</b>, <b>Preview</b>, and <b>Build</b>.</p>
      <ul>
        <li>Toggle visibility with the button in the <b>Overview</b> card.</li>
        <li>Copy text by selecting it directly in the console panel.</li>
      </ul>
    `
  },
  'lightbox': {
    title: 'Preview Lightbox',
    short: 'Inspect previews at full size.',
    body: `
      <p>Click a preview to open the lightbox.</p>
      <ul>
        <li>Use on-screen arrows to navigate between images.</li>
        <li>Close with the <b>✕</b> button.</li>
      </ul>
    `
  },
  'outputs': {
    title: 'Output files & folders',
    short: 'Where images, metadata, and reports are written.',
    body: `
      <ul>
        <li><code>outputs/images/</code>: Final rendered images.</li>
        <li><code>outputs/json/</code>: Off-chain metadata files.</li>
        <li><code>reports/rarity.json</code>: Collection rarity statistics.</li>
      </ul>
      <p>Customize paths via <b>Export</b> settings (<code>export.outDir</code>, <code>export.previewOutDir</code>).</p>
    `
  },
  'storage-config': {
    title: 'Storage configuration',
    short: 'Configure Arweave or IPFS credentials in the config file.',
    body: `
      <p>Set storage provider and credentials in <code>foundry.config.json</code> under <code>storage</code>:</p>
      <pre><code>"storage": {
  "provider": "arweave", // or "ipfs"
  "arweave": { "bundlrNode": "https://node.bundlr.network", "currency": "SOL", "keyPath": "C:/path/key.json" },
  "ipfs": { "pinataKey": "...", "pinataSecret": "...", "nftStorageKey": "..." }
}</code></pre>
      <p>These are used by the Upload flow. Keep secrets outside of version control.</p>
    `
  },
  'chain-config': {
    title: 'Solana chain configuration',
    short: 'Set cluster, wallet, fees, and creators.',
    body: `
      <p>Configure chain details under <code>chain.solana</code>:</p>
      <pre><code>"chain": {
  "target": "solana",
  "solana": {
    "cluster": "devnet",
    "rpcUrl": "https://api.devnet.solana.com",
    "walletKeypairPath": "C:/path/keypair.json",
    "sellerFeeBasisPoints": 500,
    "creators": [ { "address": "...", "share": 100 } ],
    "collection": { "mint": null },
    "isMutable": true,
    "usePnft": true
  }
}</code></pre>
      <p>These values influence minting and on-chain metadata.</p>
    `
  },
  'metadata-json': {
    title: 'Metadata JSON (Solana)',
    short: 'Fields produced for each edition.',
    body: `
      <p>The builder outputs Metaplex-compatible JSON for each token.</p>
      <pre><code>{
  "name": "Name #1",
  "symbol": "SYMB",
  "description": "...",
  "image": "ar://.../1.png",
  "attributes": [ { "trait_type": "Eyes", "value": "Laser" } ],
  "properties": {
    "files": [ { "uri": "ar://.../1.png", "type": "image/png" } ],
    "category": "image"
  },
  "animation_url": "ar://.../1.mp4" // optional
}</code></pre>
      <p>The exact shape is produced by the active chain adapter.</p>
    `
  },
  'renamer-step': {
    title: 'Step-through Renamer tips',
    short: 'Efficiently curate names and weights.',
    body: `
      <ul>
        <li>Set <b>Delimiter</b> to match your rarity scheme (e.g., <code>#</code>).</li>
        <li>Use <b>Include layer prefix</b> for disambiguation (e.g., <code>Hat_Golden</code>).</li>
        <li><b>Apply & Next</b> saves changes and advances to the next asset.</li>
        <li>Random helpers are great for brainstorming naming sets.</li>
      </ul>
    `
  },
  'rules-examples': {
    title: 'Rules: examples',
    short: 'Common patterns for blocking and requiring traits.',
    body: `
      <pre><code>{
  "mutuallyExclusive": [["Eyes:Laser", "Headwear:Visor"]],
  "requires": [ { "if": "Background:Night", "thenAnyOf": ["Eyes:Glow", "Eyes:Laser"] } ],
  "maxOccurrences": [ { "trait": "Eyes:Laser", "max": 50 } ]
}</code></pre>
      <p>Keep trait strings in the form <code>Layer:Value</code>. Use <b>Validate Rules</b> to check for mistakes.</p>
    `
  }
};

const HELP_ORDER = [
  { id: 'getting-started', title: 'Getting Started', topics: ['launcher','projects','file-structure','init','validate'] },
  { id: 'ui-overview', title: 'Main Interface', topics: ['sidebar-project','sidebar-generate','sidebar-build','previews','preview-grid','lightbox','console'] },
  { id: 'config', title: 'Configuration', topics: ['config','config-rarity','config-dna','config-layers','layers-actions','config-renamer'] },
  { id: 'building', title: 'Build & Outputs', topics: ['preview','generate','build','rules','rules-examples','rarity-report','outputs'] },
  { id: 'renamer', title: 'Renamer', topics: ['renamer','renamer-step'] },
  { id: 'minting', title: 'Upload, Storage & Chain', topics: ['upload-provider','upload-concurrency','upload','mint-from','mint-count','mint','storage-config','chain-config','metadata-json'] },
  { id: 'ui', title: 'UI Options', topics: ['ui-theme','ui-accent','ui-radius','ui-blur','ui-noise','ui-glow'] },
  { id: 'productivity', title: 'Productivity', topics: ['shortcuts'] },
  { id: 'support', title: 'Troubleshooting & Glossary', topics: ['troubleshooting','glossary'] },
];

// Preferred help targets: when opening full help from a popover,
// jump to a more comprehensive article instead of the brief overview.
const HELP_JUMP_MAP = {
  'config-renamer': 'renamer-step',
  'renamer': 'renamer-step',
  'rules': 'rules-examples',
};

function buildHelpPage() {
  const toc = document.getElementById('help-toc');
  const container = document.getElementById('help-content');
  if (!toc || !container) return;
  toc.innerHTML = '';
  container.innerHTML = '';
  for (const section of HELP_ORDER) {
    const secLink = document.createElement('a');
    secLink.href = `#${section.id}`;
    secLink.textContent = section.title;
    toc.appendChild(secLink);

    const sec = document.createElement('section');
    sec.id = section.id;
    const h2 = document.createElement('h2');
    h2.textContent = section.title;
    sec.appendChild(h2);
    for (const t of section.topics) {
      const topic = HELP_TOPICS[t];
      if (!topic) continue;
      const art = document.createElement('article');
      art.id = `topic-${t}`;
      const h3 = document.createElement('h3');
      h3.textContent = topic.title;
      const p = document.createElement('p');
      p.style.opacity = '.9';
      p.textContent = topic.short;
      const body = document.createElement('div');
      body.innerHTML = topic.body;
      const jump = document.createElement('p');
      jump.innerHTML = `<a class=\"badge-link\" href=\"#\" data-help-jump=\"${t}\">Open context help</a>`;
      art.appendChild(h3);
      art.appendChild(p);
      art.appendChild(body);
      art.appendChild(jump);
      sec.appendChild(art);
    }
    container.appendChild(sec);
  }

  // Hook up context jumps
  container.querySelectorAll('[data-help-jump]').forEach((a) => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      const target = e.currentTarget;
      const topicId = target && target.getAttribute ? target.getAttribute('data-help-jump') : '';
      showHelpPopover(topicId || '', null);
    });
  });
}

let helpOverlayEl = null;
let helpPopoverEl = null;
function ensureHelpElements() {
  if (!helpOverlayEl) {
    helpOverlayEl = document.createElement('div');
    helpOverlayEl.className = 'help-overlay';
    helpOverlayEl.addEventListener('click', hideHelpPopover);
  }
  if (!helpPopoverEl) {
    helpPopoverEl = document.createElement('div');
    helpPopoverEl.className = 'help-popover';
  }
}

function attachHelpAnchors() {
  // Clear any previously attached icons so we can reflow placement
  document.querySelectorAll('.help-icon').forEach((n) => n.remove());
  document.querySelectorAll('[data-help].helpable').forEach((n) => n.classList.remove('helpable'));

  const anchors = Array.from(document.querySelectorAll('[data-help]'));
  anchors.forEach((el) => {
    if (el.classList.contains('helpable')) return;
    el.classList.add('helpable');
    const btn = document.createElement('span');
    btn.className = 'help-icon';
    btn.setAttribute('role', 'button');
    btn.setAttribute('tabindex', '0');
    // Prefer PNG then JPG; fallback to ? if both fail
    const setImg = (src) => {
      const im = new Image();
      im.onload = () => { btn.setAttribute('data-img', '1'); btn.appendChild(im); };
      im.onerror = () => { btn.setAttribute('data-fallback', '1'); };
      im.src = src;
    };
    const probePng = new Image();
    probePng.onload = () => setImg('assets/helpicon.png');
    probePng.onerror = () => setImg('assets/helpicon.jpg');
    probePng.src = 'assets/helpicon.png';
    btn.title = 'Help';
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const topic = el.getAttribute('data-help') || '';
      showHelpPopover(topic, btn);
    });
    btn.addEventListener('keydown', (e) => {
      const key = e && (e.key || e.code);
      if (key === 'Enter' || key === ' ') {
        e.preventDefault();
        const topic = el.getAttribute('data-help') || '';
        showHelpPopover(topic, btn);
      }
    });
    // Placement rules:
    // - If element is a fieldset, attach to its legend (top label)
    // - If element is a legend/title/header (h1–h4 or .group-title), append inside next to text
    // - If element is a .gallery-header container, attach to its h3 if available
    // - If element is a sidebar container, attach to first .group-title only
    // - Skip buttons entirely
    const tag = (el.tagName || '').toLowerCase();
    const isButtonish = tag === 'button' || el.classList.contains('btn-primary') || el.classList.contains('btn-secondary') || el.classList.contains('btn-ghost');
    if (isButtonish) return;
    if (tag === 'fieldset') {
      const lg = el.querySelector('legend');
      if (lg) {
        if (!lg.classList.contains('helpable')) lg.classList.add('helpable');
        lg.appendChild(btn);
        return;
      }
    }
    if (tag === 'legend' || tag === 'h1' || tag === 'h2' || tag === 'h3' || tag === 'h4' || el.classList.contains('group-title')) {
      el.appendChild(btn);
      return;
    }
    if (el.classList.contains('gallery-header')) {
      const head = el.querySelector('h1,h2,h3,h4,.title');
      if (head) {
        if (!head.classList.contains('helpable')) head.classList.add('helpable');
        head.appendChild(btn);
      } else {
        el.appendChild(btn);
      }
      return;
    }
    if (el.classList.contains('sidebar')) {
      const firstTitle = el.querySelector('.group-title');
      if (firstTitle) {
        if (!firstTitle.classList.contains('helpable')) firstTitle.classList.add('helpable');
        firstTitle.appendChild(btn);
      }
      return;
    }
    // Default: append inside
    el.appendChild(btn);
  });
}

// FAL AI generation
const falKeyEl = document.getElementById('fal-key');
const falPromptEl = document.getElementById('fal-prompt');
const falGenerateBtn = document.getElementById('fal-generate');
const falStatusEl = document.getElementById('fal-status');
const falModelEl = document.getElementById('fal-model');
const falWidthEl = document.getElementById('fal-width');
const falHeightEl = document.getElementById('fal-height');
const falCountEl = document.getElementById('fal-count');
const falResultsEl = document.getElementById('fal-results');
const falSavedEl = document.getElementById('fal-saved');
const falOpenFolderBtn = document.getElementById('fal-open-folder');

if (falKeyEl) {
  try { falKeyEl.value = localStorage.getItem('fal:key') || ''; } catch {}
}

async function loadFalSaved() {
  const list = await window.foundry.listFiles('fal');
  const proj = await window.foundry.getProjectDir();
  if (!list.ok || !proj.ok) return;
  falSavedEl.innerHTML = '';
  const base = proj.projectDir.replace(/\\/g, '/');
  (list.files || []).forEach((name) => {
    const img = document.createElement('img');
    img.src = `file://${base}/fal/${name}`;
    const wrap = document.createElement('div');
    wrap.className = 'gallery-item';
    wrap.appendChild(img);
    falSavedEl.appendChild(wrap);
  });
}
loadFalSaved();

if (falOpenFolderBtn) {
  falOpenFolderBtn.addEventListener('click', () => {
    window.foundry.openInExplorer('fal');
  });
}

if (falGenerateBtn) {
  falGenerateBtn.addEventListener('click', async () => {
    const key = (falKeyEl.value || '').trim();
    const prompt = (falPromptEl.value || '').trim();
    const model = (falModelEl.value || '').trim();
    const w = parseInt(falWidthEl.value, 10) || 512;
    const h = parseInt(falHeightEl.value, 10) || 512;
    const count = parseInt(falCountEl.value, 10) || 1;
    falStatusEl.textContent = 'Generating...';
    falResultsEl.innerHTML = '';
    try {
      const resp = await fetch(`https://api.fal.ai/${model}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Key ${key}`,
        },
        body: JSON.stringify({ prompt, image_size: `${w}x${h}`, num_images: count }),
      });
      const data = await resp.json();
      const images = [];
      if (Array.isArray(data.images)) {
        data.images.forEach((im) => {
          if (im.url) images.push(im.url);
          else if (im.b64_json) images.push(`data:image/png;base64,${im.b64_json}`);
        });
      } else if (data.image_base64) {
        images.push(`data:image/png;base64,${data.image_base64}`);
      }
      if (!images.length) { falStatusEl.textContent = 'No image returned'; return; }
      falStatusEl.textContent = '';
      images.forEach((src, idx) => {
        const wrap = document.createElement('div');
        wrap.className = 'gallery-item';
        const imgEl = document.createElement('img');
        imgEl.src = src;
        const saveBtn = document.createElement('button');
        saveBtn.textContent = 'Save';
        saveBtn.className = 'btn-ghost';
        saveBtn.addEventListener('click', async () => {
          let b64;
          if (src.startsWith('data:')) {
            b64 = src.split(',')[1];
          } else {
            const buf = await fetch(src).then(r => r.arrayBuffer());
            let binary = '';
            const bytes = new Uint8Array(buf);
            for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
            b64 = btoa(binary);
          }
          const name = `${model.replace(/\//g, '-')}-${Date.now()}-${idx + 1}.png`;
          await window.foundry.saveBase64(b64, `fal/${name}`);
          loadFalSaved();
        });
        wrap.appendChild(imgEl);
        wrap.appendChild(saveBtn);
        falResultsEl.appendChild(wrap);
      });
      try { localStorage.setItem('fal:key', key); } catch {}
    } catch (err) {
      falStatusEl.textContent = 'Error: ' + err;
    }
  });
}

function hideHelpPopover() {
  if (helpPopoverEl && helpPopoverEl.parentElement) helpPopoverEl.remove();
  if (helpOverlayEl && helpOverlayEl.parentElement) helpOverlayEl.remove();
}

function showHelpPopover(topicId, anchorEl) {
  ensureHelpElements();
  const topic = HELP_TOPICS[topicId];
  if (!topic) return;
  helpPopoverEl.innerHTML = '';
  const title = document.createElement('div');
  title.className = 'hp-title';
  title.textContent = topic.title;
  const body = document.createElement('div');
  body.className = 'hp-body';
  body.innerHTML = `<p style=\"margin-top:0;\">${topic.short}</p>${topic.body}`;
  const actions = document.createElement('div');
  actions.className = 'hp-actions';
  const open = document.createElement('button');
  open.className = 'hp-link';
  open.textContent = (HELP_JUMP_MAP[topicId] ? 'Read detailed guide' : 'Open full help');
  open.addEventListener('click', () => {
    switchTab('help');
    const preferred = HELP_JUMP_MAP[topicId] || topicId;
    const id = `topic-${preferred}`;
    const el = document.getElementById(id);
    if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    hideHelpPopover();
  });
  const close = document.createElement('button');
  close.className = 'hp-link';
  close.textContent = 'Close';
  close.addEventListener('click', hideHelpPopover);
  actions.appendChild(open);
  actions.appendChild(close);
  helpPopoverEl.appendChild(title);
  helpPopoverEl.appendChild(body);
  helpPopoverEl.appendChild(actions);

  document.body.appendChild(helpOverlayEl);
  document.body.appendChild(helpPopoverEl);
  helpOverlayEl.style.pointerEvents = 'auto';
  helpPopoverEl.style.pointerEvents = 'auto';

  // Position
  let x = 24, y = 24; // default fallback
  if (anchorEl) {
    const r = anchorEl.getBoundingClientRect();
    const margin = 8;
    const desiredWidth = 360;
    // Prefer right of anchor; clamp within viewport
    x = Math.min(Math.max(12, r.right + margin), Math.max(12, window.innerWidth - desiredWidth - 12));
    y = Math.max(12, Math.min(window.innerHeight - 24, r.top));
  }
  helpPopoverEl.style.left = `${x}px`;
  helpPopoverEl.style.top = `${y}px`;

  // UX: close on Esc and reposition on resize
  const keyHandler = (ev) => { if ((ev.key || ev.code) === 'Escape') { hideHelpPopover(); window.removeEventListener('keydown', keyHandler); window.removeEventListener('resize', resizeHandler); } };
  const resizeHandler = () => {
    if (!helpPopoverEl || !helpPopoverEl.parentElement) return;
    if (!anchorEl) return;
    const r = anchorEl.getBoundingClientRect();
    const desiredWidth = 360;
    let nx = Math.min(Math.max(12, r.right + 8), Math.max(12, window.innerWidth - desiredWidth - 12));
    let ny = Math.max(12, Math.min(window.innerHeight - 24, r.top));
    helpPopoverEl.style.left = `${nx}px`;
    helpPopoverEl.style.top = `${ny}px`;
  };
  window.addEventListener('keydown', keyHandler, { once: true });
  window.addEventListener('resize', resizeHandler);
}
