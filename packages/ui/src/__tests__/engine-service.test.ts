import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';
import fssync from 'node:fs';
import {
  buildCollection,
  renderLivePreviews,
  renderPreviewsToDisk,
  mergeEffects,
  mergeLayers,
  normalizePreviewOutDir,
} from '../main/engine-service.js';

// Headless functional coverage of the engine boundary. Because this environment
// cannot launch the Electron GUI, these tests exercise the *real* core render path
// through the electron-free engine service against a tiny on-disk fixture — proving
// build/preview actually produce images via @conkernftz/core (loaded by package
// specifier through dynamic-import.js).

// 1x1 red / green PNGs.
const RED_PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAADUlEQVQImWP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==';
const GRN_PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAADUlEQVQImWNg+M/wHwAEAQH/U7xMcQAAAABJRU5ErkJggg==';

async function writePng(p: string, b64: string): Promise<void> {
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, Buffer.from(b64, 'base64'));
}

describe('engine-service pure helpers', () => {
  it('normalizePreviewOutDir appends /preview unless already a preview dir', () => {
    expect(normalizePreviewOutDir('build')).toMatch(/preview$/);
    expect(normalizePreviewOutDir('out/preview')).toBe('out/preview');
    expect(normalizePreviewOutDir('out/previews')).toBe('out/previews');
  });

  it('mergeEffects prefers the override and merges nested objects', () => {
    const merged = mergeEffects({ opacity: 1, glow: { radius: 2 } }, { opacity: 0.5, glow: { color: '#fff' } });
    expect(merged?.opacity).toBe(0.5);
    expect((merged?.glow as Record<string, unknown>)?.radius).toBe(2);
    expect((merged?.glow as Record<string, unknown>)?.color).toBe('#fff');
  });

  it('mergeLayers overlays UI edits onto disk layers by name', () => {
    const layers = mergeLayers([{ name: 'A', path: 'a' }], [{ name: 'A', opacity: 0.3 }]);
    expect(layers).toHaveLength(1);
    expect(layers[0]?.opacity).toBe(0.3);
    expect(layers[0]?.path).toBe('a');
  });
});

describe('engine-service render boundary (real core)', () => {
  let projDir: string;

  beforeAll(async () => {
    projDir = await fs.mkdtemp(path.join(os.tmpdir(), 'conkernftz-engine-'));
    await writePng(path.join(projDir, 'layers', 'background', 'Red#1.png'), RED_PNG);
    await writePng(path.join(projDir, 'layers', 'background', 'Green#1.png'), GRN_PNG);
    await writePng(path.join(projDir, 'layers', 'body', 'Red#1.png'), RED_PNG);
    await writePng(path.join(projDir, 'layers', 'body', 'Green#1.png'), GRN_PNG);
    const cfg = {
      name: 'EngineTest',
      symbol: 'ENG',
      description: 'engine-service fixture',
      editionSize: 2,
      image: { width: 8, height: 8, background: 'transparent' },
      layers: [
        { name: 'Background', path: 'layers/background', rarity: 'filename', required: true },
        { name: 'Body', path: 'layers/body', rarity: 'filename', required: true },
      ],
      rules: {},
      rarity: { mode: 'filenameDelimiter', delimiter: '#', defaultWeight: 1 },
      uniqueness: { hash: 'sha256', ignore: [] },
      export: { outDir: 'build', imageFormat: 'png', includePreviewContactSheet: false },
      storage: { provider: 'local', local: {} },
      chain: {
        target: 'solana',
        solana: {
          cluster: 'devnet',
          rpcUrl: '',
          walletKeypairPath: './keys/solana.json',
          sellerFeeBasisPoints: 0,
          creators: [{ address: '11111111111111111111111111111111', share: 100 }],
          collection: { mint: null },
          isMutable: true,
          usePnft: false,
          rulesetPda: null,
        },
      },
    };
    await fs.writeFile(path.join(projDir, 'foundry.config.json'), JSON.stringify(cfg, null, 2));
  });

  afterAll(async () => {
    if (projDir && projDir.startsWith(os.tmpdir())) {
      await fs.rm(projDir, { recursive: true, force: true }).catch(() => {});
    }
  });

  it('builds a tiny collection (images + json + rarity reports)', async () => {
    const res = await buildCollection({ projectDir: projDir, count: 2, seed: 'engine-build' });
    expect(res.editions).toBe(2);
    expect(fssync.existsSync(path.join(projDir, 'build', 'images', '1.png'))).toBe(true);
    expect(fssync.existsSync(path.join(projDir, 'build', 'json', '1.json'))).toBe(true);
    expect(fssync.existsSync(path.join(projDir, 'build', 'rarity.json'))).toBe(true);
  }, 60000);

  it('renders live previews as base64 PNGs', async () => {
    const res = await renderLivePreviews(projDir, {}, 2, 'engine-live');
    expect(res.format).toBe('png');
    expect(res.images).toHaveLength(2);
    expect(res.images[0]!.length).toBeGreaterThan(0);
  }, 60000);

  it('renders previews to disk', async () => {
    const res = await renderPreviewsToDisk({ projectDir: projDir, count: 2, seed: 'engine-prev' });
    expect(res.written).toBe(2);
    expect(fssync.existsSync(path.join(res.outDir, 'preview_1.png'))).toBe(true);
  }, 60000);
});
