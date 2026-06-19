// Screenshot harness: render the built renderer-next in a headless browser with a mocked
// window.foundry (sample project + canvas-generated art), drive the nav, and capture every
// stage to packages/ui/screenshots/*.png — so UI changes can be SEEN (open the PNGs), not
// just trusted. Uses playwright-core driving the system Edge/Chrome (no browser download).
//
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
function installMock() {
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
    mintExperience: { kind: 'cardPack', packCount: 3, label: 'DEMO PACK', shake: true, autoFlip: false },
    export: { outDir: 'build', imageFormat: 'png' },
    storage: { provider: 'pinata' },
    chain: { target: 'evm' },
  };
  const ok = (x) => Promise.resolve(Object.assign({ ok: true }, x || {}));
  window.foundry = {
    getProjectDir: () => ok({ projectDir: 'C:/demo/collection' }),
    setProjectDir: () => ok({ projectDir: 'C:/demo/collection' }),
    chooseProjectDir: () => ok({ projectDir: 'C:/demo/collection' }),
    readConfig: () => ok({ json: CONFIG }),
    readConfigAt: () => ok({ json: CONFIG }),
    writeConfig: () => ok(),
    saveJson: () => ok(),
    saveBase64: () => ok(),
    readFile: () => ok({ content: '{}' }),
    // Return a varied color per requested path so galleries/thumbnails aren't all identical.
    readFileBase64: (rel = '') => ok({ base64: palette[hash(rel) % palette.length], mime: 'image/png' }),
    listImages: () => ok({ count: 8 }),
    // Path-aware: layer folders → rarity-distribution sample; the build images dir → editions.
    listDir: (p = '') => {
      const s = String(p);
      if (s.includes('images')) {
        return ok({ items: Array.from({ length: 12 }, (_, i) => `${i + 1}.png`) });
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

const STAGES = [
  ['projects', 'Projects'],
  ['design', 'Design'],
  ['preview', 'Preview'],
  ['build', 'Build'],
  ['publish', 'Publish'],
  ['experience', 'Mint FX'],
  ['site', 'Site'],
  ['ai', 'Fal AI'],
  ['settings', 'Settings'],
  ['help', 'Help'],
  ['playground', 'Components'],
];

const main = async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  const url = `http://127.0.0.1:${port}/`;
  const browser = await launchBrowser();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.addInitScript(installMock);
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForSelector('.nav-item', { timeout: 15000 });
  for (const [id, label] of STAGES) {
    try {
      await page.locator('.nav-item', { hasText: label }).first().click();
      await page.waitForTimeout(900);
      await page.screenshot({ path: path.join(outDir, `${id}.png`), fullPage: true });
      console.log('captured', id);
    } catch (e) {
      console.log('FAILED', id, String(e?.message ?? e));
    }
  }

  // Exercise key in-screen interactions so new features are captured, not just landing views.
  try {
    await page.locator('.nav-item', { hasText: 'Design' }).first().click();
    await page.waitForTimeout(600);
    // Close-up of the Layers table so the per-row rarity bars are legible.
    await page.locator('.panel', { hasText: 'Layers' }).first().screenshot({ path: path.join(outDir, 'design-layers-panel.png') });
    console.log('captured', 'design-layers-panel');
    // Walk the Design section tabs so each is captured.
    for (const t of ['Basics', 'Assets & rarity', 'Rules']) {
      await page.getByRole('tab', { name: new RegExp(`^${t}`, 'i') }).click();
      await page.waitForTimeout(350);
      await page.screenshot({ path: path.join(outDir, `design-${t.split(' ')[0].toLowerCase()}.png`), fullPage: true });
      console.log('captured', `design-${t.split(' ')[0].toLowerCase()}`);
    }
    // Back to Layers + expand the trait browser.
    await page.getByRole('tab', { name: /^Layers/i }).click();
    await page.waitForTimeout(300);
    await page.getByRole('button', { name: /Browse layer 1 traits/i }).click();
    await page.waitForTimeout(700);
    await page.screenshot({ path: path.join(outDir, 'design-traits.png'), fullPage: true });
    // Tight close-up of just the Traits panel so card details (value / % / weight) are legible.
    await page.locator('.panel', { hasText: 'Traits —' }).first().screenshot({ path: path.join(outDir, 'design-traits-panel.png') });
    console.log('captured', 'design-traits');
  } catch (e) {
    console.log('FAILED', 'design-interactions', String(e?.message ?? e));
  }

  // Preview: generate a set, then open the inspection lightbox.
  try {
    await page.locator('.nav-item', { hasText: 'Preview' }).first().click();
    await page.waitForTimeout(300);
    await page.getByRole('button', { name: 'Generate previews' }).first().click();
    await page.waitForTimeout(700);
    await page.screenshot({ path: path.join(outDir, 'preview-gallery.png'), fullPage: true });
    console.log('captured', 'preview-gallery');
    await page.getByRole('button', { name: /Inspect preview 1/i }).click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(outDir, 'preview-lightbox.png'), fullPage: true });
    console.log('captured', 'preview-lightbox');
  } catch (e) {
    console.log('FAILED', 'preview-interactions', String(e?.message ?? e));
  }

  // Build: run a build, which populates the output gallery (editions on disk).
  try {
    await page.keyboard.press('Escape'); // close any open lightbox so the backdrop doesn't block nav
    await page.waitForTimeout(200);
    await page.locator('.nav-item', { hasText: 'Build' }).first().click();
    await page.waitForTimeout(300);
    await page.getByRole('button', { name: 'Build collection' }).first().click();
    await page.waitForTimeout(900);
    await page.screenshot({ path: path.join(outDir, 'build-output.png'), fullPage: true });
    console.log('captured', 'build-output');
  } catch (e) {
    console.log('FAILED', 'build-interactions', String(e?.message ?? e));
  }
  await browser.close();
  server.close();
  console.log('screenshots →', outDir);
};

main().catch((e) => {
  console.error(e);
  server.close();
  process.exit(1);
});
