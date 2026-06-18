import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';
import fssync from 'node:fs';
import { buildCollection } from '../project-build.js';
import type { ProjectConfig } from '../project-config.js';

const RED = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGMAAQAABQABDQottQAAAABJRU5ErkJggg==';
const GRN = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGP4DwQAAhoB9m9k5dIAAAAASUVORK5CYII=';

async function writePng(p: string, b64: string): Promise<void> {
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, Buffer.from(b64, 'base64'));
}

function makeConfig(width = 8): ProjectConfig {
  return {
    name: 'CacheTest',
    symbol: 'CT',
    description: '',
    editionSize: 2,
    image: { width, height: 8, background: 'transparent' },
    layers: [
      { name: 'Background', path: 'layers/background', rarity: 'filename', required: true },
      { name: 'Body', path: 'layers/body', rarity: 'filename', required: true },
    ],
    rules: {},
    rarity: { mode: 'filenameDelimiter', delimiter: '#', defaultWeight: 1 },
    uniqueness: { hash: 'sha256', ignore: [] },
    export: { outDir: 'build', imageFormat: 'png', includePreviewContactSheet: false },
  } as unknown as ProjectConfig;
}

describe('incremental build cache', () => {
  let dir: string;

  beforeAll(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'conkernftz-cache-'));
    await writePng(path.join(dir, 'layers/background', 'Red#1.png'), RED);
    await writePng(path.join(dir, 'layers/background', 'Green#1.png'), GRN);
    await writePng(path.join(dir, 'layers/body', 'Red#1.png'), RED);
    await writePng(path.join(dir, 'layers/body', 'Green#1.png'), GRN);
  });

  afterAll(async () => {
    if (dir && dir.startsWith(os.tmpdir())) await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
  });

  it('skips unchanged editions on rebuild and re-renders when an input changes', async () => {
    const cfg = makeConfig(8);
    await buildCollection({ cwd: dir, config: cfg, count: 2, seed: 'cache-test' });
    const img1 = path.join(dir, 'build', 'images', '1.png');
    expect(fssync.existsSync(img1)).toBe(true);
    expect(fssync.existsSync(path.join(dir, 'build', '.build-cache.json'))).toBe(true);

    // Mark the rendered image; a cached rebuild must not overwrite it.
    await fs.writeFile(img1, Buffer.from('CACHED-MARKER'));
    await buildCollection({ cwd: dir, config: cfg, count: 2, seed: 'cache-test' });
    expect((await fs.readFile(img1)).toString()).toBe('CACHED-MARKER');

    // Changing a render input (image width) invalidates the cache → re-render.
    await buildCollection({ cwd: dir, config: makeConfig(16), count: 2, seed: 'cache-test' });
    expect((await fs.readFile(img1)).toString()).not.toBe('CACHED-MARKER');
  }, 60000);

  it('does not skip when cache is disabled', async () => {
    const cfg = makeConfig(8);
    await buildCollection({ cwd: dir, config: cfg, count: 2, seed: 'no-cache', cache: false });
    const img1 = path.join(dir, 'build', 'images', '1.png');
    await fs.writeFile(img1, Buffer.from('CACHED-MARKER'));
    await buildCollection({ cwd: dir, config: cfg, count: 2, seed: 'no-cache', cache: false });
    expect((await fs.readFile(img1)).toString()).not.toBe('CACHED-MARKER');
  }, 60000);
});
