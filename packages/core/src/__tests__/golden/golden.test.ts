import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import os from 'node:os';
import fs from 'node:fs/promises';
import fssync from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import pixelmatch from 'pixelmatch';
import { compositeLayers, type CompositeLayerInput, type CompositeOptions } from '../../compositor.js';

// Golden visual-regression tests for the compositor. References live in ./refs and
// are committed. Regenerate them after an intentional rendering change with:
//   UPDATE_GOLDEN=1 pnpm -C packages/core test golden
//
// We decode PNGs to raw RGBA with sharp (already a dependency) and compare with
// pixelmatch using a perceptual threshold so harmless cross-platform/libvips
// antialiasing or rounding differences do not cause false failures.

const UPDATE = process.env.UPDATE_GOLDEN === '1';
const REFS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'refs');
const SIZE = 64;

let tmpDir: string;
let RED: string;
let BLUE: string;

async function solidPng(file: string, rgba: { r: number; g: number; b: number; alpha: number }): Promise<void> {
  const buf = await sharp({ create: { width: SIZE, height: SIZE, channels: 4, background: rgba } })
    .png()
    .toBuffer();
  await fs.writeFile(file, buf);
}

async function toRaw(buf: Buffer): Promise<{ data: Buffer; width: number; height: number }> {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

/** Compare a freshly composited buffer to a committed golden PNG (or write it under UPDATE_GOLDEN). */
async function expectGolden(name: string, actual: Buffer, maxDiffPx = 0): Promise<void> {
  const refPath = path.join(REFS_DIR, `${name}.png`);
  if (UPDATE || !fssync.existsSync(refPath)) {
    await fs.mkdir(REFS_DIR, { recursive: true });
    await fs.writeFile(refPath, actual);
    return;
  }
  const ref = await toRaw(await fs.readFile(refPath));
  const act = await toRaw(actual);
  expect(act.width).toBe(ref.width);
  expect(act.height).toBe(ref.height);
  const diff = pixelmatch(act.data, ref.data, undefined, ref.width, ref.height, { threshold: 0.1 });
  expect(diff).toBeLessThanOrEqual(maxDiffPx);
}

const baseOpts: CompositeOptions = { width: SIZE, height: SIZE, background: 'transparent', format: 'png' };

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'conkernftz-golden-'));
  RED = path.join(tmpDir, 'red.png');
  BLUE = path.join(tmpDir, 'blue.png');
  await solidPng(RED, { r: 255, g: 0, b: 0, alpha: 1 });
  await solidPng(BLUE, { r: 0, g: 0, b: 255, alpha: 1 });
});

afterAll(async () => {
  try {
    if (tmpDir && tmpDir.startsWith(os.tmpdir())) await fs.rm(tmpDir, { recursive: true, force: true });
  } catch {}
});

describe('compositor golden images', () => {
  it('multiply blend (Sharp fast path)', async () => {
    const layers: CompositeLayerInput[] = [{ path: RED }, { path: BLUE, blend: 'multiply' }];
    await expectGolden('multiply', await compositeLayers(layers, baseOpts), 0);
  });

  it('screen blend (Sharp fast path)', async () => {
    const layers: CompositeLayerInput[] = [{ path: RED }, { path: BLUE, blend: 'screen' }];
    await expectGolden('screen', await compositeLayers(layers, baseOpts), 0);
  });

  it('subtract blend (CPU fallback path)', async () => {
    const layers: CompositeLayerInput[] = [{ path: RED }, { path: BLUE, blend: 'subtract' }];
    await expectGolden('subtract-cpu', await compositeLayers(layers, baseOpts), 0);
  });

  it('half opacity overlay', async () => {
    const layers: CompositeLayerInput[] = [{ path: RED }, { path: BLUE, opacity: 0.5 }];
    await expectGolden('opacity-half', await compositeLayers(layers, baseOpts), 0);
  });

  it('integer pixel offset', async () => {
    const layers: CompositeLayerInput[] = [{ path: RED }, { path: BLUE, offsetX: 16, offsetY: 16 }];
    await expectGolden('offset', await compositeLayers(layers, baseOpts), 0);
  });

  it('native fast-path and CPU fallback agree for a shared blend', async () => {
    const layers: CompositeLayerInput[] = [{ path: RED }, { path: BLUE, blend: 'multiply' }];
    const fast = await toRaw(await compositeLayers(layers, baseOpts));
    const cpu = await toRaw(await compositeLayers(layers, { ...baseOpts, forceCpu: true }));
    const diff = pixelmatch(fast.data, cpu.data, undefined, fast.width, fast.height, { threshold: 0.1 });
    // Allow a tiny number of rounding-difference pixels between the two pipelines.
    expect(diff).toBeLessThanOrEqual(8);
  });

  it('applies rotate + scale transforms to a layer', async () => {
    const layers: CompositeLayerInput[] = [
      { path: RED },
      { path: BLUE, effects: { rotate: 45, scale: 0.5 } },
    ];
    const { data } = await toRaw(await compositeLayers(layers, baseOpts));
    const px = (x: number, y: number): [number, number, number, number] => {
      const i = (y * SIZE + x) * 4;
      return [data[i]!, data[i + 1]!, data[i + 2]!, data[i + 3]!];
    };
    // Center is covered by the rotated/scaled blue square; corners fall back to red bg.
    const [cr, cg, cb] = px(SIZE / 2, SIZE / 2);
    expect(cb).toBeGreaterThan(200);
    expect(cr).toBeLessThan(60);
    expect(cg).toBeLessThan(60);
    const [tr, tg, tb] = px(1, 1);
    expect(tr).toBeGreaterThan(200);
    expect(tb).toBeLessThan(60);
    expect(tg).toBeLessThan(60);
  });
});
