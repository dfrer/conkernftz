import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import os from 'node:os';
import fs from 'node:fs/promises';
import path from 'node:path';
import { LocalProvider } from '../providers/local.js';

describe('LocalProvider', () => {
  let root: string;
  let imagesDir: string;

  beforeAll(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'conkernftz-local-'));
    imagesDir = path.join(root, 'images');
    await fs.mkdir(imagesDir, { recursive: true });
    await fs.writeFile(path.join(imagesDir, '1.png'), Buffer.from([1, 2, 3]));
    await fs.writeFile(path.join(imagesDir, '2.png'), Buffer.from([4, 5, 6]));
  });

  afterAll(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  it('uploads a single file with a content id and copies it', async () => {
    const p = new LocalProvider(root, { outDir: 'out', gatewayBase: 'https://gw.test' });
    const ref = await p.uploadFile(path.join(imagesDir, '1.png'));
    expect(ref.uri).toBe('https://gw.test/files/1.png');
    expect(ref.type).toBe('image/png');
    expect(ref.cid).toMatch(/^[0-9a-f]{64}$/);
    const copied = await fs.readFile(path.join(root, 'out', 'files', '1.png'));
    expect([...copied]).toEqual([1, 2, 3]);
  });

  it('uploads a directory with a resolvable base uri and file map', async () => {
    const p = new LocalProvider(root, { outDir: 'out', gatewayBase: 'https://gw.test' });
    const res = await p.uploadDirectory(imagesDir);
    expect(res.baseUri).toBe('https://gw.test/images/');
    expect(res.files['1.png']).toBe('https://gw.test/images/1.png');
    expect(res.files['2.png']).toBe('https://gw.test/images/2.png');
    expect(res.cid).toMatch(/^[0-9a-f]{64}$/);
    // The base uri + relative path corresponds to a real copied file.
    const copied = await fs.readFile(path.join(root, 'out', 'images', '2.png'));
    expect([...copied]).toEqual([4, 5, 6]);
  });

  it('falls back to file:// URIs when no gatewayBase is given', async () => {
    const p = new LocalProvider(root, { outDir: 'out2' });
    const res = await p.uploadDirectory(imagesDir);
    expect(res.baseUri.startsWith('file://')).toBe(true);
    expect(res.baseUri.endsWith('/images/')).toBe(true);
  });
});
