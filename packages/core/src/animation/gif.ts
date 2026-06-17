import sharp from 'sharp';
import * as gifencNs from 'gifenc';

export interface EncodeGifOptions {
  fps: number;
  loop?: boolean;
}

// gifenc ships both a CJS build (Node resolves -> exports under `.default`) and an ESM
// build (Vite/vitest resolve -> named exports). Pick whichever shape is present.
function resolveGifenc(): typeof gifencNs {
  const ns = gifencNs as unknown as { default?: typeof gifencNs };
  return (typeof gifencNs.GIFEncoder === 'function' ? gifencNs : ns.default) as typeof gifencNs;
}

/** Encode a sequence of PNG frame buffers into an animated GIF (pure JS, no external process). */
export async function encodeGif(frames: Buffer[], opts: EncodeGifOptions): Promise<Buffer> {
  if (frames.length === 0) throw new Error('encodeGif: no frames provided');
  const { GIFEncoder, quantize, applyPalette } = resolveGifenc();
  const delay = Math.max(1, Math.round(1000 / opts.fps));
  const enc = GIFEncoder();
  for (let i = 0; i < frames.length; i++) {
    const { data, info } = await sharp(frames[i]!).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const rgba = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    const palette = quantize(rgba, 256);
    const index = applyPalette(rgba, palette);
    enc.writeFrame(index, info.width, info.height, {
      palette,
      delay,
      // GIF loop count is read from the first frame: 0 = forever, -1 = play once.
      repeat: i === 0 ? (opts.loop === false ? -1 : 0) : undefined,
    });
  }
  enc.finish();
  return Buffer.from(enc.bytes());
}
