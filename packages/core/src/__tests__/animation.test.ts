import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import os from 'node:os';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { renderEditionFrames, frameCountFor, hasAnimatedLayers } from '../animation/frames.js';
import { encodeGif } from '../animation/gif.js';
import { encodeMp4, encodeAnimatedWebp } from '../animation/ffmpeg.js';
import type { EditionPick } from '../render-edition.js';
import type { ProjectConfig } from '../project-config.js';
import type { LayerSpec } from '../types.js';

const SIZE = 16;
let tmp: string;
let redPng: string;

const config = { image: { width: SIZE, height: SIZE, background: 'transparent' } } as unknown as ProjectConfig;

async function centerAlpha(buf: Buffer): Promise<number> {
  const { data } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const i = ((SIZE / 2) * SIZE + SIZE / 2) * 4;
  return data[i + 3]!;
}

beforeAll(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'conkernftz-anim-'));
  redPng = path.join(tmp, 'red.png');
  await sharp({ create: { width: SIZE, height: SIZE, channels: 4, background: { r: 255, g: 0, b: 0, alpha: 1 } } })
    .png()
    .toBuffer()
    .then((b) => fs.writeFile(redPng, b));
});

afterAll(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

function picks(): EditionPick[] {
  return [{ layer: 'L', option: { filePath: redPng, value: 'Red', weight: 1 } }];
}

describe('frame math', () => {
  it('frameCountFor rounds fps*duration', () => {
    expect(frameCountFor(4, 1000)).toBe(4);
    expect(frameCountFor(12, 500)).toBe(6);
    expect(frameCountFor(30, 0)).toBe(1); // never below 1
  });

  it('hasAnimatedLayers detects animation blocks', () => {
    expect(hasAnimatedLayers([{ name: 'A', path: 'a' }])).toBe(false);
    expect(hasAnimatedLayers([{ name: 'A', path: 'a', animation: { rotate: { from: 0, to: 90 } } }])).toBe(true);
  });
});

describe('renderEditionFrames', () => {
  const seedArgs = { placementRngSeed: 's:ed:1', assetSeedBase: 's:1', traits: { L: 'Red' } };

  it('animates a layer (opacity ramp produces decreasing alpha)', async () => {
    const layers: LayerSpec[] = [{ name: 'L', path: 'L', animation: { opacity: { from: 1, to: 0 }, loopMode: 'loop', easing: 'linear' } }];
    const frames = await renderEditionFrames({ config, layers, picks: picks(), ...seedArgs, fps: 4, durationMs: 1000 });
    expect(frames.length).toBe(4);
    const alphas = await Promise.all(frames.map(centerAlpha));
    // opacity 1.0, 0.75, 0.5, 0.25 -> strictly decreasing alpha.
    expect(alphas[0]).toBeGreaterThan(alphas[1]!);
    expect(alphas[1]).toBeGreaterThan(alphas[2]!);
    expect(alphas[2]).toBeGreaterThan(alphas[3]!);
  });

  it('produces identical frames when no layer is animated', async () => {
    const layers: LayerSpec[] = [{ name: 'L', path: 'L' }];
    const frames = await renderEditionFrames({ config, layers, picks: picks(), ...seedArgs, fps: 3, durationMs: 1000 });
    expect(frames.length).toBe(3);
    expect(Buffer.compare(frames[0]!, frames[1]!)).toBe(0);
    expect(Buffer.compare(frames[1]!, frames[2]!)).toBe(0);
  });
});

describe('encoders', () => {
  async function frames(n: number): Promise<Buffer[]> {
    const colors = [
      { r: 255, g: 0, b: 0, alpha: 1 },
      { r: 0, g: 255, b: 0, alpha: 1 },
      { r: 0, g: 0, b: 255, alpha: 1 },
      { r: 255, g: 255, b: 0, alpha: 1 },
    ];
    const out: Buffer[] = [];
    for (let i = 0; i < n; i++) {
      out.push(await sharp({ create: { width: SIZE, height: SIZE, channels: 4, background: colors[i % colors.length]! } }).png().toBuffer());
    }
    return out;
  }

  it('encodeGif produces a valid animated GIF', async () => {
    const gif = await encodeGif(await frames(4), { fps: 8, loop: true });
    expect(gif.length).toBeGreaterThan(0);
    expect(gif.subarray(0, 4).toString('latin1')).toBe('GIF8');
  });

  it('encodeMp4 produces a valid MP4 (ffmpeg)', async () => {
    const mp4 = await encodeMp4(await frames(4), { fps: 8 });
    expect(mp4.length).toBeGreaterThan(0);
    expect(mp4.subarray(4, 8).toString('latin1')).toBe('ftyp');
  }, 30000);

  it('encodeAnimatedWebp produces a multi-page WebP (ffmpeg)', async () => {
    const webp = await encodeAnimatedWebp(await frames(4), { fps: 8, loop: true });
    expect(webp.subarray(0, 4).toString('latin1')).toBe('RIFF');
    expect(webp.subarray(8, 12).toString('latin1')).toBe('WEBP');
    const meta = await sharp(webp, { pages: -1 }).metadata();
    expect((meta.pages ?? 1)).toBeGreaterThan(1);
  }, 30000);
});
