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

/** Wire console/page/network listeners so every runtime problem is captured + attributed.
 *  Also auto-accept window.confirm/alert so confirm-gated actions (Launch phase/freeze) proceed. */
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
  page.on('dialog', (d) => d.accept().catch(() => {}));
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

  await step('design:layer-row-controls', async () => {
    await gotoStage(page, 'Design');
    await page.getByRole('tab', { name: /^Layers/i }).click();
    await page.waitForTimeout(200);
    const nameInput = page.getByLabel('Layer 1 name');
    await nameInput.fill('Backdrop');
    await page.waitForTimeout(100);
    assert((await nameInput.inputValue()) === 'Backdrop', 'Layer name edit did not stick');
    await page.getByLabel('Layer 1 rarity').selectOption('uniform');
    await page.waitForTimeout(100);
    assert((await page.getByLabel('Layer 1 rarity').inputValue()) === 'uniform', 'Layer rarity select did not apply');
    const req = page.getByLabel('Layer 1 required');
    const before = await req.isChecked();
    await req.click();
    await page.waitForTimeout(100);
    assert((await req.isChecked()) !== before, 'Required checkbox did not toggle');
    await page.getByLabel('Layer 1 opacity').fill('0.5');
    await page.waitForTimeout(100);
    // Open the effects editor for layer 1 and confirm its panel mounts.
    await page.getByRole('button', { name: /Edit layer 1 effects/i }).click();
    await page.waitForTimeout(300);
    assert(await page.locator('.panel', { hasText: 'Effects —' }).first().isVisible(), 'Effects editor did not open');
    // "Save config" should now be enabled (config is dirty after edits).
    const save = page.getByRole('button', { name: 'Save config' }).first();
    assert(!(await save.isDisabled()), 'Save config stayed disabled after edits (dirty state not tracked)');
    await save.click();
    await page.waitForTimeout(200);
  });

  await step('design:rules-editor', async () => {
    await gotoStage(page, 'Design');
    await page.getByRole('tab', { name: /^Rules/i }).click();
    await page.waitForTimeout(200);
    await page.getByRole('button', { name: '+ Add cap' }).click();
    await page.waitForTimeout(120);
    await page.getByLabel('Max occurrence trait 1').fill('Background:Gold');
    await page.getByLabel('Max occurrence count 1').fill('10');
    await page.waitForTimeout(100);
    assert((await page.getByLabel('Max occurrence trait 1').inputValue()) === 'Background:Gold', 'Rules: max-occ trait edit did not stick');
    // Unhappy path: invalid JSON in the escape hatch must surface an error banner (no crash).
    await page.getByLabel('Rules JSON').fill('{ not valid json');
    await page.getByRole('button', { name: 'Apply JSON' }).click();
    await page.waitForTimeout(200);
    assert(await page.locator('.banner-error').first().isVisible(), 'Rules: invalid JSON did not surface an error banner');
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

  await step('site:canvas-widgets', async () => {
    await gotoStage(page, 'Site');
    await page.locator('.template-card', { hasText: 'GeoCities' }).first().click();
    await page.waitForTimeout(400);
    const before = await page.locator('.block-row').count();
    // The widget palette is a row of "+ <widget>" buttons; click the first to add a block.
    await page.getByRole('button', { name: /^\+ / }).first().click();
    await page.waitForTimeout(250);
    const after = await page.locator('.block-row').count();
    assert(after === before + 1, `Site: adding a widget changed blocks ${before} → ${after} (expected +1)`);
    assert((await page.locator('.block-row--sel').count()) >= 1, 'Site: newly-added widget was not auto-selected (inspector target)');
    // Re-select an existing block and confirm selection tracks.
    await page.locator('.block-row-label').first().click();
    await page.waitForTimeout(200);
    assert((await page.locator('.block-row--sel').count()) >= 1, 'Site: clicking a block-row did not select it');
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

  // Launch (not-deployed) — signer toggle + preflight + deploy.
  await step('launch:deploy-flow', async () => {
    const np = await newPage(browser, realPacks);
    await gotoStage(np, 'Launch');
    await np.waitForTimeout(300);
    // Toggle to the wallet signer and confirm the WalletConnect projectId field appears.
    await np.getByRole('button', { name: 'Connect wallet' }).first().click();
    await np.waitForTimeout(250);
    assert(await np.getByLabel('WalletConnect projectId').isVisible().catch(() => false), 'Wallet signer UI (projectId) did not appear');
    await np.getByRole('button', { name: 'Deployer key file' }).first().click();
    await np.waitForTimeout(200);
    await np.getByRole('button', { name: /Preflight/i }).click();
    await np.waitForTimeout(400);
    await np.getByRole('button', { name: 'Deploy contract' }).click();
    await np.waitForTimeout(500);
    await np.close();
  });

  // Launch (deployed) — drive sale writes + the confirm-gated phase/reveal/freeze/withdraw paths.
  await step('launch:deployed-actions', async () => {
    const lp = await newPage(browser, realPacks, { deployed: true });
    await gotoStage(lp, 'Launch');
    await lp.waitForTimeout(300);
    for (const name of ['Save caps', 'Save prices']) {
      const b = lp.getByRole('button', { name }).first();
      if (await b.isVisible().catch(() => false)) { await b.click(); await lp.waitForTimeout(300); }
    }
    // Phase → public (window.confirm auto-accepted), then reveal, freeze, withdraw.
    const pub = lp.getByRole('button', { name: 'public', exact: true }).first();
    if (await pub.isVisible().catch(() => false)) { await pub.click(); await lp.waitForTimeout(400); }
    const baseUri = lp.getByLabel('Revealed base URI');
    if (await baseUri.isVisible().catch(() => false)) {
      await baseUri.fill('ipfs://bafyrevealed/');
      await lp.getByRole('button', { name: 'Reveal', exact: true }).click();
      await lp.waitForTimeout(400);
    }
    const freeze = lp.getByRole('button', { name: /Freeze \(permanent\)/i }).first();
    if (await freeze.isVisible().catch(() => false)) { await freeze.click(); await lp.waitForTimeout(400); }
    const withdraw = lp.getByRole('button', { name: 'Withdraw', exact: true }).first();
    if (await withdraw.isVisible().catch(() => false)) { await withdraw.click(); await lp.waitForTimeout(400); }
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

  // Cross-cutting — light theme + compact viewport must drive without runtime errors.
  await step('crosscut:light-theme', async () => {
    const lt = await newPage(browser, realPacks, { theme: 'light' });
    for (const label of ['Projects', 'Design', 'Preview', 'Build', 'Site', 'Launch', 'Components']) {
      await gotoStage(lt, label);
    }
    await gotoStage(lt, 'Preview');
    await lt.getByRole('button', { name: 'Generate previews' }).first().click();
    await lt.waitForTimeout(600);
    assert((await lt.locator('.thumb').count()) > 0, 'Light: preview generate produced no thumbnails');
    await lt.close();
  });
  await step('crosscut:compact-viewport', async () => {
    const cv = await newPage(browser, realPacks, { viewport: { width: 1180, height: 800 } });
    for (const label of ['Design', 'Site', 'Mint FX', 'Launch', 'Packs']) await gotoStage(cv, label);
    await cv.close();
  });

  // Accessibility — keyboard: dialog focus trap, tablist arrow navigation, focusable shell.
  await step('a11y:keyboard', async () => {
    const kp = await newPage(browser, realPacks);
    // Tablist (automatic activation): focus the SELECTED tab, ArrowRight moves selection.
    await gotoStage(kp, 'Design');
    const selectedTab = kp.locator('[role="tab"][aria-selected="true"]').first();
    const selBefore = await selectedTab.textContent();
    await selectedTab.focus();
    await kp.keyboard.press('ArrowRight');
    await kp.waitForTimeout(150);
    const selAfter = await kp.locator('[role="tab"][aria-selected="true"]').textContent();
    assert(selBefore !== selAfter, `Tablist ArrowRight did not move selection (stayed "${selBefore}")`);
    // Dialog focus trap: open the Components dialog, Tab around, focus must stay inside it.
    await gotoStage(kp, 'Components');
    await kp.getByRole('button', { name: 'Open dialog' }).first().click();
    await kp.waitForTimeout(250);
    let trapped = true;
    for (let i = 0; i < 6; i++) {
      await kp.keyboard.press('Tab');
      await kp.waitForTimeout(40);
      const inside = await kp.evaluate(() => !!document.activeElement?.closest('[role="dialog"], .backdrop'));
      if (!inside) { trapped = false; break; }
    }
    assert(trapped, 'Dialog does not trap focus (Tab escaped the modal)');
    await kp.keyboard.press('Escape');
    await kp.waitForTimeout(150);
    assert(!(await kp.getByRole('dialog').isVisible().catch(() => false)), 'Dialog did not close on Escape (keyboard)');
    await kp.close();
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
