// Shared headless-harness primitives used by BOTH the visual-assessment tool (screenshots.mjs)
// and the QA interaction+verification driver (qa-driver.mjs):
//   • a static file server for dist/renderer-next,
//   • the mocked window.foundry bridge (with optional error-injection for unhappy-path testing),
//   • system-browser launch (Edge/Chrome via playwright-core, no download),
//   • the canonical list of nav stages.
//
// installMock is injected into the page via page.addInitScript(installMock, opts); it must stay
// self-contained (no closure over module scope) so Playwright can serialize it.
import { chromium } from 'playwright-core';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

export const MIME = {
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

/** A tiny static server for the built renderer; unknown paths fall back to index.html (SPA). */
export function makeServer(distDir) {
  return http.createServer((req, res) => {
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
}

/** Load the real bundled pack/back PNGs (id → base64) so Mint FX renders genuine torn-open art. */
export function loadRealPacks(distDir) {
  const packsDir = path.join(distDir, '..', 'assets', 'packs');
  const realPacks = {};
  try {
    for (const f of fs.readdirSync(packsDir)) {
      if (f.endsWith('.png')) realPacks[f.replace(/\.png$/, '')] = fs.readFileSync(path.join(packsDir, f)).toString('base64');
    }
  } catch {
    /* no bundled packs — mock falls back to color stand-ins */
  }
  return realPacks;
}

export async function launchBrowser() {
  for (const channel of ['msedge', 'chrome']) {
    try {
      return await chromium.launch({ channel, headless: true });
    } catch {
      /* try next */
    }
  }
  return chromium.launch({ headless: true });
}

/** Every nav destination (id → nav label). 'projects' has no pipeline index; the rest do. */
export const STAGES = [
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

// Runs IN the page: a mock bridge + canvas-generated PNG art so screens populate.
//   opts.realPacks    (id → base64) the real bundled pack/back PNGs (genuine Mint FX art).
//   opts.deployed     when true, the Launch screen reports a live deployed contract.
//   opts.failMethods  array of bridge-method names that should resolve to { ok:false, error } —
//                     for driving error handling / toast / recovery paths (unhappy-path QA).
export function installMock(opts) {
  const realPacks = (opts && opts.realPacks) || {};
  const deployed = !!(opts && opts.deployed);
  const failSet = new Set((opts && opts.failMethods) || []);
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
  const SOL_CM = 'CM9xQveYv1y3Nf2aTt7p8e3Wd4r5tY6uH7jK8lZ1mN0';
  const SOL_COLL = 'COLL7yk2pQ9wX8vR4tS6uH3jK1lZ0mN5b6c7d8e9f0g';
  const solana = !!(opts && opts.solana);
  const solanaCreated = !!(opts && opts.solanaCreated);
  const chain = solana
    ? {
        target: 'solana',
        solana: {
          cluster: 'devnet',
          walletKeypairPath: './keys/solana.json',
          sellerFeeBasisPoints: 500,
          creators: [{ address: ADDR, share: 100 }],
          collection: { mint: null },
          candyMachine: solanaCreated ? { address: SOL_CM, collectionAddress: SOL_COLL } : {},
        },
      }
    : {
        target: 'evm',
        evm: {
          chainId: 84532,
          rpcUrl: 'https://sepolia.base.org',
          maxSupply: 1000,
          royaltyReceiver: ADDR,
          royaltyBps: 500,
          launch: { treasury: ADDR, placeholderUri: 'ipfs://bafyhidden/hidden.json' },
        },
      };
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
    chain,
  };
  const ok = (x) => Promise.resolve(Object.assign({ ok: true }, x || {}));
  // Action methods route through `res(name, okValue)`: returns an error result when the method is
  // in failMethods, otherwise the normal ok value. Read methods stay ok so screens still render.
  const res = (name, x) => (failSet.has(name) ? Promise.resolve({ ok: false, error: `Simulated ${name} failure (QA)` }) : ok(x));
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
    writeConfig: () => res('writeConfig'),
    saveJson: () => ok(),
    saveBase64: () => res('saveBase64'),
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
    readFileBase64: (rel = '') => ok({ base64: palette[hash(rel) % palette.length], mime: 'image/png' }),
    listImages: () => ok({ count: 8 }),
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
    renameFiles: () => res('renameFiles', { renamed: 0 }),
    previewLive: () => res('previewLive', { format: 'png', images: previews }),
    previewEffects: () => ok({ format: 'png', b64: palette[0] }),
    buildWithProgress: () => res('buildWithProgress', { stdout: 'Built 8 editions' }),
    pauseBuild: () => ok(),
    resumeBuild: () => ok(),
    stopBuild: () => ok(),
    onBuildProgress: () => {},
    previewWithProgress: () => ok({ stdout: 'wrote previews' }),
    pausePreview: () => ok(),
    resumePreview: () => ok(),
    stopPreview: () => ok(),
    onPreviewProgress: () => {},
    auditAssets: () => res('auditAssets', { json: {} }),
    auditOutputs: () => res('auditOutputs', { json: {} }),
    run: () => res('run', { stdout: '' }),
    openInExplorer: () => ok(),
    openExternal: () => ok(),
    ensureDirs: () => ok(),
    deletePath: () => ok(),
    deleteFile: () => ok(),
    listFiles: () => ok({ files: [] }),
    exportSite: () => res('exportSite', { outDir: 'C:/demo/collection/site-export' }),
    deploySite: () => res('deploySite', { url: 'https://demo.vercel.app' }),
    previewSite: () => res('previewSite', { url: 'http://127.0.0.1:5000/' }),
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
    packsImport: () => res('packsImport', { pack: { id: 'pack-new', name: 'New Pack', kind: 'pack', builtin: false } }),
    packsDelete: () => res('packsDelete'),
    // --- Phase-L launch (drives the Launch screen's status + sale-management surfaces) ---
    launchStatus: () => ok({ json: launchStatus }),
    launchEstimate: () => res('launchEstimate', { json: { deployer: ADDR, balanceEth: '0.4213', costEth: '0.0127', sufficient: true, chainId: 84532, testnet: true } }),
    launchDeploy: () => res('launchDeploy', { json: { address: ADDR, txHash: '0xabc' } }),
    launchSetCaps: () => res('launchSetCaps', { json: { txHash: '0xabc' } }),
    launchSetPrices: () => res('launchSetPrices', { json: { txHash: '0xabc' } }),
    launchSetPhase: () => res('launchSetPhase', { json: { txHash: '0xabc' } }),
    launchReveal: () => res('launchReveal', { json: { txHash: '0xabc' } }),
    launchFreeze: () => res('launchFreeze', { json: { txHash: '0xabc' } }),
    launchWithdraw: () => res('launchWithdraw', { json: { txHash: '0xabc' } }),
    launchSetAllowlist: () => res('launchSetAllowlist', { json: { root: '0xroot', count: 3, txHash: '0xabc' } }),
    launchConsole: () => res('launchConsole', { url: 'http://127.0.0.1:7777/' }),
    // --- Solana Launch (Candy Machine) ---
    solanaLaunchStatus: () =>
      ok({
        json: solanaCreated
          ? { configured: true, cluster: 'devnet', mainnet: false, candyMachine: SOL_CM, collection: SOL_COLL, authority: ADDR, itemsAvailable: 1000, itemsLoaded: 1000, itemsRedeemed: 128, fullyLoaded: true, soldOut: false }
          : { configured: false, cluster: 'devnet', mainnet: false },
      }),
    solanaCreate: () => res('solanaCreate', { json: { candyMachine: SOL_CM, collection: SOL_COLL, itemsAvailable: 1000 } }),
    solanaInsertItems: () => res('solanaInsertItems', { json: { inserted: 1000, candyMachine: SOL_CM } }),
  };
}
