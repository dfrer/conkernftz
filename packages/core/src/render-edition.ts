import path from 'node:path';
import { compositeLayers } from './compositor.js';
import { createSeededRng } from './rng.js';
import { placeAsset, resolveCandidateDots, type CoordinateMapperConfig } from './placement.js';
import { applyTransformRules, type TransformableLayerState } from './transforms.js';
import type { ResolvedEffects } from './effects.js';
import type { LayerAssetOption } from './catalog.js';
import type { ProjectConfig } from './project-config.js';
import type { SpawnMap, TraitKV, FitMode } from './types.js';

/** One layer pick for an edition (mirrors GeneratedEdition['picks'][number]). */
export interface EditionPick {
  layer: string;
  option: LayerAssetOption;
}

/** Per-frame transform override for a single layer (used by the animation pipeline). */
export interface FrameLayerOverride {
  /** Absolute rotation in degrees (replaces the layer's rotation for this frame). */
  rotate?: number;
  /** Absolute scale multiplier (replaces). */
  scale?: number;
  /** Additive X offset in pixels (added to the computed offset). */
  offsetXDelta?: number;
  /** Additive Y offset in pixels. */
  offsetYDelta?: number;
  /** Absolute opacity 0..1 (replaces). */
  opacity?: number;
}

export interface RenderEditionParams {
  config: ProjectConfig;
  /** Layer picks in draw order (bottom → top). */
  picks: EditionPick[];
  /** The edition's resolved traits (used by transform rules). */
  traits: TraitKV;
  /** Optional spawn map for author-controlled placement. */
  spawnMap?: SpawnMap | null;
  /** Default fit mode when mapping normalized coords to pixels. */
  spawnFit?: FitMode;
  /** Seed for this edition's placement RNG, e.g. `${seed}:ed:${idx}`. */
  placementRngSeed: string;
  /** Base for per-asset placement seeds: `${assetSeedBase}:${layer}:${value}`. */
  assetSeedBase: string;
  /** Output image format. */
  format: 'png' | 'webp';
  /** Optional per-layer overrides keyed by pick index (animation frame deltas). */
  frameOverrides?: Record<number, FrameLayerOverride>;
}

/**
 * Render a single edition to an encoded image buffer. This is the one shared
 * pipeline used by both `buildCollection` and `renderPreviewEdition`:
 * spawn-map placement → transform rules → compositing with effects.
 */
export async function renderEdition(params: RenderEditionParams): Promise<Buffer> {
  const cfg = params.config;
  const picks = params.picks;
  const spawnMap = params.spawnMap ?? null;
  const spawnFit: FitMode = params.spawnFit ?? 'contain';

  // If a spawn map is present, compute per-layer pixel offsets via placement.
  let placedOffsets: Array<{ offX: number; offY: number }> = [];
  if (spawnMap) {
    const rng = createSeededRng(params.placementRngSeed);
    const occupied: Array<{ x: number; y: number; w: number; h: number }> = [];
    const mapper: CoordinateMapperConfig = {
      authorWidth: spawnMap.authoringSize.width,
      authorHeight: spawnMap.authoringSize.height,
      outWidth: cfg.image.width,
      outHeight: cfg.image.height,
      fitMode: spawnMap.rules?.fitMode ?? spawnFit,
    };
    placedOffsets = picks.map((p, k) => {
      const layer = String(p.layer || p.option?.value || `L${k}`);
      const assetKey = `${layer}:${p.option.value}`;
      const candidates = resolveCandidateDots(spawnMap, layer, assetKey);
      // TODO: detect real asset size; currently full-canvas bbox.
      const assetSize = { width: cfg.image.width, height: cfg.image.height };
      const pol = spawnMap.rules?.selection ?? 'weighted';
      const jitterDef = spawnMap.rules?.jitter?.defaultRadiusPx ?? 0;
      const coll = spawnMap.rules?.collision;
      const result = placeAsset({
        globalSeed: `${params.assetSeedBase}:${layer}:${p.option.value}`,
        layerName: layer,
        assetKey,
        candidateDots: candidates,
        policy: pol,
        jitterDefaultPx: jitterDef,
        collision: coll
          ? {
              enabled: !!coll.enabled,
              paddingPx: Math.max(0, coll.paddingPx ?? 0),
              strategy: coll.strategy ?? 'retry',
              maxAttempts: Math.max(1, coll.maxAttemptsPerAsset ?? 10),
            }
          : undefined,
        mapper,
        asset: assetSize,
        anchor: spawnMap.rules?.anchor ?? 'center',
        occupiedBoxes: occupied,
        rng,
      });
      const offX = Math.round(result.x);
      const offY = Math.round(result.y);
      occupied.push({ x: result.x, y: result.y, w: result.w, h: result.h });
      return { offX, offY };
    });
  }

  const layerStates: TransformableLayerState[] = picks.map((p, k) => {
    const baseOffsetX = placedOffsets[k]?.offX ?? p.option.offsetX ?? p.option.effects?.offsetX ?? 0;
    const baseOffsetY = placedOffsets[k]?.offY ?? p.option.offsetY ?? p.option.effects?.offsetY ?? 0;
    const baseRotate = p.option.effects?.rotate;
    const baseScale = p.option.effects?.scale;
    return {
      index: k,
      layer: String(p.layer),
      value: String(p.option.value),
      filename: path.basename(p.option.filePath),
      baseOffsetX,
      baseOffsetY,
      baseRotate,
      baseScale,
    };
  });

  const appliedTransforms = applyTransformRules(cfg.rules?.transforms, layerStates, params.traits);

  return compositeLayers(
    picks.map((p, k) => {
      const state = layerStates[k]!;
      const applied = appliedTransforms.get(k);
      const ov = params.frameOverrides?.[k];
      let finalOffsetX = applied?.offsetX ?? state.baseOffsetX;
      let finalOffsetY = applied?.offsetY ?? state.baseOffsetY;
      let finalRotate = applied?.rotate ?? state.baseRotate;
      let finalScale = applied?.scale ?? state.baseScale;
      let finalOpacity = p.option.opacity ?? p.option.effects?.opacity ?? 1;
      if (ov) {
        if (ov.rotate !== undefined) finalRotate = ov.rotate;
        if (ov.scale !== undefined) finalScale = ov.scale;
        if (ov.offsetXDelta) finalOffsetX += ov.offsetXDelta;
        if (ov.offsetYDelta) finalOffsetY += ov.offsetYDelta;
        if (ov.opacity !== undefined) finalOpacity = ov.opacity;
      }
      let effects: ResolvedEffects | undefined = cloneResolvedEffects(p.option.effects);
      if (!effects && (finalRotate !== undefined || finalScale !== undefined)) {
        effects = {};
      }
      if (effects) {
        if (finalRotate !== undefined) effects.rotate = finalRotate;
        else if (state.baseRotate === undefined) delete effects.rotate;
        if (finalScale !== undefined) effects.scale = finalScale;
        else if (state.baseScale === undefined) delete effects.scale;
        if ('offsetX' in effects) delete effects.offsetX;
        if ('offsetY' in effects) delete effects.offsetY;
      }
      return {
        path: p.option.filePath,
        blend: p.option.blend ?? p.option.effects?.blend ?? 'normal',
        opacity: finalOpacity,
        offsetX: finalOffsetX,
        offsetY: finalOffsetY,
        effects,
      };
    }),
    {
      width: cfg.image.width,
      height: cfg.image.height,
      background: cfg.image.background,
      format: params.format,
      superSample: Number(cfg.experimental?.compositor?.superSample || 1) || 1,
      forceCpu: !!cfg.experimental?.compositor?.forceCpu,
    },
  );
}

export function cloneResolvedEffects(e?: ResolvedEffects): ResolvedEffects | undefined {
  if (!e) return undefined;
  return {
    blend: e.blend,
    opacity: e.opacity,
    offsetX: e.offsetX,
    offsetY: e.offsetY,
    rotate: e.rotate,
    scale: e.scale,
    glow: e.glow ? { ...e.glow } : undefined,
    stroke: e.stroke ? { ...e.stroke } : undefined,
    shadow: e.shadow ? { ...e.shadow } : undefined,
    extrude: e.extrude ? { ...e.extrude } : undefined,
    blur: e.blur,
    modulate: e.modulate ? { ...e.modulate } : undefined,
    colorOverlay: e.colorOverlay ? { ...e.colorOverlay } : undefined,
  };
}
