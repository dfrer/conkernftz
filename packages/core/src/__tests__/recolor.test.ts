import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import sharp from 'sharp';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { compositeLayers } from '../../src/compositor.js';
import { resolveEffects } from '../../src/effects.js';

let dir: string;
let grayPath: string;
let blackPath: string;

async function solid(file: string, r: number, g: number, b: number): Promise<string> {
  await sharp({ create: { width: 8, height: 8, channels: 4, background: { r, g, b, alpha: 1 } } })
    .png()
    .toFile(file);
  return file;
}

async function centerPixel(buf: Buffer): Promise<{ r: number; g: number; b: number; a: number }> {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const cx = Math.floor(info.width / 2);
  const cy = Math.floor(info.height / 2);
  const i = (cy * info.width + cx) * info.channels;
  return { r: data[i]!, g: data[i + 1]!, b: data[i + 2]!, a: data[i + 3]! };
}

beforeAll(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'recolor-'));
  grayPath = await solid(path.join(dir, 'gray.png'), 128, 128, 128);
  blackPath = await solid(path.join(dir, 'black.png'), 0, 0, 0);
});
afterAll(async () => {
  await fs.rm(dir, { recursive: true, force: true });
});

describe('palette recolor (duotone gradient map)', () => {
  it('maps mid-gray onto the low→high ramp', async () => {
    const out = await compositeLayers([{ path: grayPath, effects: { recolor: { low: '#000000', high: '#ff0000' } } }], {
      width: 8,
      height: 8,
      background: 'transparent',
      format: 'png',
    });
    const px = await centerPixel(out);
    // L=128 → R = 128/255 * 255 = 128, G/B = 0; opaque source stays opaque.
    expect(Math.abs(px.r - 128)).toBeLessThanOrEqual(2);
    expect(px.g).toBeLessThanOrEqual(2);
    expect(px.b).toBeLessThanOrEqual(2);
    expect(px.a).toBeGreaterThan(250);
  });

  it('uses the low color as the floor for black source', async () => {
    const out = await compositeLayers([{ path: blackPath, effects: { recolor: { low: '#3050ff', high: '#ffffff' } } }], {
      width: 8,
      height: 8,
      background: 'transparent',
      format: 'png',
    });
    const px = await centerPixel(out);
    // L=0 → out = low = (48, 80, 255)
    expect(Math.abs(px.r - 48)).toBeLessThanOrEqual(3);
    expect(Math.abs(px.g - 80)).toBeLessThanOrEqual(3);
    expect(Math.abs(px.b - 255)).toBeLessThanOrEqual(3);
  });

  it('applies on the CPU compositor path too (parity)', async () => {
    const out = await compositeLayers([{ path: grayPath, effects: { recolor: { low: '#000000', high: '#ff0000' } } }], {
      width: 8,
      height: 8,
      background: 'transparent',
      format: 'png',
      forceCpu: true,
    });
    const px = await centerPixel(out);
    expect(Math.abs(px.r - 128)).toBeLessThanOrEqual(2);
    expect(px.g).toBeLessThanOrEqual(2);
    expect(px.b).toBeLessThanOrEqual(2);
  });

  it('resolves named presets to low/high colors', () => {
    const r = resolveEffects({ recolor: { preset: 'sepia' } });
    expect(r?.recolor).toEqual({ low: '#2b1d0e', high: '#fff3d6', preset: 'sepia' });
  });

  it('leaves rendering untouched when no recolor is set (no-op)', async () => {
    const out = await compositeLayers([{ path: grayPath, effects: {} }], {
      width: 8,
      height: 8,
      background: 'transparent',
      format: 'png',
    });
    const px = await centerPixel(out);
    expect(px.r).toBe(128);
    expect(px.g).toBe(128);
    expect(px.b).toBe(128);
  });
});
