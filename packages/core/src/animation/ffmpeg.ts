import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import ffmpegPath from 'ffmpeg-static';

export interface EncodeVideoOptions {
  fps: number;
  loop?: boolean;
}

/** Write frames to a temp dir, run `fn` with the frame glob, then clean up. */
async function withTempFrames<T>(frames: Buffer[], fn: (pattern: string, outDir: string) => Promise<T>): Promise<T> {
  if (frames.length === 0) throw new Error('ffmpeg encode: no frames provided');
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'conkernftz-ff-'));
  try {
    for (let i = 0; i < frames.length; i++) {
      await fs.writeFile(path.join(dir, `f_${String(i).padStart(5, '0')}.png`), frames[i]!);
    }
    return await fn(path.join(dir, 'f_%05d.png'), dir);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!ffmpegPath) {
      reject(new Error('ffmpeg-static binary not found'));
      return;
    }
    const proc = spawn(ffmpegPath, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    proc.stderr?.on('data', (d) => {
      err += String(d);
    });
    proc.on('error', reject);
    proc.on('exit', (code) =>
      code === 0 ? resolve() : reject(new Error(`ffmpeg exited with code ${code}: ${err.slice(-800)}`)),
    );
  });
}

/** Encode PNG frames into an H.264 MP4 (yuv420p, even dimensions, faststart). */
export async function encodeMp4(frames: Buffer[], opts: EncodeVideoOptions): Promise<Buffer> {
  return withTempFrames(frames, async (pattern, dir) => {
    const out = path.join(dir, 'out.mp4');
    await runFfmpeg([
      '-y',
      '-framerate', String(opts.fps),
      '-i', pattern,
      '-c:v', 'libx264',
      '-pix_fmt', 'yuv420p',
      '-vf', 'pad=ceil(iw/2)*2:ceil(ih/2)*2',
      '-movflags', '+faststart',
      out,
    ]);
    return fs.readFile(out);
  });
}

/** Encode PNG frames into an animated WebP (libwebp_anim). */
export async function encodeAnimatedWebp(frames: Buffer[], opts: EncodeVideoOptions): Promise<Buffer> {
  return withTempFrames(frames, async (pattern, dir) => {
    const out = path.join(dir, 'out.webp');
    await runFfmpeg([
      '-y',
      '-framerate', String(opts.fps),
      '-i', pattern,
      '-c:v', 'libwebp_anim',
      '-lossless', '0',
      '-q:v', '75',
      '-loop', opts.loop === false ? '1' : '0',
      out,
    ]);
    return fs.readFile(out);
  });
}
