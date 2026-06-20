// Visual-assessment harness (V1-0).
//
// Renders the built renderer-next in a headless browser with a mocked window.foundry (sample
// project + canvas-generated art), drives the nav reliably, and captures every screen + key state
// to packages/ui/screenshots/*.png — so UI changes can be SEEN, not just trusted. It also emits:
//   • screenshots/manifest.json  — every shot with its group, theme, viewport, and a critique note.
//   • screenshots/index.html     — a browsable contact sheet (open it to flip through every screen).
//
// Coverage = all pipeline + utility stages (incl. Launch, in both not-deployed and deployed
// states), the key in-screen interactions, a full LIGHT-theme pass (the token layer must hold in
// both themes), and a COMPACT-viewport pass (to expose density/overflow at a smaller window).
//
// Uses playwright-core driving the system Edge/Chrome (no browser download).
// Run: pnpm -C packages/ui build:renderer-next && pnpm -C packages/ui screenshots
import { chromium } from 'playwright-core';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const pkgRoot = path.resolve(here, '..');
const distDir = path.join(pkgRoot, 'dist', 'renderer-next');
const outDir = path.join(pkgRoot, 'screenshots');

if (!fs.existsSync(path.join(distDir, 'index.html'))) {
  console.error('dist/renderer-next not built — run: pnpm -C packages/ui build:renderer-next');
  process.exit(1);
}
fs.mkdirSync(outDir, { recursive: true });

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.map': 'application/json',
};

const server = http.createServer((req, res) => {
  try {
    const rel = decodeURIComponent((req.url || '/').split('?')[0]).replace(/^\/+/, '') || 'index.html';
    let file = path.join(distDir, rel);
    if (!file.startsWith(distDir) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      file = path.join(distDir, 'index.html');
    }
    res.setHeader('Content-Type', MIME[path.extname(file).toLowerCase()] || 'application/octet-stream');
    fs.createReadStream(file).pipe(res);
  } catch {
    res.statusCode = 500;
    res.end('err');
  }
});

// Runs in the page: a mock bridge + canvas-generated PNG art so screens populate.
//   opts.realPacks  (id → base64) carries the actual bundled pack/back PNGs so the Mint FX rip
//                   renders the genuine transparent torn-open art (not a flat color stand-in).
//   opts.deployed   when true, the Launch screen reports a live deployed contract (so the deployed
//                   state — sale setup, allowlist, reveal, proceeds — renders instead of "Deploy".
function installMock(opts) {
  const realPacks = (opts && opts.realPacks) || {};
  const deployed = !!(opts && opts.deployed);
  const mkPng = (color, w, h) => {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d');
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(0, 0, w, Math.round(h * 0.18));
    return c.toDataURL('image/png').split(',')[1];
  };
  const colors = ['#c0392b', '#2980b9', '#27ae60', '#8e44ad', '#d35400', '#16a085'];
  const previews = colors.map((c) => mkPng(c, 240, 336));
  const palette = colors.map((c) => mkPng(c, 200, 200));
  const hash = (s) => [...String(s)].reduce((a, c) => a + c.charCodeAt(0), 0);
  const ADDR = '0x1F4B2C9a7E3d6A8b0C5d9E2f1A3b4C5d6E7f8A9b';
  const CONFIG = {
    name: 'Demo Collection',
    symbol: 'DEMO',
    description: 'A sample generative drop.',
    editionSize: 1000,
    image: { width: 1024, height: 1024, background: 'transparent' },
    layers: [
      { name: 'Background', path: 'layers/background', rarity: 'filename', required: true, opacity: 1 },
      { name: 'Body', path: 'layers/body', rarity: 'filename', required: true },
      { name: 'Eyes', path: 'layers/eyes', rarity: 'filename', required: true },
      { name: 'Headwear', path: 'layers/headwear', rarity: 'filename', required: false },
    ],
    rarity: { delimiter: '#', defaultWeight: 1 },
    rules: { maxOccurrences: [{ trait: 'Headwear:Crown', max: 10 }] },
    mintExperience: {
      kind: 'cardPack',
      packCount: 3,
      label: 'DEMO PACK',
      shake: true,
      autoFlip: false,
      packId: 'conkerco-default',
      backId: 'conkerco-back-chrome',
      rarityBacks: [{ tier: 'Rare', backId: 'conkerco-back-eye' }],
    },
    export: { outDir: 'build', imageFormat: 'png' },
    storage: { provider: 'pinata' },
    chain: {
      target: 'evm',
      evm: {
        chainId: 84532,
        rpcUrl: 'https://sepolia.base.org',
        maxSupply: 1000,
        royaltyReceiver: ADDR,
        royaltyBps: 500,
        launch: { treasury: ADDR, placeholderUri: 'ipfs://bafyhidden/hidden.json' },
      },
    },
  };
  const ok = (x) => Promise.resolve(Object.assign({ ok: true }, x || {}));
  const launchStatus = deployed
    ? {
        configured: true,
        chainId: 84532,
        testnet: true,
        contractAddress: ADDR,
        phase: 'allowlist',
        configLocked: false,
        totalMinted: '128',
        maxSupply: '1000',
        allowlistPriceEth: '0.005',
        publicPriceEth: '0.01',
        publicWalletCap: '5',
        maxPerTx: '3',
        revealed: false,
        metadataFrozen: false,
        treasury: ADDR,
        owner: ADDR,
      }
    : {
        configured: false,
        chainId: 84532,
        testnet: true,
        phase: 'closed',
        configLocked: false,
        totalMinted: '0',
        maxSupply: '1000',
        allowlistPriceEth: '0',
        publicPriceEth: '0',
        publicWalletCap: '0',
        maxPerTx: '0',
        revealed: false,
        metadataFrozen: false,
        treasury: ADDR,
        owner: ADDR,
      };
  window.foundry = {
    getProjectDir: () => ok({ projectDir: 'C:/demo/collection' }),
    setProjectDir: () => ok({ projectDir: 'C:/demo/collection' }),
    chooseProjectDir: () => ok({ projectDir: 'C:/demo/collection' }),
    readConfig: () => ok({ json: CONFIG }),
    readConfigAt: () => Promise.resolve({ ok: false }), // empty folder → New project can scaffold
    writeConfig: () => ok(),
    saveJson: () => ok(),
    saveBase64: () => ok(),
    // Path-aware so Publish readiness (manifest) + Build rarity report populate.
    readFile: (rel = '') => {
      const s = String(rel);
      if (s.includes('upload-manifest')) {
        return ok({ content: JSON.stringify({ provider: 'pinata', mode: 'dir', baseUri: 'ipfs://bafybeigdyrexamplecid/', files: Array.from({ length: 12 }) }) });
      }
      if (s.includes('rarity.json')) {
        return ok({
          content: JSON.stringify({
            editionCount: 12,
            traitCounts: { Background: { Gold: 6, Silver: 4, Bronze: 2 }, Headwear: { None: 11, Crown: 1 } },
          }),
        });
      }
      return ok({ content: '{}' });
    },
    // Return a varied color per requested path so galleries/thumbnails aren't all identical.
    readFileBase64: (rel = '') => ok({ base64: palette[hash(rel) % palette.length], mime: 'image/png' }),
    listImages: () => ok({ count: 8 }),
    // Path-aware: layer folders → rarity-distribution sample; the build images dir → editions.
    listDir: (p = '') => {
      const s = String(p);
      if (s.includes('images')) {
        return ok({ items: Array.from({ length: 12 }, (_, i) => `${i + 1}.png`) });
      }
      if (s.includes('json')) {
        return ok({ items: Array.from({ length: 12 }, (_, i) => `${i + 1}.json`) });
      }
      const sets = {
        background: ['Gold#5.png', 'Silver#3.png', 'Bronze#1.png'],
        body: ['Common#80.png', 'Uncommon#15.png', 'Rare#4.png', 'Legendary#1.png'],
        eyes: ['Open#1.png', 'Closed#1.png', 'Wink#1.png', 'Laser#1.png', 'Glow#1.png'],
        headwear: ['None#50.png', 'Crown#1.png'],
      };
      const key = Object.keys(sets).find((k) => s.includes(k));
      return ok({ items: sets[key] ?? sets.background });
    },
    renameFiles: () => ok({ renamed: 0 }),
    previewLive: () => ok({ format: 'png', images: previews }),
    previewEffects: () => ok({ format: 'png', b64: palette[0] }),
    buildWithProgress: () => ok({ stdout: 'Built 8 editions' }),
    pauseBuild: () => ok(),
    resumeBuild: () => ok(),
    stopBuild: () => ok(),
    onBuildProgress: () => {},
    previewWithProgress: () => ok({ stdout: 'wrote previews' }),
    pausePreview: () => ok(),
    resumePreview: () => ok(),
    stopPreview: () => ok(),
    onPreviewProgress: () => {},
    auditAssets: () => ok({ json: {} }),
    auditOutputs: () => ok({ json: {} }),
    run: () => ok({ stdout: '' }),
    openInExplorer: () => ok(),
    openExternal: () => ok(),
    ensureDirs: () => ok(),
    deletePath: () => ok(),
    deleteFile: () => ok(),
    listFiles: () => ok({ files: [] }),
    exportSite: () => ok({ outDir: 'C:/demo/collection/site-export' }),
    deploySite: () => ok({ url: 'https://demo.vercel.app' }),
    previewSite: () => ok({ url: 'http://127.0.0.1:5000/' }),
    pickImage: () => ok({ cancelled: true }),
    packsList: () =>
      ok({
        packs: [
          { id: 'conkerco-default', name: 'CONKERCO Default', kind: 'pack', builtin: true },
          { id: 'pack-holo', name: 'My Holo Pack', kind: 'pack', builtin: false },
          { id: 'conkerco-back-holo', name: 'CONKERCO Holo', kind: 'back', builtin: true },
          { id: 'conkerco-back-eye', name: 'All-Seeing Eye', kind: 'back', builtin: true },
          { id: 'conkerco-back-chrome', name: 'CONKERCO Chrome', kind: 'back', builtin: true },
        ],
      }),
    packsRead: (id = '') => ok(realPacks[id] ? { base64: realPacks[id], mime: 'image/png' } : { base64: palette[hash(id) % palette.length], mime: 'image/png' }),
    packsImport: () => ok({ pack: { id: 'pack-new', name: 'New Pack', kind: 'pack', builtin: false } }),
    packsDelete: () => ok(),
    // --- Phase-L launch (drives the Launch screen's status + sale-management surfaces) ---
    launchStatus: () => ok({ json: launchStatus }),
    launchEstimate: () => ok({ json: { deployer: ADDR, balanceEth: '0.4213', costEth: '0.0127', sufficient: true, chainId: 84532, testnet: true } }),
    launchDeploy: () => ok({ json: { address: ADDR, txHash: '0xabc' } }),
    launchSetCaps: () => ok({ json: { txHash: '0xabc' } }),
    launchSetPrices: () => ok({ json: { txHash: '0xabc' } }),
    launchSetPhase: () => ok({ json: { txHash: '0xabc' } }),
    launchReveal: () => ok({ json: { txHash: '0xabc' } }),
    launchFreeze: () => ok({ json: { txHash: '0xabc' } }),
    launchWithdraw: () => ok({ json: { txHash: '0xabc' } }),
    launchSetAllowlist: () => ok({ json: { root: '0xroot', count: 3, txHash: '0xabc' } }),
    launchConsole: () => ok({ url: 'http://127.0.0.1:7777/' }),
  };
}

async function launchBrowser() {
  for (const channel of ['msedge', 'chrome']) {
    try {
      return await chromium.launch({ channel, headless: true });
    } catch {
      /* try next */
    }
  }
  return chromium.launch({ headless: true });
}

// Every nav destination (id → nav label). 'projects' has no pipeline index; the rest do.
const STAGES = [
  ['projects', 'Projects'],
  ['design', 'Design'],
  ['preview', 'Preview'],
  ['build', 'Build'],
  ['publish', 'Publish'],
  ['experience', 'Mint FX'],
  ['site', 'Site'],
  ['launch', 'Launch'],
  ['ai', 'Fal AI'],
  ['packs', 'Packs'],
  ['settings', 'Settings'],
  ['help', 'Help'],
  ['playground', 'Components'],
];

// Per-screen critique prompts: what to actually LOOK at on each landing view. These ride along
// into the manifest + contact sheet so a design pass has a checklist, not just a thumbnail.
const STAGE_NOTES = {
  projects: 'Empty-state hierarchy; primary-action prominence; header/toolbar density.',
  design: 'Densest screen. Layers table legibility; per-row controls; tab bar; rarity bars.',
  preview: 'Generate affordance; gallery grid rhythm; empty vs populated; card framing.',
  build: 'Progress affordance; output gallery; counts/feedback; button grouping.',
  publish: 'Readiness checklist clarity; provider state; URI rewrite messaging.',
  experience: 'Pack-rip theater framing; pre-rip rest state; controls; rarity backs.',
  site: 'Template picker; canvas builder chrome; inspector; widget zoo density.',
  launch: 'Status panel scannability; signing options; deploy CTA; testnet/mainnet cues.',
  ai: 'Fal catalog layout; generation controls; key-entry state.',
  packs: 'Library grid; built-in vs imported; card-back vs pack distinction.',
  settings: 'Theme + accent controls; grouping; form rhythm.',
  help: 'Reading length/measure; section hierarchy; link affordances.',
  playground: 'Component primitives + states side-by-side — the design-system source of truth.',
};

const GROUP = {
  projects: 'Pipeline · stages', design: 'Pipeline · stages', preview: 'Pipeline · stages',
  build: 'Pipeline · stages', publish: 'Pipeline · stages', experience: 'Pipeline · stages',
  site: 'Pipeline · stages', launch: 'Pipeline · stages', ai: 'Utility', packs: 'Utility',
  settings: 'Utility', help: 'Utility', playground: 'Utility',
};

async function main() {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  const url = `http://127.0.0.1:${port}/`;
  const browser = await launchBrowser();

  // Load the real bundled pack/back PNGs so Mint FX renders the genuine torn-open art.
  const packsDir = path.join(distDir, '..', 'assets', 'packs');
  const realPacks = {};
  try {
    for (const f of fs.readdirSync(packsDir)) {
      if (f.endsWith('.png')) realPacks[f.replace(/\.png$/, '')] = fs.readFileSync(path.join(packsDir, f)).toString('base64');
    }
  } catch {
    /* no bundled packs — mock falls back to color stand-ins */
  }

  /** Manifest of every capture (drives index.html). */
  const shots = [];

  /** Create a ready page: mocked bridge, chosen theme/viewport, nav rendered. */
  async function newPage({ theme = 'dark', viewport = { width: 1440, height: 900 }, deployed = false } = {}) {
    const page = await browser.newPage({ viewport });
    await page.addInitScript((t) => {
      try { localStorage.setItem('cnftz:theme', t); } catch { /* ignore */ }
    }, theme);
    await page.addInitScript(installMock, { realPacks, deployed });
    await page.goto(url, { waitUntil: 'load' });
    await page.waitForSelector('.nav-item', { timeout: 15000 });
    return page;
  }

  /** Navigate to a stage reliably: click, wait for it to become the active nav item, settle. */
  async function gotoStage(page, label) {
    const item = page.locator('.nav-item', { hasText: label }).first();
    await item.click();
    await page.locator('.nav-item.active', { hasText: label }).first().waitFor({ timeout: 8000 });
    await page.waitForTimeout(450); // let entrance transitions settle
  }

  /** Capture (full page or a locator) and record a manifest entry; never throws. */
  async function shot(page, { id, group, note, theme = 'dark', viewport = '1440×900', locator = null, fullPage = true }) {
    const file = `${id}.png`;
    try {
      if (locator) await locator.screenshot({ path: path.join(outDir, file) });
      else await page.screenshot({ path: path.join(outDir, file), fullPage });
      shots.push({ id, group, note: note ?? '', theme, viewport, file, status: 'ok' });
      console.log('captured', id);
    } catch (e) {
      shots.push({ id, group, note: note ?? '', theme, viewport, file: null, status: 'FAILED', error: String(e?.message ?? e) });
      console.log('FAILED', id, String(e?.message ?? e));
    }
  }

  // ── Pass 1 — dark, 1440×900: every stage landing view ───────────────────────────────────────
  const dark = await newPage();
  for (const [id, label] of STAGES) {
    try {
      await gotoStage(dark, label);
      await shot(dark, { id, group: GROUP[id], note: STAGE_NOTES[id] });
    } catch (e) {
      shots.push({ id, group: GROUP[id], note: STAGE_NOTES[id], theme: 'dark', viewport: '1440×900', file: null, status: 'FAILED', error: String(e?.message ?? e) });
      console.log('FAILED', id, String(e?.message ?? e));
    }
  }

  // ── Pass 1 — shell chrome close-ups (legible header/nav/status crops for the shell pass) ─────
  try {
    await gotoStage(dark, 'Projects');
    await shot(dark, { id: 'shell-header', group: 'Shell · chrome', note: 'Header — wordmark + tagline, active-project readout chip, theme toggle.', locator: dark.locator('.header').first() });
    await shot(dark, { id: 'shell-nav', group: 'Shell · chrome', note: 'Pipeline nav — index numbers, lamps, section grouping, active state.', locator: dark.locator('.nav').first() });
    await shot(dark, { id: 'shell-statusbar', group: 'Shell · chrome', note: 'Status bar — project/bridge/theme/version readouts.', locator: dark.locator('.statusbar').first() });
  } catch (e) {
    console.log('FAILED', 'shell-chrome', String(e?.message ?? e));
  }

  // ── Pass 1 — key in-screen interactions (states beyond the landing view) ─────────────────────
  // Design: tabs, layers close-up, trait browser.
  try {
    await gotoStage(dark, 'Design');
    await shot(dark, { id: 'design-layers-panel', group: 'Design · detail', note: 'Layers table close-up — row controls, rarity bars, alignment.', locator: dark.locator('.panel', { hasText: 'Layers' }).first() });
    for (const t of ['Basics', 'Assets & rarity', 'Rules']) {
      await dark.getByRole('tab', { name: new RegExp(`^${t}`, 'i') }).click();
      await dark.waitForTimeout(350);
      const id = `design-${t.split(' ')[0].toLowerCase()}`;
      await shot(dark, { id, group: 'Design · detail', note: `Design “${t}” tab — form rhythm, grouping, field states.` });
    }
    await dark.getByRole('tab', { name: /^Layers/i }).click();
    await dark.waitForTimeout(300);
    await dark.getByRole('button', { name: /Browse layer 1 traits/i }).click();
    await dark.waitForTimeout(700);
    await shot(dark, { id: 'design-traits', group: 'Design · detail', note: 'Trait browser open — card grid, value/%/weight legibility.' });
    await shot(dark, { id: 'design-traits-panel', group: 'Design · detail', note: 'Traits panel close-up — per-card detail density.', locator: dark.locator('.panel', { hasText: 'Traits —' }).first() });
  } catch (e) {
    console.log('FAILED', 'design-interactions', String(e?.message ?? e));
  }

  // Projects: New collection dialog.
  try {
    await gotoStage(dark, 'Projects');
    await dark.getByRole('button', { name: 'New project' }).first().click();
    await dark.waitForTimeout(300);
    await dark.getByLabel('Collection name').fill('Specimens');
    await dark.waitForTimeout(150);
    await shot(dark, { id: 'projects-new', group: 'Projects', note: 'New-project dialog — modal framing, field layout, scaffold options.' });
    await dark.keyboard.press('Escape');
    await dark.waitForTimeout(150);
  } catch (e) {
    console.log('FAILED', 'projects-new', String(e?.message ?? e));
  }

  // Preview: generate a set, then open the inspection lightbox.
  try {
    await gotoStage(dark, 'Preview');
    await dark.getByRole('button', { name: 'Generate previews' }).first().click();
    await dark.waitForTimeout(700);
    await shot(dark, { id: 'preview-gallery', group: 'Preview', note: 'Populated gallery — grid rhythm, card framing, density.' });
    await dark.getByRole('button', { name: /Inspect preview 1/i }).click();
    await dark.waitForTimeout(400);
    await shot(dark, { id: 'preview-lightbox', group: 'Preview', note: 'Inspection lightbox — backdrop, metadata panel, controls.' });
    await dark.keyboard.press('Escape');
    await dark.waitForTimeout(200);
  } catch (e) {
    console.log('FAILED', 'preview-interactions', String(e?.message ?? e));
  }

  // Build: run a build → populated output gallery.
  try {
    await gotoStage(dark, 'Build');
    await dark.getByRole('button', { name: 'Build collection' }).first().click();
    await dark.waitForTimeout(900);
    await shot(dark, { id: 'build-output', group: 'Build', note: 'Post-build output — editions gallery, completion feedback.' });
  } catch (e) {
    console.log('FAILED', 'build-interactions', String(e?.message ?? e));
  }

  // Site: apply a starter template → builder + canvas.
  try {
    await gotoStage(dark, 'Site');
    await dark.locator('.template-card', { hasText: 'GeoCities' }).click();
    await dark.waitForTimeout(500);
    await shot(dark, { id: 'site-geocities', group: 'Site', note: 'GeoCities template applied — canvas chrome, widgets, inspector.' });
  } catch (e) {
    console.log('FAILED', 'site-interactions', String(e?.message ?? e));
  }

  // Mint FX: rip the pack (tear beat → stacked), then pull the cards out.
  try {
    await gotoStage(dark, 'Mint FX');
    const pack = dark.getByRole('button', { name: 'Rip open the pack' }).first();
    await pack.click();
    await dark.waitForTimeout(1500);
    await shot(dark, { id: 'experience-stacked', group: 'Experience', note: 'Cards emerged + settled in the pack (mid-rip beat).', locator: dark.locator('.exp').first() });
    await dark.locator('.exp-rip-front, .exp-rip-pack').first().click();
    await dark.waitForTimeout(1100);
    await shot(dark, { id: 'experience-rip', group: 'Experience', note: 'Cards spilled out, pack receded — reveal payoff frame.', locator: dark.locator('.exp').first() });
  } catch (e) {
    console.log('FAILED', 'experience-rip', String(e?.message ?? e));
  }
  await dark.close();

  // ── Pass 1b — Launch in its DEPLOYED state (sale setup / allowlist / reveal / proceeds) ──────
  try {
    const deployedPage = await newPage({ deployed: true });
    await gotoStage(deployedPage, 'Launch');
    await deployedPage.waitForTimeout(300);
    await shot(deployedPage, { id: 'launch-deployed', group: 'Pipeline · stages', note: 'Live contract — sale setup, phase, allowlist, reveal, proceeds.' });
    await deployedPage.close();
  } catch (e) {
    console.log('FAILED', 'launch-deployed', String(e?.message ?? e));
  }

  // ── Pass 2 — LIGHT theme, every stage (the token layer must hold in both themes) ─────────────
  try {
    const light = await newPage({ theme: 'light' });
    for (const [id, label] of STAGES) {
      try {
        await gotoStage(light, label);
        await shot(light, { id: `light-${id}`, group: 'Light theme', note: `Light-mode ${label} — contrast, surfaces, accent legibility.`, theme: 'light' });
      } catch (e) {
        console.log('FAILED', `light-${id}`, String(e?.message ?? e));
      }
    }
    await light.close();
  } catch (e) {
    console.log('FAILED', 'light-pass', String(e?.message ?? e));
  }

  // ── Pass 3 — COMPACT viewport (expose density/overflow at a smaller window) ──────────────────
  try {
    const compact = await newPage({ viewport: { width: 1180, height: 800 } });
    for (const label of ['Design', 'Site', 'Mint FX', 'Launch', 'Packs']) {
      try {
        await gotoStage(compact, label);
        const id = `compact-${label.toLowerCase().replace(/\s+/g, '-')}`;
        await shot(compact, { id, group: 'Compact viewport', note: `${label} at 1180px — wrapping, overflow, density under constraint.`, viewport: '1180×800' });
      } catch (e) {
        console.log('FAILED', `compact-${label}`, String(e?.message ?? e));
      }
    }
    await compact.close();
  } catch (e) {
    console.log('FAILED', 'compact-pass', String(e?.message ?? e));
  }

  await browser.close();
  server.close();

  writeManifest(shots);
  writeContactSheet(shots);

  const failed = shots.filter((s) => s.status !== 'ok');
  console.log(`\n${shots.length} shots, ${failed.length} failed.`);
  if (failed.length) console.log('FAILED:', failed.map((s) => s.id).join(', '));
  console.log('screenshots →', outDir);
  console.log('contact sheet →', path.join(outDir, 'index.html'));
}

function writeManifest(shots) {
  const manifest = { generatedAt: new Date().toISOString(), count: shots.length, shots };
  fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
}

// A self-contained, dependency-free contact sheet: open screenshots/index.html to flip through
// every capture grouped by section, each with its critique note. Click a shot to open it full size.
function writeContactSheet(shots) {
  const groups = [];
  const byGroup = new Map();
  for (const s of shots) {
    if (!byGroup.has(s.group)) {
      byGroup.set(s.group, []);
      groups.push(s.group);
    }
    byGroup.get(s.group).push(s);
  }
  const esc = (x) => String(x ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const card = (s) => {
    const chips = [s.theme, s.viewport, s.status !== 'ok' ? 'FAILED' : null].filter(Boolean)
      .map((c) => `<span class="chip${c === 'FAILED' ? ' bad' : ''}">${esc(c)}</span>`).join('');
    const media = s.file
      ? `<a href="${esc(s.file)}" target="_blank"><img loading="lazy" src="${esc(s.file)}" alt="${esc(s.id)}"></a>`
      : `<div class="missing">no capture — ${esc(s.error || 'failed')}</div>`;
    return `<figure class="card">
      <div class="frame">${media}</div>
      <figcaption>
        <div class="row"><code>${esc(s.id)}</code>${chips}</div>
        <p>${esc(s.note)}</p>
      </figcaption>
    </figure>`;
  };
  const sections = groups.map((g) => `
    <section>
      <h2>${esc(g)} <span class="count">${byGroup.get(g).length}</span></h2>
      <div class="grid">${byGroup.get(g).map(card).join('')}</div>
    </section>`).join('');
  const failed = shots.filter((s) => s.status !== 'ok').length;
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>ConkerNFTZ — visual assessment</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin: 0; background: #0b0d0f; color: #e7e3d8;
    font: 14px/1.5 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; }
  header { position: sticky; top: 0; z-index: 5; padding: 16px 24px;
    background: rgba(11,13,15,0.92); backdrop-filter: blur(6px);
    border-bottom: 1px solid rgba(255,255,255,0.08); display: flex; align-items: baseline; gap: 14px; }
  header h1 { font-size: 15px; letter-spacing: 0.14em; text-transform: uppercase; margin: 0; color: #f0b429; }
  header .meta { color: #8b9097; font-size: 12px; }
  main { padding: 8px 24px 64px; max-width: 1680px; margin: 0 auto; }
  section { margin-top: 32px; }
  h2 { font-size: 12px; letter-spacing: 0.14em; text-transform: uppercase; color: #9aa0a6;
    border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 8px; }
  h2 .count { color: #5d6168; margin-left: 6px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 18px; }
  .card { margin: 0; background: #141719; border: 1px solid rgba(255,255,255,0.07); border-radius: 8px; overflow: hidden; }
  .frame { background: #000; aspect-ratio: 16/10; display: flex; align-items: center; justify-content: center; overflow: hidden; }
  .frame img { width: 100%; height: 100%; object-fit: cover; object-position: top; display: block; }
  .missing { color: #ff6b6b; font-size: 12px; padding: 18px; text-align: center; }
  figcaption { padding: 10px 12px 12px; }
  .row { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
  code { font: 12px/1.4 ui-monospace, "SF Mono", Menlo, monospace; color: #f0b429; }
  .chip { font-size: 10px; letter-spacing: 0.06em; text-transform: uppercase; color: #aeb3b8;
    border: 1px solid rgba(255,255,255,0.14); border-radius: 999px; padding: 1px 7px; }
  .chip.bad { color: #ff6b6b; border-color: rgba(255,107,107,0.5); }
  figcaption p { margin: 8px 0 0; color: #9aa0a6; font-size: 12.5px; }
</style></head><body>
<header>
  <h1>ConkerNFTZ — Visual Assessment</h1>
  <span class="meta">${shots.length} captures · ${failed} failed · ${esc(new Date().toLocaleString())}</span>
</header>
<main>${sections}</main>
</body></html>`;
  fs.writeFileSync(path.join(outDir, 'index.html'), html);
}

main().catch((e) => {
  console.error(e);
  server.close();
  process.exit(1);
});
