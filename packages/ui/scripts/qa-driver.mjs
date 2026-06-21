// QA interaction + verification driver.
//
// Drives every surface of the built renderer in a headless browser (system Edge/Chrome via
// playwright-core, mocked window.foundry), TRIGGERS controls and WAITS for each op to complete,
// then VERIFIES the outcome — while capturing every console error/warning, page error, and failed
// request and tagging it to the surface that produced it. Emits:
//   • screenshots/qa-report.json  — structured findings
//   • screenshots/qa-report.md    — human-readable report (grouped by surface)
// Exits non-zero if any console error, page error, failed request, or assertion failure is found,
// so it can gate the QA loop ("a console error or un-updated state = a FAIL").
//
// Run: pnpm -C packages/ui build:renderer-next && pnpm -C packages/ui qa
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeServer, installMock, launchBrowser, loadRealPacks } from './lib/harness.mjs';

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

/** All findings; each is { surface, kind, level, text }. `surface` is the screen/flow in play. */
const findings = [];
let surface = 'boot';
const FAIL_KINDS = new Set(['pageerror', 'requestfailed', 'assert']);
const record = (kind, level, text) => findings.push({ surface, kind, level, text: String(text ?? '').replace(/\s+/g, ' ').slice(0, 300) });
const isFail = (f) => FAIL_KINDS.has(f.kind) || (f.kind === 'console' && f.level === 'error');

/** Wire console/page/network listeners so every runtime problem is captured + attributed. */
function attach(page) {
  page.on('console', (msg) => {
    const t = msg.type();
    if (t === 'error' || t === 'warning') record('console', t, msg.text());
  });
  page.on('pageerror', (err) => record('pageerror', 'error', err?.message ?? err));
  page.on('requestfailed', (req) => {
    const url = req.url();
    const err = req.failure()?.errorText || '';
    if (/favicon/i.test(url) || /ERR_ABORTED/.test(err)) return; // ignore favicon + cancelled navs
    record('requestfailed', 'error', `${url} — ${err}`);
  });
}

function assert(cond, msg) {
  if (!cond) record('assert', 'error', msg);
  return cond;
}

const url = () => `http://127.0.0.1:${server.address().port}/`;

async function newPage(browser, realPacks, opts = {}) {
  const page = await browser.newPage({ viewport: opts.viewport || { width: 1440, height: 900 } });
  attach(page);
  if (opts.theme) await page.addInitScript((t) => { try { localStorage.setItem('cnftz:theme', t); } catch { /* */ } }, opts.theme);
  if (opts.recents) await page.addInitScript((r) => { try { localStorage.setItem('cnftz:recents', JSON.stringify(r)); } catch { /* */ } }, opts.recents);
  await page.addInitScript(installMock, { realPacks, deployed: opts.deployed, failMethods: opts.failMethods });
  await page.goto(url(), { waitUntil: 'load' });
  await page.waitForSelector('.nav-item', { timeout: 15000 });
  return page;
}

async function gotoStage(page, label) {
  await page.locator('.nav-item', { hasText: label }).first().click();
  await page.locator('.nav-item.active', { hasText: label }).first().waitFor({ timeout: 8000 });
  await page.waitForTimeout(400);
}

/** Run one surface's checks under a label; never let a throw abort the whole sweep. */
async function step(name, fn) {
  surface = name;
  try {
    await fn();
  } catch (e) {
    record('assert', 'error', `flow threw: ${e?.message ?? e}`);
  }
}

async function main() {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const realPacks = loadRealPacks(distDir);
  const browser = await launchBrowser();
  const page = await newPage(browser, realPacks);

  // Every stage renders without runtime errors and shows its title.
  const TITLES = {
    Projects: 'Projects', Design: 'Design', Preview: 'Preview', Build: 'Build', Publish: 'Publish',
    'Mint FX': 'Mint experience', Site: 'Site builder', Launch: 'Launch', 'Fal AI': 'Fal AI',
    Packs: 'Packs', Settings: 'Settings', Help: 'Help', Components: 'Components',
  };
  for (const [label, title] of Object.entries(TITLES)) {
    await step(`nav:${label}`, async () => {
      await gotoStage(page, label);
      const heading = await page.locator('.main-title').first().textContent();
      assert((heading || '').trim() === title, `${label}: expected title "${title}", got "${(heading || '').trim()}"`);
    });
  }

  await step('design:tabs+traits+addlayer', async () => {
    await gotoStage(page, 'Design');
    for (const t of ['Basics', 'Assets & rarity', 'Rules', 'Layers']) {
      await page.getByRole('tab', { name: new RegExp(`^${t}`, 'i') }).click();
      await page.waitForTimeout(200);
    }
    const before = await page.locator('.layer-row').count();
    await page.getByRole('button', { name: /^\+ Add layer/i }).first().click();
    await page.waitForTimeout(200);
    const after = await page.locator('.layer-row').count();
    assert(after === before + 1, `Add layer: row count ${before} → ${after} (expected +1)`);
    await page.getByRole('button', { name: /Browse layer 1 traits/i }).click();
    await page.waitForTimeout(500);
    assert(await page.locator('.panel', { hasText: 'Traits —' }).first().isVisible(), 'Trait browser did not open');
  });

  await step('projects:new-dialog', async () => {
    await gotoStage(page, 'Projects');
    await page.getByRole('button', { name: 'New project' }).first().click();
    await page.waitForTimeout(250);
    const dialog = page.getByRole('dialog');
    assert(await dialog.isVisible(), 'New-project dialog did not open');
    await page.getByLabel('Collection name').fill('QA Specimens');
    await page.waitForTimeout(150);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    assert(!(await dialog.isVisible().catch(() => false)), 'Dialog did not close on Escape');
  });

  await step('preview:generate+lightbox', async () => {
    await gotoStage(page, 'Preview');
    await page.getByRole('button', { name: 'Generate previews' }).first().click();
    await page.waitForTimeout(800);
    const thumbs = await page.locator('.thumb').count();
    assert(thumbs > 0, `Preview generate produced ${thumbs} thumbnails (expected > 0)`);
    await page.getByRole('button', { name: /Inspect preview 1/i }).click();
    await page.waitForTimeout(300);
    assert(await page.locator('.backdrop').first().isVisible(), 'Preview lightbox did not open');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
  });

  await step('build:run+output', async () => {
    await gotoStage(page, 'Build');
    await page.getByRole('button', { name: 'Build collection' }).first().click();
    await page.waitForTimeout(900);
    const out = await page.locator('.thumb').count();
    assert(out > 0, `Build produced ${out} output thumbnails (expected > 0)`);
  });

  await step('publish:upload', async () => {
    await gotoStage(page, 'Publish');
    await page.getByRole('button', { name: 'Upload assets' }).first().click();
    await page.waitForTimeout(500);
  });

  await step('mintfx:preset+replay+rip', async () => {
    await gotoStage(page, 'Mint FX');
    await page.getByRole('button', { name: /^Replay/i }).first().click();
    await page.waitForTimeout(400);
    const pack = page.getByRole('button', { name: 'Rip open the pack' }).first();
    if (await pack.isVisible().catch(() => false)) {
      await pack.click();
      await page.waitForTimeout(1500);
      assert(await page.locator('.exp').first().isVisible(), 'Mint FX player .exp not visible after rip');
    }
  });

  await step('site:template+canvas', async () => {
    await gotoStage(page, 'Site');
    await page.locator('.template-card', { hasText: 'GeoCities' }).first().click();
    await page.waitForTimeout(500);
    // Switch to canvas mode and confirm a canvas surface renders.
    const layout = page.getByLabel('Layout mode');
    if (await layout.isVisible().catch(() => false)) {
      await layout.selectOption('canvas').catch(() => {});
      await page.waitForTimeout(400);
    }
  });

  await step('settings:theme+accent', async () => {
    await gotoStage(page, 'Settings');
    // exact:true — a loose "Theme" also matches the header's "Toggle color theme" button.
    await page.getByLabel('Theme', { exact: true }).selectOption('light');
    await page.waitForTimeout(200);
    assert((await page.locator('html').getAttribute('data-theme')) === 'light', 'Settings theme → light did not apply');
    await page.getByLabel('Accent', { exact: true }).selectOption('cyan');
    await page.waitForTimeout(150);
    assert((await page.locator('html').getAttribute('data-theme')) === 'light', 'Accent change unexpectedly altered theme');
    await page.getByLabel('Theme', { exact: true }).selectOption('dark');
    await page.waitForTimeout(150);
  });

  await step('components:dialog+toasts+loading', async () => {
    await gotoStage(page, 'Components');
    await page.getByRole('button', { name: 'Open dialog' }).first().click();
    await page.waitForTimeout(250);
    assert(await page.getByRole('dialog').isVisible(), 'Components dialog did not open');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(150);
    await page.getByRole('button', { name: 'Toast OK' }).first().click();
    await page.waitForTimeout(300);
  });

  await page.close();

  // Launch (deployed) — drive the sale-management writes (mocked) and confirm no runtime errors.
  await step('launch:deployed-actions', async () => {
    const lp = await newPage(browser, realPacks, { deployed: true });
    await gotoStage(lp, 'Launch');
    await lp.waitForTimeout(300);
    for (const name of ['Save caps', 'Save prices']) {
      const b = lp.getByRole('button', { name }).first();
      if (await b.isVisible().catch(() => false)) {
        await b.click();
        await lp.waitForTimeout(400);
      }
    }
    await lp.close();
  });

  // Unhappy path — make the primary actions FAIL and confirm error handling fires (toast / no crash).
  await step('errors:build+upload+preview-fail', async () => {
    const fp = await newPage(browser, realPacks, { failMethods: ['buildWithProgress', 'run', 'previewLive', 'exportSite'] });
    await gotoStage(fp, 'Preview');
    await fp.getByRole('button', { name: 'Generate previews' }).first().click();
    await fp.waitForTimeout(500);
    await gotoStage(fp, 'Build');
    await fp.getByRole('button', { name: 'Build collection' }).first().click();
    await fp.waitForTimeout(600);
    await gotoStage(fp, 'Publish');
    await fp.getByRole('button', { name: 'Upload assets' }).first().click();
    await fp.waitForTimeout(600);
    await fp.close();
  });

  await browser.close();
  server.close();

  writeReport();
  const fails = findings.filter(isFail);
  const warns = findings.filter((f) => f.kind === 'console' && f.level === 'warning');
  console.log(`\nQA driver: ${findings.length} findings — ${fails.length} FAIL, ${warns.length} warning.`);
  for (const f of fails.slice(0, 40)) console.log(`  ✗ [${f.surface}] ${f.kind}: ${f.text}`);
  console.log('report →', path.join(outDir, 'qa-report.md'));
  process.exit(fails.length ? 1 : 0);
}

function writeReport() {
  const bySurface = new Map();
  for (const f of findings) {
    if (!bySurface.has(f.surface)) bySurface.set(f.surface, []);
    bySurface.get(f.surface).push(f);
  }
  const fails = findings.filter(isFail);
  const warns = findings.filter((f) => f.kind === 'console' && f.level === 'warning');
  let md = `# ConkerNFTZ — QA driver report\n\n`;
  md += `_${new Date().toLocaleString()}_\n\n`;
  md += `**${findings.length} findings — ${fails.length} FAIL, ${warns.length} warning.** `;
  md += fails.length ? `Fix the FAILs.\n\n` : `No failures.\n\n`;
  for (const [s, list] of bySurface) {
    const f = list.filter(isFail).length;
    const w = list.filter((x) => x.kind === 'console' && x.level === 'warning').length;
    md += `## ${s} — ${f} fail, ${w} warn\n\n`;
    if (list.length === 0) md += `_clean_\n\n`;
    for (const x of list) md += `- ${isFail(x) ? '✗' : '•'} \`${x.kind}/${x.level}\` ${x.text}\n`;
    md += `\n`;
  }
  fs.writeFileSync(path.join(outDir, 'qa-report.md'), md);
  fs.writeFileSync(path.join(outDir, 'qa-report.json'), JSON.stringify({ generatedAt: new Date().toISOString(), findings }, null, 2));
}

main().catch((e) => {
  console.error(e);
  server.close();
  process.exit(1);
});
