import { describe, it, expect, beforeAll } from 'vitest';
import { Window } from 'happy-dom';
import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

// Executes the *built* static mint-site bundle (dist/site-template) in a real DOM and asserts
// it mounts. This is the one test that exercises the shipped artifact, not its inputs — green
// unit tests + typecheck did NOT catch the black-page regressions (a classic entry script
// without `defer` ran before #root existed; a no-data fallback rendered empty blocks) because
// nothing actually ran the bundle in a browser-like environment. We run it with `node:vm`
// (a repo hook blocks the dynamic code-evaluation APIs) against happy-dom globals.

const pkgRoot = path.resolve(__dirname, '../..'); // packages/ui (this test runs in CommonJS context)
const bundlePath = path.join(pkgRoot, 'dist', 'site-template', 'assets', 'index.js');

let bundleCode = '';

beforeAll(() => {
  // The green gate builds before testing, so the artifact normally exists. If it's missing
  // (e.g. running this package's tests without a prior build), build it so the test stays
  // reliable rather than silently skipping.
  if (!fs.existsSync(bundlePath)) {
    const res = spawnSync('pnpm', ['run', 'build:site'], {
      cwd: pkgRoot,
      shell: true,
      stdio: 'inherit',
      timeout: 180000,
    });
    if (res.status !== 0 || !fs.existsSync(bundlePath)) {
      throw new Error('build:site did not produce dist/site-template/assets/index.js');
    }
  }
  bundleCode = fs.readFileSync(bundlePath, 'utf8');
}, 200000);

async function mount(data: unknown) {
  const win = new Window({ url: 'http://localhost/' });
  const host = win.document.createElement('div');
  host.id = 'root';
  win.document.body.appendChild(host);
  if (data !== undefined) (win as unknown as Record<string, unknown>).__CONKER_SITE__ = data;
  let threw: string | null = null;
  try {
    vm.runInContext(bundleCode, vm.createContext(win), { timeout: 15000 });
  } catch (e) {
    threw = String((e as Error)?.message ?? e);
  }
  const root = win.document.getElementById('root');
  // Initial createRoot mount is synchronous, but poll briefly as a safety net.
  for (let i = 0; i < 40 && (!root || root.children.length === 0); i++) {
    await new Promise((r) => setTimeout(r, 50));
  }
  return { threw, root };
}

describe('built static-site bundle', () => {
  it('mounts the default page when no bundle data is present', async () => {
    const { threw, root } = await mount(undefined);
    expect(threw).toBeNull();
    expect(root?.querySelector('[data-testid="site-render"]')).toBeTruthy(); // SiteRenderer mounted
    expect(root?.children.length ?? 0).toBeGreaterThan(0); // not an empty shell
  });

  it('mounts and renders the provided site data (hero + gallery)', async () => {
    const data = {
      version: 1,
      name: 'Smoke Drop',
      images: [],
      experience: { kind: 'cardPack' },
      site: {
        theme: { accent: '#ffb000', background: 'ink', font: 'sans' },
        layout: 'flow',
        blocks: [
          { id: 'h1', kind: 'hero', title: 'SMOKE HERO', subtitle: 's', align: 'center' },
          { id: 'g1', kind: 'gallery', heading: 'Gallery', columns: 3, count: 4 },
        ],
      },
    };
    const { threw, root } = await mount(data);
    expect(threw).toBeNull();
    expect(root?.textContent ?? '').toContain('SMOKE HERO');
    expect(root?.querySelector('.site-gallery')).toBeTruthy();
  });
});
