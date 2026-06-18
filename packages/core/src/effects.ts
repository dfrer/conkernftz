import type { AssetEffects, BlendMode } from './types.js';

export type ResolvedEffects = AssetEffects;

type GlowPreset = {
  color: string;
  radius: number;
  opacity: number;
};
type StrokePreset = {
  color: string;
  width: number;
  opacity: number;
};
type ShadowPreset = {
  color: string;
  blur: number;
  offsetX: number;
  offsetY: number;
  opacity: number;
};
type ExtrudePreset = {
  color: string;
  depth: number;
  angle: number; // degrees
  opacity: number;
  soften: number; // blur amount applied to the stack
};

type OverlayPreset = {
  color: string;
  opacity: number;
  blend?: BlendMode;
};

export const GlowPresets: Record<string, GlowPreset> = {
  subtle: { color: '#ffffff', radius: 6, opacity: 0.25 },
  medium: { color: '#ffffff', radius: 12, opacity: 0.4 },
  strong: { color: '#ffffff', radius: 20, opacity: 0.6 },
  neon: { color: '#00ffff', radius: 24, opacity: 0.85 },
};

export const StrokePresets: Record<string, StrokePreset> = {
  thin: { color: '#000000', width: 1, opacity: 1 },
  medium: { color: '#000000', width: 2, opacity: 1 },
  thick: { color: '#000000', width: 4, opacity: 1 },
  white: { color: '#ffffff', width: 2, opacity: 1 },
};

export const ShadowPresets: Record<string, ShadowPreset> = {
  soft: { color: '#000000', blur: 16, offsetX: 8, offsetY: 8, opacity: 0.35 },
  hard: { color: '#000000', blur: 4, offsetX: 6, offsetY: 6, opacity: 0.55 },
  long: { color: '#000000', blur: 10, offsetX: 16, offsetY: 16, opacity: 0.3 },
};

export const ExtrudePresets: Record<string, ExtrudePreset> = {
  short: { color: '#000000', depth: 4, angle: 135, opacity: 0.35, soften: 0 },
  long: { color: '#000000', depth: 10, angle: 135, opacity: 0.25, soften: 0 },
  isometric: { color: '#000000', depth: 8, angle: 210, opacity: 0.3, soften: 0 },
};

export const ColorOverlayPresets: Record<string, OverlayPreset> = {
  tint: { color: '#00ffff', opacity: 0.25, blend: 'color' },
  shade: { color: '#000000', opacity: 0.25, blend: 'multiply' },
  highlight: { color: '#ffffff', opacity: 0.25, blend: 'screen' },
};

type RecolorPreset = { low: string; high: string };
export const RecolorPresets: Record<string, RecolorPreset> = {
  noir: { low: '#000000', high: '#ffffff' },
  sepia: { low: '#2b1d0e', high: '#fff3d6' },
  blueprint: { low: '#0a1a3f', high: '#cfe3ff' },
  gold: { low: '#3a2a00', high: '#ffd76a' },
  toxic: { low: '#04210a', high: '#8cff5a' },
  ember: { low: '#1a0400', high: '#ff8a3d' },
};

function clamp01(n: number | undefined, fallback: number): number {
  if (typeof n !== 'number' || !Number.isFinite(n)) return fallback;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

function clampInt(n: number | undefined, min: number, max: number, fallback: number): number {
  if (typeof n !== 'number' || !Number.isFinite(n)) return fallback;
  const v = Math.round(n);
  if (v < min) return min;
  if (v > max) return max;
  return v;
}

export function resolveEffects(e?: AssetEffects): ResolvedEffects | undefined {
  if (!e) return undefined;
  const out: ResolvedEffects = {};
  if (e.blend !== undefined) out.blend = e.blend;
  if (e.opacity !== undefined) out.opacity = clamp01(e.opacity, 1);
  if (e.offsetX !== undefined) out.offsetX = Math.round(e.offsetX);
  if (e.offsetY !== undefined) out.offsetY = Math.round(e.offsetY);
  if (e.rotate !== undefined) out.rotate = e.rotate;
  if (e.scale !== undefined) out.scale = e.scale;

  if (e.glow) {
    const presetName = e.glow.preset;
    const preset = presetName ? GlowPresets[presetName] : undefined;
    out.glow = {
      color: e.glow.color ?? preset?.color ?? '#ffffff',
      radius: clampInt(e.glow.radius, 0, 256, preset?.radius ?? 12),
      opacity: clamp01(e.glow.opacity, preset?.opacity ?? 0.4),
      preset: e.glow.preset,
      inner: !!e.glow.inner,
    };
  }

  if (e.stroke) {
    const presetName = e.stroke.preset;
    const preset = presetName ? StrokePresets[presetName] : undefined;
    out.stroke = {
      color: e.stroke.color ?? preset?.color ?? '#000000',
      width: clampInt(e.stroke.width, 1, 64, preset?.width ?? 2),
      opacity: clamp01(e.stroke.opacity, preset?.opacity ?? 1),
      preset: e.stroke.preset,
      position: e.stroke.position,
    };
  }

  if (e.shadow) {
    const presetName = e.shadow.preset;
    const preset = presetName ? ShadowPresets[presetName] : undefined;
    out.shadow = {
      color: e.shadow.color ?? preset?.color ?? '#000000',
      blur: clampInt(e.shadow.blur, 0, 256, preset?.blur ?? 16),
      offsetX: Math.round(e.shadow.offsetX ?? preset?.offsetX ?? 8),
      offsetY: Math.round(e.shadow.offsetY ?? preset?.offsetY ?? 8),
      opacity: clamp01(e.shadow.opacity, preset?.opacity ?? 0.35),
      preset: e.shadow.preset,
      inner: !!e.shadow.inner,
    };
  }

  if (e.extrude) {
    const presetName = e.extrude.preset;
    const preset = presetName ? ExtrudePresets[presetName] : undefined;
    out.extrude = {
      color: e.extrude.color ?? preset?.color ?? '#000000',
      depth: clampInt(e.extrude.depth, 1, 128, preset?.depth ?? 6),
      angle: typeof e.extrude.angle === 'number' ? e.extrude.angle : preset?.angle ?? 135,
      opacity: clamp01(e.extrude.opacity, preset?.opacity ?? 0.3),
      soften: clampInt(e.extrude.soften, 0, 64, preset?.soften ?? 0),
      preset: e.extrude.preset,
    };
  }

  if (typeof e.blur === 'number') {
    out.blur = Math.max(0, e.blur);
  }
  if (e.modulate) {
    out.modulate = {
      hue: typeof e.modulate.hue === 'number' ? e.modulate.hue : undefined,
      saturation: typeof e.modulate.saturation === 'number' ? e.modulate.saturation : undefined,
      brightness: typeof e.modulate.brightness === 'number' ? e.modulate.brightness : undefined,
    };
  }
  if (e.colorOverlay) {
    const presetName = e.colorOverlay.preset;
    const preset = presetName ? ColorOverlayPresets[presetName] : undefined;
    out.colorOverlay = {
      color: e.colorOverlay.color ?? preset?.color ?? '#ffffff',
      opacity: clamp01(e.colorOverlay.opacity, preset?.opacity ?? 0.25),
      blend: e.colorOverlay.blend ?? preset?.blend,
      preset: e.colorOverlay.preset,
    };
  }

  if (e.recolor) {
    const preset = e.recolor.preset ? RecolorPresets[e.recolor.preset] : undefined;
    out.recolor = {
      low: e.recolor.low ?? preset?.low ?? '#000000',
      high: e.recolor.high ?? preset?.high ?? '#ffffff',
      preset: e.recolor.preset,
    };
  }

  return out;
}
