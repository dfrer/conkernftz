import { renderEdition, type EditionPick, type FrameLayerOverride } from '../render-edition.js';
import type { ProjectConfig } from '../project-config.js';
import type { LayerSpec, LayerAnimation, AnimationEasing, SpawnMap, TraitKV, FitMode } from '../types.js';

export interface RenderFramesParams {
  config: ProjectConfig;
  /** Layer specs (used to read per-layer `animation` keyframes). */
  layers: LayerSpec[];
  picks: EditionPick[];
  traits: TraitKV;
  spawnMap?: SpawnMap | null;
  spawnFit?: FitMode;
  placementRngSeed: string;
  assetSeedBase: string;
  fps: number;
  durationMs: number;
}

/** Number of frames for a given fps/duration (at least 1). */
export function frameCountFor(fps: number, durationMs: number): number {
  return Math.max(1, Math.round((fps * durationMs) / 1000));
}

/** True if any layer in the project declares animation keyframes. */
export function hasAnimatedLayers(layers: LayerSpec[]): boolean {
  return layers.some((l) => !!l.animation);
}

/**
 * Render one edition's animation as an array of PNG frame buffers, reusing the single
 * `renderEdition` path with per-frame transform overrides.
 */
export async function renderEditionFrames(params: RenderFramesParams): Promise<Buffer[]> {
  const n = frameCountFor(params.fps, params.durationMs);
  const animByLayer = new Map<string, LayerAnimation>();
  for (const l of params.layers) if (l.animation) animByLayer.set(l.name, l.animation);

  const frames: Buffer[] = [];
  for (let i = 0; i < n; i++) {
    const t = n > 1 ? i / n : 0; // normalized time in [0,1)
    const overrides: Record<number, FrameLayerOverride> = {};
    params.picks.forEach((p, k) => {
      const anim = animByLayer.get(p.layer);
      if (anim) overrides[k] = sampleAnimation(anim, t);
    });
    const buf = await renderEdition({
      config: params.config,
      picks: params.picks,
      traits: params.traits,
      spawnMap: params.spawnMap,
      spawnFit: params.spawnFit,
      placementRngSeed: params.placementRngSeed,
      assetSeedBase: params.assetSeedBase,
      format: 'png',
      frameOverrides: overrides,
    });
    frames.push(buf);
  }
  return frames;
}

function sampleAnimation(anim: LayerAnimation, t: number): FrameLayerOverride {
  const loop = anim.loopMode ?? 'pingpong';
  const phase = loop === 'pingpong' ? (t < 0.5 ? t * 2 : (1 - t) * 2) : t;
  const e = applyEasing(anim.easing ?? 'sine', phase);
  const out: FrameLayerOverride = {};
  if (anim.rotate) out.rotate = lerp(anim.rotate.from, anim.rotate.to, e);
  if (anim.scale) out.scale = lerp(anim.scale.from, anim.scale.to, e);
  if (anim.translateX) out.offsetXDelta = lerp(anim.translateX.from, anim.translateX.to, e);
  if (anim.translateY) out.offsetYDelta = lerp(anim.translateY.from, anim.translateY.to, e);
  if (anim.opacity) out.opacity = clamp01(lerp(anim.opacity.from, anim.opacity.to, e));
  return out;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function clamp01(n: number): number {
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

function applyEasing(easing: AnimationEasing, x: number): number {
  switch (easing) {
    case 'linear':
      return x;
    case 'easeInOut':
      return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
    case 'sine':
    default:
      return (1 - Math.cos(Math.PI * x)) / 2;
  }
}
