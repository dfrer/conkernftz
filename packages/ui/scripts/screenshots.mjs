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
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeServer, installMock, launchBrowser, loadRealPacks, STAGES } from './lib/harness.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const pkgRoot = path.resolve(here, '..');
const distDir = path.join(pkgRoot, 'dist', 'renderer-next');
const outDir = path.join(pkgRoot, 'screenshots');

if (!fs.existsSync(path.join(distDir, 'index.html'))) {
  console.error('dist/renderer-next not built — run: pnpm -C packages/ui build:renderer-next');
  process.exit(1);
}
fs.mkdirSync(outDir, { recursive: true });

const server = makeServer(distDir);

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
  const realPacks = loadRealPacks(distDir);

  /** Manifest of every capture (drives index.html). */
  const shots = [];

  /** Create a ready page: mocked bridge, chosen theme/viewport, nav rendered.
   *  `recents` seeds the Projects "recent dossiers" list (localStorage) so the populated grid
   *  — not just the empty state — can be captured. */
  async function newPage({ theme = 'dark', viewport = { width: 1440, height: 900 }, deployed = false, recents = null, solana = false, solanaCreated = false } = {}) {
    const page = await browser.newPage({ viewport });
    await page.addInitScript((t) => {
      try { localStorage.setItem('cnftz:theme', t); } catch { /* ignore */ }
    }, theme);
    if (recents) {
      await page.addInitScript((r) => {
        try { localStorage.setItem('cnftz:recents', JSON.stringify(r)); } catch { /* ignore */ }
      }, recents);
    }
    await page.addInitScript(installMock, { realPacks, deployed, solana, solanaCreated });
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
    await dark.getByRole('button', { name: 'Edit rarity for Gold#5.png' }).click();
    await dark.getByRole('spinbutton', { name: 'Rarity weight for Gold#5.png' }).fill('2');
    await dark.waitForTimeout(150);
    await shot(dark, { id: 'design-traits-rarity-editor', group: 'Design · detail', note: 'Trait rarity disclosure — filename-backed weight input, odds context, and immediate rename cue.', locator: dark.locator('.panel', { hasText: 'Traits —' }).first() });
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

  // ── Pass 1b — Projects with a populated recents grid (the non-empty state) ───────────────────
  try {
    const seeded = await newPage({
      recents: [
        { dir: 'C:/work/nasa-crust', name: 'NASA CRUST' },
        { dir: 'C:/work/specimens', name: 'Specimens' },
        { dir: 'C:/work/ether-king-set', name: 'Ether King Set' },
      ],
    });
    await gotoStage(seeded, 'Projects');
    await shot(seeded, { id: 'projects-populated', group: 'Projects', note: 'Recent dossiers grid — card rhythm, name/path hierarchy, "new" affordance.' });
    await seeded.close();
  } catch (e) {
    console.log('FAILED', 'projects-populated', String(e?.message ?? e));
  }

  // ── Pass 1b — Launch in its DEPLOYED state (sale setup / allowlist / reveal / proceeds) ──────
  try {
    const deployedPage = await newPage({ deployed: true });
    await gotoStage(deployedPage, 'Launch');
    await deployedPage.waitForTimeout(300);
    await shot(deployedPage, { id: 'launch-deployed', group: 'Pipeline · stages', note: 'Live contract — sale setup, phase, allowlist, reveal, proceeds.' });
    await shot(deployedPage, { id: 'launch-reveal-panel', group: 'Launch · detail', note: 'Reveal panel — baseURI auto-filled from the upload manifest + upload/reveal status.', locator: deployedPage.locator('.panel', { hasText: 'Reveal & metadata' }).first() });
    await deployedPage.close();
  } catch (e) {
    console.log('FAILED', 'launch-deployed', String(e?.message ?? e));
  }

  // ── Pass 1b — Launch (Solana / Candy Machine) — not-created + created states ─────────────────
  try {
    const solNew = await newPage({ solana: true });
    await gotoStage(solNew, 'Launch');
    await solNew.waitForTimeout(300);
    await shot(solNew, { id: 'launch-solana', group: 'Pipeline · stages', note: 'Solana Launch — Candy Machine status + Create panel (chain-equal to EVM).' });
    await solNew.close();
    const solMade = await newPage({ solana: true, solanaCreated: true });
    await gotoStage(solMade, 'Launch');
    await solMade.waitForTimeout(300);
    await shot(solMade, { id: 'launch-solana-created', group: 'Pipeline · stages', note: 'Solana Launch — created CM: items minted/loaded, Insert items.' });
    await solMade.close();
  } catch (e) {
    console.log('FAILED', 'launch-solana', String(e?.message ?? e));
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
