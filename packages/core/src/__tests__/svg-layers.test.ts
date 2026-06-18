import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import sharp from 'sharp';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { compositeLayers } from '../../src/compositor.js';
import { loadLayerCatalog } from '../../src/catalog.js';
import type { LayerSpec } from '../../src/types.js';

const RED_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><rect width="20" height="20" fill="#ff0000"/></svg>';

let dir: string;
let svgPath: string;

async function centerPixel(buf: Buffer): Promise<{ r: number; g: number; b: number; a: number }> {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const i = (Math.floor(info.height / 2) * info.width + Math.floor(info.width / 2)) * info.channels;
  return { r: data[i]!, g: data[i + 1]!, b: data[i + 2]!, a: data[i + 3]! };
}

beforeAll(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'svg-'));
  await fs.mkdir(path.join(dir, 'layers', 'bg'), { recursive: true });
  svgPath = path.join(dir, 'layers', 'bg', 'Red.svg');
  await fs.writeFile(svgPath, RED_SVG);
});
afterAll(async () => {
  await fs.rm(dir, { recursive: true, force: true });
});

describe('SVG / vector layers', () => {
  it('includes .svg assets in the layer catalog', async () => {
    const cat = await loadLayerCatalog(dir, [{ name: 'bg', path: 'layers/bg' } as unknown as LayerSpec], {
      mode: 'filenameDelimiter',
      delimiter: '#',
      defaultWeight: 1,
    });
    expect(cat[0]!.options.map((o) => o.value)).toContain('Red');
  });

  it('rasterizes an SVG layer at the target size with its fill color', async () => {
    const out = await compositeLayers([{ path: svgPath }], {
      width: 64,
      height: 64,
      background: 'transparent',
      format: 'png',
    });
    const meta = await sharp(out).metadata();
    expect(meta.width).toBe(64);
    expect(meta.height).toBe(64);
    const px = await centerPixel(out);
    expect(px.r).toBeGreaterThan(200);
    expect(px.g).toBeLessThan(60);
    expect(px.b).toBeLessThan(60);
    expect(px.a).toBeGreaterThan(200);
  });
});
