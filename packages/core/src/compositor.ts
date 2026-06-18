import sharp from 'sharp';
import type { BlendMode } from './types.js';
import type { ResolvedEffects } from './effects.js';

export type SharpBlendMode =
  | 'clear'
  | 'source'
  | 'over'
  | 'in'
  | 'out'
  | 'atop'
  | 'dest'
  | 'dest-over'
  | 'dest-in'
  | 'dest-out'
  | 'dest-atop'
  | 'xor'
  | 'add'
  | 'saturate'
  | 'multiply'
  | 'screen'
  | 'overlay'
  | 'darken'
  | 'lighten'
  | 'colour-dodge'
  | 'color-dodge'
  | 'colour-burn'
  | 'color-burn'
  | 'hard-light'
  | 'soft-light'
  | 'difference'
  | 'exclusion';

export interface CompositeLayerInput {
  path: string; // absolute path to image asset
  blend?: BlendMode;
  opacity?: number; // 0..1 (applied to the whole layer group)
  offsetX?: number; // pixels
  offsetY?: number; // pixels
  effects?: ResolvedEffects; // optional visual effects and per-layer controls
}

export interface CompositeOptions {
  width: number;
  height: number;
  background?: string; // color or 'transparent'
  // Output format for the final composited image. Defaults to 'png'.
  // Note: Intermediate buffers may still use PNG for correctness/performance.
  format?: 'png' | 'webp';
  // Experimental: super sample by rendering at N× and downscaling
  superSample?: number; // 1..4
  // Experimental: force CPU compositor even if all blends are supported by Sharp
  forceCpu?: boolean;
}

export async function compositeLayers(
  layers: CompositeLayerInput[],
  options: CompositeOptions,
): Promise<Buffer> {
  const outFormat: 'png' | 'webp' = options.format === 'webp' ? 'webp' : 'png';
  const scale = Math.max(1, Math.min(4, Math.floor(options.superSample ?? 1)));
  const targetWidth = options.width;
  const targetHeight = options.height;
  const workWidth = Math.max(1, Math.round(targetWidth * scale));
  const workHeight = Math.max(1, Math.round(targetHeight * scale));
  // If any layer requests a blend mode that Sharp does not support natively,
  // switch to the CPU compositor to ensure visual parity with Photoshop-like modes.
  const anyUnsupported = layers.some((l) => {
    const desired = (l.blend ?? l.effects?.blend ?? 'normal') as BlendMode;
    return mapBlendModeToSharp(desired) === null;
  });
  const useCpu = !!options.forceCpu || anyUnsupported;

  if (!useCpu) {
    // Fast path: all blends supported natively by Sharp
    const base = sharp({
      create: {
        width: workWidth,
        height: workHeight,
        channels: 4,
        background:
          options.background && options.background !== 'transparent'
            ? options.background
            : { r: 0, g: 0, b: 0, alpha: 0 },
      },
    });

    const composites: sharp.OverlayOptions[] = [];
    for (const layer of layers) {
      const group = await renderLayerGroup(layer, { ...options, width: workWidth, height: workHeight });
      const sharpBlend = mapBlendModeToSharp(layer.blend ?? layer.effects?.blend ?? 'normal');
      // Group-level opacity scaling
      let groupBuf = group;
      const op = layer.opacity ?? layer.effects?.opacity;
      if (op !== undefined && op >= 0 && op <= 1 && op !== 1) {
        groupBuf = await sharp(groupBuf).ensureAlpha().linear([1, 1, 1, clamp01(op)], [0, 0, 0, 0]).toBuffer();
      }
      // If rotate/scale is used, translation has already been applied inside renderLayerGroup
      // to avoid edge clipping. In that case, place the group at (0,0).
      const usesInternalTransform = (layer.effects?.rotate !== undefined) || (layer.effects?.scale !== undefined);
      const offX = layer.offsetX ?? layer.effects?.offsetX ?? 0;
      const offY = layer.offsetY ?? layer.effects?.offsetY ?? 0;
      composites.push({
        input: groupBuf,
        top: usesInternalTransform ? 0 : Math.round(offY * scale),
        left: usesInternalTransform ? 0 : Math.round(offX * scale),
        blend: (sharpBlend as sharp.OverlayOptions['blend']) ?? 'over',
      });
    }

    // Compose at work resolution as PNG, then downscale+encode
    const bigPng = await base.composite(composites).png().toBuffer();
    const resized = await sharp(bigPng)
      .resize(targetWidth, targetHeight, { fit: 'fill' })
      [outFormat === 'webp' ? 'webp' : 'png'](outFormat === 'webp' ? { quality: 100 } : {})
      .toBuffer();
    return resized;
  }

  // CPU fallback path: supports advanced Photoshop-like modes
  // Pre-scale offsets for CPU path when supersampling; avoid double-translation by composing at (0,0)
  // for layers using internal transform, but keep their original offsets so renderLayerGroup can apply them.
  const cpuLayers: CompositeLayerInput[] = layers.map((layer) => {
    const usesInternalTransform = (layer.effects?.rotate !== undefined) || (layer.effects?.scale !== undefined);
    if (usesInternalTransform) {
      // Keep offsets as-is; renderLayerGroup will apply them, compositor will place at (0,0)
      return { ...layer };
    }
    const offX = layer.offsetX ?? layer.effects?.offsetX ?? 0;
    const offY = layer.offsetY ?? layer.effects?.offsetY ?? 0;
    return { ...layer, offsetX: Math.round(offX * scale), offsetY: Math.round(offY * scale) };
  });
  const cpuOut = await compositeLayersCpu(cpuLayers, { ...options, width: workWidth, height: workHeight, format: 'png' });
  const finalBuf = await sharp(cpuOut)
    .resize(targetWidth, targetHeight, { fit: 'fill' })
    [outFormat === 'webp' ? 'webp' : 'png'](outFormat === 'webp' ? { quality: 100 } : {})
    .toBuffer();
  return finalBuf;
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 1;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

/** Parse a #rgb / #rrggbb hex color to 0-255 channels (black on anything unparseable). */
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  let h = (hex || '').trim().replace(/^#/, '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (h.length !== 6 || /[^0-9a-fA-F]/.test(h)) return { r: 0, g: 0, b: 0 };
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

// Map our extended BlendMode to Sharp's native modes where possible.
// For modes not supported by Sharp, return null to signal future CPU fallback.
function mapBlendModeToSharp(mode: BlendMode): sharp.OverlayOptions['blend'] | null {
  switch (mode) {
    case 'normal':
    case 'over':
      return 'over';
    case 'clear':
      return 'clear';
    case 'source':
      return 'source';
    case 'in':
      return 'in';
    case 'out':
      return 'out';
    case 'atop':
      return 'atop';
    case 'dest':
      return 'dest';
    case 'dest-over':
      return 'dest-over';
    case 'dest-in':
      return 'dest-in';
    case 'dest-out':
      return 'dest-out';
    case 'dest-atop':
      return 'dest-atop';
    case 'xor':
      return 'xor';
    case 'add':
    case 'linear-dodge':
      return 'add';
    case 'saturate':
      return 'saturate';
    case 'multiply':
      return 'multiply';
    case 'screen':
      return 'screen';
    case 'overlay':
      return 'overlay';
    case 'darken':
      return 'darken';
    case 'lighten':
      return 'lighten';
    case 'color-dodge':
    case 'colour-dodge':
      return 'colour-dodge';
    case 'color-burn':
    case 'colour-burn':
      return 'colour-burn';
    case 'hard-light':
      return 'hard-light';
    case 'soft-light':
      return 'soft-light';
    case 'difference':
      return 'difference';
    case 'exclusion':
      return 'exclusion';
    // Not natively supported by sharp. We'll return null for now.
    case 'subtract':
    case 'divide':
    case 'linear-burn':
    case 'vivid-light':
    case 'linear-light':
    case 'pin-light':
    case 'hard-mix':
    case 'darker-color':
    case 'lighter-color':
    case 'hue':
    case 'saturation':
    case 'color':
    case 'luminosity':
      return null;
    default:
      return 'over';
  }
}

async function compositeLayersCpu(
  layers: CompositeLayerInput[],
  options: CompositeOptions,
): Promise<Buffer> {
  const width = options.width;
  const height = options.height;
  const outFormat: 'png' | 'webp' = options.format === 'webp' ? 'webp' : 'png';

  // Make initial background in raw RGBA
  const baseRaw = await sharp({
    create: {
      width,
      height,
      channels: 4,
      background:
        options.background && options.background !== 'transparent'
          ? options.background
          : { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .ensureAlpha()
    .raw()
    .toBuffer();

  let outPixels = new Uint8ClampedArray(baseRaw.buffer, baseRaw.byteOffset, baseRaw.byteLength);

  for (const layer of layers) {
    // Render layer + effects to a flattened RGBA buffer
    const group = await renderLayerGroup(layer, options);
    let prepared = sharp(group).ensureAlpha();
    const op = layer.opacity ?? layer.effects?.opacity;
    if (op !== undefined && op >= 0 && op <= 1 && op !== 1) {
      prepared = prepared.linear([1, 1, 1, clamp01(op)], [0, 0, 0, 0]);
    }
    const overlayRaw = await prepared.raw().toBuffer();
    const overlayPixels = new Uint8ClampedArray(overlayRaw.buffer, overlayRaw.byteOffset, overlayRaw.byteLength);

    const mode = layer.blend ?? layer.effects?.blend ?? 'normal';
    const opacity = 1; // already applied above
    // If rotate/scale is used, translation has already been applied inside renderLayerGroup
    // to avoid edge clipping. In that case, compose at (0,0).
    const usesInternalTransform = (layer.effects?.rotate !== undefined) || (layer.effects?.scale !== undefined);
    const offX = usesInternalTransform ? 0 : Math.round(layer.offsetX ?? layer.effects?.offsetX ?? 0);
    const offY = usesInternalTransform ? 0 : Math.round(layer.offsetY ?? layer.effects?.offsetY ?? 0);
    outPixels = blendPixelArrays(outPixels, overlayPixels, width, height, mode, opacity, offX, offY);
  }

  const encoded = await sharp(Buffer.from(outPixels), {
    raw: { width, height, channels: 4 },
  })
    [outFormat === 'webp' ? 'webp' : 'png']()
    .toBuffer();
  return encoded;
}

// Render a single layer and its effects into a flattened RGBA buffer the size of the canvas,
// on a transparent background. The returned buffer can be composited with the requested blend
// mode and offsets.
async function renderLayerGroup(layer: CompositeLayerInput, options: CompositeOptions): Promise<Buffer> {
  const width = options.width;
  const height = options.height;
  let base = sharp(layer.path).resize(width, height, { fit: 'fill' }).ensureAlpha();
  const effects = layer.effects;
  const ss = Math.max(1, Math.min(4, Math.floor(options.superSample ?? 1)));
  // Base adjustments before any behind/around effects
  if (effects?.modulate) {
    base = base.modulate({
      hue: typeof effects.modulate.hue === 'number' ? effects.modulate.hue : undefined,
      saturation: typeof effects.modulate.saturation === 'number' ? effects.modulate.saturation : undefined,
      brightness: typeof effects.modulate.brightness === 'number' ? effects.modulate.brightness : undefined,
    });
  }
  if (effects?.recolor) {
    const lo = hexToRgb(effects.recolor.low ?? '#000000');
    const hi = hexToRgb(effects.recolor.high ?? '#ffffff');
    // Duotone gradient map: collapse RGB to luminance (Rec.709) in all three channels via
    // recomb, then map that luminance linearly onto the low→high ramp per channel. Alpha is
    // left untouched (multiplier 1, offset 0), so transparency is preserved.
    const lr = 0.2126;
    const lg = 0.7152;
    const lb = 0.0722;
    base = base
      .recomb([
        [lr, lg, lb],
        [lr, lg, lb],
        [lr, lg, lb],
      ])
      .linear([(hi.r - lo.r) / 255, (hi.g - lo.g) / 255, (hi.b - lo.b) / 255, 1], [lo.r, lo.g, lo.b, 0]);
  }
  if (typeof effects?.blur === 'number' && effects.blur > 0) {
    base = base.blur(Math.max(0, effects.blur));
  }
  let baseBuf = await base.png().toBuffer();

  // Apply pre-transform (scale, rotate) on the flattened base content
  if (effects?.scale !== undefined || effects?.rotate !== undefined) {
    const translateX = (typeof layer.offsetX === 'number' ? layer.offsetX : layer.effects?.offsetX ?? 0) * ss;
    const translateY = (typeof layer.offsetY === 'number' ? layer.offsetY : layer.effects?.offsetY ?? 0) * ss;
    const transformed = await applyScaleAndRotate(baseBuf, width, height, effects?.scale, effects?.rotate, translateX, translateY);
    baseBuf = transformed.buffer;
  }

  const overlays: sharp.OverlayOptions[] = [];

  // Shadow (behind)
  // Note: effects referenced as const above
  if (effects?.shadow) {
    const sil = await makeSilhouetteFromBuffer(baseBuf, width, height, effects.shadow.color ?? '#000000');
    let shadowBuf = await sharp(sil)
      .ensureAlpha()
      .linear([1, 1, 1, clamp01(effects.shadow.opacity ?? 0.35)], [0, 0, 0, 0])
      .blur(Math.max(0, effects.shadow.blur ?? 16))
      .png()
      .toBuffer();
    // Offset shadow
    const offY = Math.round(effects.shadow.offsetY ?? 8);
    const offX = Math.round(effects.shadow.offsetX ?? 8);
    // If inner shadow, mask by original silhouette
    if (effects.shadow.inner) {
      const maskSil = await makeSilhouetteFromBuffer(baseBuf, width, height, '#ffffff');
      shadowBuf = await sharp(shadowBuf).composite([{ input: maskSil, blend: 'dest-in' }]).png().toBuffer();
      overlays.push({ input: shadowBuf, top: offY, left: offX, blend: 'over' });
    } else {
      overlays.push({ input: shadowBuf, top: offY, left: offX, blend: 'over' });
    }
  }

  // Extrude (behind)
  if (effects?.extrude) {
    const sil = await makeSilhouetteFromBuffer(baseBuf, width, height, effects.extrude.color ?? '#000000');
    const depth = Math.max(1, Math.min(128, effects.extrude.depth ?? 6));
    const angle = (typeof effects.extrude.angle === 'number' ? effects.extrude.angle : 135) * (Math.PI / 180);
    const stepX = Math.round(Math.cos(angle));
    const stepY = Math.round(Math.sin(angle));
    const soften = Math.max(0, effects.extrude.soften ?? 0);
    for (let i = 1; i <= depth; i++) {
      let buf = await sharp(sil)
        .ensureAlpha()
        .linear([1, 1, 1, clamp01(effects.extrude.opacity ?? 0.3)], [0, 0, 0, 0])
        .png()
        .toBuffer();
      if (soften > 0) {
        buf = await sharp(buf).blur(soften).png().toBuffer();
      }
      overlays.push({ input: buf, top: stepY * i, left: stepX * i, blend: 'over' });
    }
  }

  // Glow (behind or inside)
  if (effects?.glow) {
    const sil = await makeSilhouetteFromBuffer(baseBuf, width, height, effects.glow.color ?? '#ffffff');
    let glowBuf = await sharp(sil)
      .ensureAlpha()
      .linear([1, 1, 1, clamp01(effects.glow.opacity ?? 0.4)], [0, 0, 0, 0])
      .blur(Math.max(0, effects.glow.radius ?? 12))
      .png()
      .toBuffer();
    if (effects.glow.inner) {
      const maskSil = await makeSilhouetteFromBuffer(baseBuf, width, height, '#ffffff');
      glowBuf = await sharp(glowBuf).composite([{ input: maskSil, blend: 'dest-in' }]).png().toBuffer();
    }
    overlays.push({ input: glowBuf, top: 0, left: 0, blend: 'over' });
  }

  // Stroke (outside/inside/center)
  if (effects?.stroke) {
    const widthPx = Math.max(1, Math.min(64, effects.stroke.width ?? 2));
    const opacity = clamp01(effects.stroke.opacity ?? 1);
    const color = effects.stroke.color ?? '#000000';
    const position = effects.stroke.position ?? 'outside';
    const silColor = await makeSilhouetteFromBuffer(baseBuf, width, height, color);
    const expOutside = await makeExpandedSilhouette(silColor, width, height, opacity, widthPx);
    const origMask = await makeSilhouetteFromBuffer(baseBuf, width, height, '#ffffff');
    if (position === 'outside') {
      // outside ring = expanded - original
      const outsideRing = await sharp(expOutside).composite([{ input: origMask, blend: 'dest-out' }]).png().toBuffer();
      overlays.push({ input: outsideRing, top: 0, left: 0, blend: 'over' });
    } else if (position === 'inside') {
      // inside ring = expanded ∩ original
      const insideRing = await sharp(expOutside).composite([{ input: origMask, blend: 'dest-in' }]).png().toBuffer();
      overlays.push({ input: insideRing, top: 0, left: 0, blend: 'over' });
    } else {
      // center = half inside + half outside
      const halfOut = Math.ceil(widthPx / 2);
      const halfIn = Math.floor(widthPx / 2);
      const expOut = await makeExpandedSilhouette(silColor, width, height, opacity, halfOut);
      const outRing = await sharp(expOut).composite([{ input: origMask, blend: 'dest-out' }]).png().toBuffer();
      const expIn = await makeExpandedSilhouette(silColor, width, height, opacity, halfIn);
      const inRing = await sharp(expIn).composite([{ input: origMask, blend: 'dest-in' }]).png().toBuffer();
      const merged = await sharp({ create: { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
        .composite([{ input: outRing }, { input: inRing }])
        .png()
        .toBuffer();
      overlays.push({ input: merged, top: 0, left: 0, blend: 'over' });
    }
  }

  // Base content last
  // Optional color overlay applied atop base content, then base
  if (effects?.colorOverlay) {
    const sil = await makeSilhouette(layer.path, width, height, effects.colorOverlay.color ?? '#ffffff');
    const colBuf = await sharp(sil)
      .ensureAlpha()
      .linear([1, 1, 1, clamp01(effects.colorOverlay.opacity ?? 0.25)], [0, 0, 0, 0])
      .png()
      .toBuffer();
    const blend = (effects.colorOverlay.blend as sharp.OverlayOptions['blend']) || 'over';
    overlays.push({ input: colBuf, top: 0, left: 0, blend });
  }
  overlays.push({ input: baseBuf, top: 0, left: 0, blend: 'over' });

  const transparent = sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  });
  const out = await transparent.composite(overlays).png().toBuffer();
  return out;
}

// Apply scale (around center), then rotation (around center), then translation by cropping/padding once.
async function applyScaleAndRotate(
  input: Buffer,
  width: number,
  height: number,
  scale?: number,
  rotate?: number,
  translateX?: number,
  translateY?: number,
): Promise<{ buffer: Buffer; offsetXAdjust: number; offsetYAdjust: number }> {
  let buf = input;
  const offsetXAdjust = 0;
  const offsetYAdjust = 0;

  const desiredX = Number.isFinite(translateX) ? Math.round(translateX!) : 0;
  const desiredY = Number.isFinite(translateY) ? Math.round(translateY!) : 0;

  // Step 1: scale
  let curW = width;
  let curH = height;
  if (typeof scale === 'number' && Number.isFinite(scale) && scale > 0 && scale !== 1) {
    curW = Math.max(1, Math.round(width * scale));
    curH = Math.max(1, Math.round(height * scale));
    buf = await sharp(buf).resize(curW, curH, { fit: 'fill' }).ensureAlpha().png().toBuffer();
  }

  // Step 2: rotate (around center)
  if (typeof rotate === 'number' && Number.isFinite(rotate) && rotate % 360 !== 0) {
    const rotated = await sharp(buf)
      .rotate(rotate, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();
    buf = rotated;
    const meta = await sharp(buf).metadata();
    curW = meta.width ?? curW;
    curH = meta.height ?? curH;
  }

  // Step 3: place transformed buffer at absolute top-left (desiredX, desiredY) relative to the canvas,
  // supporting negative offsets by cropping the source to the visible intersection.
  const srcLeft = Math.max(0, -desiredX);
  const srcTop = Math.max(0, -desiredY);
  const dstLeft = Math.max(0, desiredX);
  const dstTop = Math.max(0, desiredY);
  const maxW = Math.min(curW - srcLeft, width - dstLeft);
  const maxH = Math.min(curH - srcTop, height - dstTop);
  const outCanvas = sharp({ create: { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } });
  if (maxW > 0 && maxH > 0) {
    const visible = await sharp(buf)
      .extract({ left: srcLeft, top: srcTop, width: maxW, height: maxH })
      .ensureAlpha()
      .png()
      .toBuffer();
    buf = await outCanvas.composite([{ input: visible, left: dstLeft, top: dstTop, blend: 'over' }]).png().toBuffer();
  } else {
    // Fully off-canvas: return transparent canvas
    buf = await outCanvas.png().toBuffer();
  }

  return { buffer: buf, offsetXAdjust, offsetYAdjust };
}

// Create a solid-color silhouette of the input image using its alpha channel.
async function makeSilhouette(imgPath: string, width: number, height: number, color: string): Promise<Buffer> {
  const src = sharp(imgPath).resize(width, height, { fit: 'fill' }).ensureAlpha();
  const alpha = await src.clone().extractChannel(3).png().toBuffer();
  const colorImg = sharp({
    create: {
      width,
      height,
      channels: 3,
      background: color,
    },
  });
  const silhouette = await colorImg.joinChannel(alpha).png().toBuffer();
  return silhouette;
}

// Create silhouette from an already prepared buffer (same canvas size)
async function makeSilhouetteFromBuffer(img: Buffer, width: number, height: number, color: string): Promise<Buffer> {
  const src = sharp(img).resize(width, height, { fit: 'fill' }).ensureAlpha();
  const alpha = await src.clone().extractChannel(3).png().toBuffer();
  const colorImg = sharp({
    create: {
      width,
      height,
      channels: 3,
      background: color,
    },
  });
  const silhouette = await colorImg.joinChannel(alpha).png().toBuffer();
  return silhouette;
}

// Expand a silhouette by offsetting copies; uses step spacing and slight blur for large widths for performance.
async function makeExpandedSilhouette(silhouette: Buffer, width: number, height: number, opacity: number, px: number): Promise<Buffer> {
  const dirs: Array<[number, number]> = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
    [-1, -1],
    [-1, 1],
    [1, -1],
    [1, 1],
  ];
  const step = px > 24 ? 3 : px > 12 ? 2 : 1;
  const overlays: sharp.OverlayOptions[] = [];
  // Base colored silhouette
  const base = await sharp(silhouette).ensureAlpha().linear([1, 1, 1, clamp01(opacity)], [0, 0, 0, 0]).png().toBuffer();
  for (let d = step; d <= px; d += step) {
    for (const [dx, dy] of dirs) {
      overlays.push({ input: base, top: dy * d, left: dx * d, blend: 'over' });
    }
  }
  const transparent = sharp({ create: { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } });
  let out = await transparent.composite(overlays).png().toBuffer();
  if (step > 1) {
    out = await sharp(out).blur(step * 0.75).png().toBuffer();
  }
  return out;
}

function blendPixelArrays(
  base: Uint8ClampedArray,
  src: Uint8ClampedArray,
  width: number,
  height: number,
  mode: BlendMode,
  opacity: number,
  offsetX: number,
  offsetY: number,
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(base.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const br = (base[i] ?? 0) / 255;
      const bg = (base[i + 1] ?? 0) / 255;
      const bb = (base[i + 2] ?? 0) / 255;
      const ba = (base[i + 3] ?? 0) / 255;

      const sx = x - offsetX;
      const sy = y - offsetY;
      let sr = 0,
        sg = 0,
        sb = 0,
        sa = 0;
      if (sx >= 0 && sy >= 0 && sx < width && sy < height) {
        const j = (sy * width + sx) * 4;
        sr = (src[j] ?? 0) / 255;
        sg = (src[j + 1] ?? 0) / 255;
        sb = (src[j + 2] ?? 0) / 255;
        sa = ((src[j + 3] ?? 0) / 255) * opacity;
      }

    if (mode === 'clear') {
      // destination-out: erase destination where source exists
      const outA = ba * (1 - sa);
      out[i] = clamp255(br * 255);
      out[i + 1] = clamp255(bg * 255);
      out[i + 2] = clamp255(bb * 255);
      out[i + 3] = clamp255(outA * 255);
      continue;
    }

    let cr = 0;
    let cg = 0;
    let cb = 0;

    if (sa === 0) {
      // No contribution from source
      cr = br; cg = bg; cb = bb;
    } else {
      // Compute blended color (ignoring alpha), then alpha composite
      const f = getBlendFunc(mode);
      if (f) {
        const blended = f({ r: br, g: bg, b: bb }, { r: sr, g: sg, b: sb });
        cr = blended.r;
        cg = blended.g;
        cb = blended.b;
      } else {
        // Fallback to normal
        cr = sr;
        cg = sg;
        cb = sb;
      }
    }

    // Porter-Duff source-over with source alpha sa
    const outA = sa + ba * (1 - sa);
    let outR = 0;
    let outG = 0;
    let outB = 0;
    if (outA > 0) {
      outR = (cr * sa + br * ba * (1 - sa)) / outA;
      outG = (cg * sa + bg * ba * (1 - sa)) / outA;
      outB = (cb * sa + bb * ba * (1 - sa)) / outA;
    }

      out[i] = clamp255(outR * 255);
      out[i + 1] = clamp255(outG * 255);
      out[i + 2] = clamp255(outB * 255);
      out[i + 3] = clamp255(outA * 255);
    }
  }
  return out;
}

function clamp255(x: number): number {
  if (!Number.isFinite(x)) return 0;
  if (x < 0) return 0;
  if (x > 255) return 255;
  return x;
}

type RGB = { r: number; g: number; b: number };
type BlendFunc = (backdrop: RGB, source: RGB) => RGB;

function getBlendFunc(mode: BlendMode): BlendFunc | null {
  switch (mode) {
    case 'normal':
    case 'over':
      return (_b, s) => s;
    case 'multiply':
      return (b, s) => ({ r: b.r * s.r, g: b.g * s.g, b: b.b * s.b });
    case 'screen':
      return (b, s) => ({ r: 1 - (1 - b.r) * (1 - s.r), g: 1 - (1 - b.g) * (1 - s.g), b: 1 - (1 - b.b) * (1 - s.b) });
    case 'overlay':
      return (b, s) => ({
        r: b.r < 0.5 ? 2 * b.r * s.r : 1 - 2 * (1 - b.r) * (1 - s.r),
        g: b.g < 0.5 ? 2 * b.g * s.g : 1 - 2 * (1 - b.g) * (1 - s.g),
        b: b.b < 0.5 ? 2 * b.b * s.b : 1 - 2 * (1 - b.b) * (1 - s.b),
      });
    case 'darken':
      return (b, s) => ({ r: Math.min(b.r, s.r), g: Math.min(b.g, s.g), b: Math.min(b.b, s.b) });
    case 'lighten':
      return (b, s) => ({ r: Math.max(b.r, s.r), g: Math.max(b.g, s.g), b: Math.max(b.b, s.b) });
    case 'color-dodge':
    case 'colour-dodge':
      return (b, s) => ({ r: colorDodge(b.r, s.r), g: colorDodge(b.g, s.g), b: colorDodge(b.b, s.b) });
    case 'color-burn':
    case 'colour-burn':
      return (b, s) => ({ r: colorBurn(b.r, s.r), g: colorBurn(b.g, s.g), b: colorBurn(b.b, s.b) });
    case 'hard-light':
      return (b, s) => ({
        r: s.r < 0.5 ? 2 * b.r * s.r : 1 - 2 * (1 - b.r) * (1 - s.r),
        g: s.g < 0.5 ? 2 * b.g * s.g : 1 - 2 * (1 - b.g) * (1 - s.g),
        b: s.b < 0.5 ? 2 * b.b * s.b : 1 - 2 * (1 - b.b) * (1 - s.b),
      });
    case 'soft-light':
      return (b, s) => ({
        r: softLightChannel(b.r, s.r),
        g: softLightChannel(b.g, s.g),
        b: softLightChannel(b.b, s.b),
      });
    case 'difference':
      return (b, s) => ({ r: Math.abs(b.r - s.r), g: Math.abs(b.g - s.g), b: Math.abs(b.b - s.b) });
    case 'exclusion':
      return (b, s) => ({ r: b.r + s.r - 2 * b.r * s.r, g: b.g + s.g - 2 * b.g * s.g, b: b.b + s.b - 2 * b.b * s.b });
    case 'add':
    case 'linear-dodge':
      return (b, s) => ({ r: Math.min(1, b.r + s.r), g: Math.min(1, b.g + s.g), b: Math.min(1, b.b + s.b) });
    case 'subtract':
      return (b, s) => ({ r: Math.max(0, b.r - s.r), g: Math.max(0, b.g - s.g), b: Math.max(0, b.b - s.b) });
    case 'divide':
      return (b, s) => ({ r: divideChannel(b.r, s.r), g: divideChannel(b.g, s.g), b: divideChannel(b.b, s.b) });
    case 'linear-burn':
      return (b, s) => ({ r: Math.max(0, b.r + s.r - 1), g: Math.max(0, b.g + s.g - 1), b: Math.max(0, b.b + s.b - 1) });
    case 'linear-light':
      return (b, s) => ({ r: clamp01(b.r + 2 * s.r - 1), g: clamp01(b.g + 2 * s.g - 1), b: clamp01(b.b + 2 * s.b - 1) });
    case 'vivid-light':
      return (b, s) => ({
        r: vividLightChannel(b.r, s.r),
        g: vividLightChannel(b.g, s.g),
        b: vividLightChannel(b.b, s.b),
      });
    case 'pin-light':
      return (b, s) => ({
        r: pinLightChannel(b.r, s.r),
        g: pinLightChannel(b.g, s.g),
        b: pinLightChannel(b.b, s.b),
      });
    case 'hard-mix':
      return (b, s) => ({
        r: hardMixChannel(b.r, s.r),
        g: hardMixChannel(b.g, s.g),
        b: hardMixChannel(b.b, s.b),
      });
    case 'darker-color':
      return (b, s) => (luminance(s) < luminance(b) ? s : b);
    case 'lighter-color':
      return (b, s) => (luminance(s) > luminance(b) ? s : b);
    case 'hue':
      return (b, s) => setHslComponent(b, s, 'h');
    case 'saturation':
      return (b, s) => setHslComponent(b, s, 's');
    case 'color':
      return (b, s) => setHslComponent(b, s, 'hs');
    case 'luminosity':
      return (b, s) => setHslComponent(b, s, 'l');
    default:
      return null;
  }
}

function colorDodge(b: number, s: number): number {
  if (s >= 1) return 1;
  return clamp01(b / (1 - s));
}

function colorBurn(b: number, s: number): number {
  if (s <= 0) return 0;
  return 1 - clamp01((1 - b) / s);
}

function divideChannel(b: number, s: number): number {
  const eps = 1e-6;
  return clamp01(b / Math.max(eps, s));
}

function softLightChannel(b: number, s: number): number {
  // Approximation: (1 - 2S)B^2 + 2SB
  return clamp01((1 - 2 * s) * b * b + 2 * s * b);
}

function vividLightChannel(b: number, s: number): number {
  if (s < 0.5) {
    // Color burn
    return colorBurn(b, 2 * s);
  }
  // Color dodge
  return colorDodge(b, 2 * (1 - s));
}

function pinLightChannel(b: number, s: number): number {
  if (s < 0.5) {
    return Math.min(b, 2 * s);
  }
  return Math.max(b, 2 * s - 1);
}

function hardMixChannel(b: number, s: number): number {
  const v = vividLightChannel(b, s);
  return v < 0.5 ? 0 : 1;
}

function luminance(rgb: RGB): number {
  // sRGB luminance approximation
  return rgb.r * 0.2126 + rgb.g * 0.7152 + rgb.b * 0.0722;
}

function setHslComponent(backdrop: RGB, source: RGB, which: 'h' | 's' | 'l' | 'hs'): RGB {
  const bHsl = rgbToHsl(backdrop);
  const sHsl = rgbToHsl(source);
  const out = { h: bHsl.h, s: bHsl.s, l: bHsl.l };
  if (which === 'h') out.h = sHsl.h;
  else if (which === 's') out.s = sHsl.s;
  else if (which === 'l') out.l = sHsl.l;
  else if (which === 'hs') {
    out.h = sHsl.h;
    out.s = sHsl.s;
  }
  return hslToRgb(out);
}

type HSL = { h: number; s: number; l: number };

function rgbToHsl(rgb: RGB): HSL {
  const r = rgb.r;
  const g = rgb.g;
  const b = rgb.b;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  const d = max - min;
  if (d !== 0) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }
  return { h, s, l };
}

function hslToRgb(hsl: HSL): RGB {
  const h = hsl.h;
  const s = hsl.s;
  const l = hsl.l;
  if (s === 0) {
    return { r: l, g: l, b: l };
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const r = hue2rgb(p, q, h + 1 / 3);
  const g = hue2rgb(p, q, h);
  const b = hue2rgb(p, q, h - 1 / 3);
  return { r, g, b };
}

function hue2rgb(p: number, q: number, t: number): number {
  if (t < 0) t += 1;
  if (t > 1) t -= 1;
  if (t < 1 / 6) return p + (q - p) * 6 * t;
  if (t < 1 / 2) return q;
  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
  return p;
}
