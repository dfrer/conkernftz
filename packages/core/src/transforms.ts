import type { TransformRule, TraitKV } from './types.js';
import { evaluateTraitCondition } from './rules.js';

export interface TransformableLayerState {
  index: number;
  layer: string;
  value: string;
  filename: string;
  baseOffsetX: number;
  baseOffsetY: number;
  baseRotate?: number;
  baseScale?: number;
}

export interface AppliedLayerTransform {
  offsetX: number;
  offsetY: number;
  rotate?: number;
  scale?: number;
}

function sanitizeScaleFactor(factor: number | undefined): number | null {
  if (typeof factor !== 'number' || !Number.isFinite(factor)) return null;
  if (factor <= 0) return null;
  return Math.max(0.001, factor);
}

type InternalLayerState = {
  offsetX: number;
  offsetY: number;
  rotate: number;
  scale: number;
  rotateDefined: boolean;
  scaleDefined: boolean;
};

export function applyTransformRules(
  rules: TransformRule[] | undefined,
  layers: TransformableLayerState[],
  traits: TraitKV,
): Map<number, AppliedLayerTransform> {
  const result = new Map<number, AppliedLayerTransform>();
  const traitSet = new Set(Object.entries(traits).map(([layer, value]) => `${layer}:${value}`));

  const sortedRules = (rules ?? [])
    .map((rule, index) => ({
      rule,
      index,
      priority: rule?.priority ?? 0,
      layerSet: buildLayerSet(rule?.target),
      valueSet: buildValueSet(rule?.target?.values),
      filenameSet: buildFilenameSet(rule?.target?.filenames),
    }))
    .filter((entry) => entry.rule && entry.layerSet.size > 0)
    .sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      return a.index - b.index;
    });

  const internal = new Map<number, InternalLayerState>();
  for (const layer of layers) {
    internal.set(layer.index, {
      offsetX: layer.baseOffsetX,
      offsetY: layer.baseOffsetY,
      rotate: typeof layer.baseRotate === 'number' && Number.isFinite(layer.baseRotate) ? layer.baseRotate : 0,
      scale: typeof layer.baseScale === 'number' && Number.isFinite(layer.baseScale) ? layer.baseScale : 1,
      rotateDefined: typeof layer.baseRotate === 'number' && Number.isFinite(layer.baseRotate),
      scaleDefined: typeof layer.baseScale === 'number' && Number.isFinite(layer.baseScale),
    });
  }

  if (sortedRules.length === 0) {
    for (const layer of layers) {
      const state = internal.get(layer.index)!;
      result.set(layer.index, {
        offsetX: state.offsetX,
        offsetY: state.offsetY,
        rotate: state.rotateDefined ? state.rotate : layer.baseRotate,
        scale: state.scaleDefined ? state.scale : layer.baseScale,
      });
    }
    return result;
  }

  for (const entry of sortedRules) {
    const { rule, layerSet, valueSet, filenameSet } = entry;
    if (!rule) continue;
    if (rule.when && !evaluateTraitCondition(rule.when, traitSet)) continue;

    for (const layer of layers) {
      if (!layerSet.has(layer.layer)) continue;
      if (valueSet && !valueSet.has(layer.value)) continue;
      if (filenameSet && !filenameSet.has(layer.filename.toLowerCase())) continue;

      const state = internal.get(layer.index);
      if (!state) continue;

      if (rule.translate) {
        const mode = rule.translate.mode ?? 'add';
        if (typeof rule.translate.x === 'number' && Number.isFinite(rule.translate.x)) {
          state.offsetX = mode === 'set' ? rule.translate.x : state.offsetX + rule.translate.x;
        }
        if (typeof rule.translate.y === 'number' && Number.isFinite(rule.translate.y)) {
          state.offsetY = mode === 'set' ? rule.translate.y : state.offsetY + rule.translate.y;
        }
      }

      if (rule.rotate && typeof rule.rotate.degrees === 'number' && Number.isFinite(rule.rotate.degrees)) {
        const mode = rule.rotate.mode ?? 'add';
        state.rotate = mode === 'set' ? rule.rotate.degrees : state.rotate + rule.rotate.degrees;
        state.rotateDefined = true;
      }

      if (rule.scale) {
        const factor = sanitizeScaleFactor(rule.scale.factor);
        if (factor !== null) {
          const mode = rule.scale.mode ?? 'multiply';
          const next = mode === 'set' ? factor : state.scale * factor;
          state.scale = Math.max(0.001, next);
          state.scaleDefined = true;
        }
      }
    }
  }

  for (const layer of layers) {
    const state = internal.get(layer.index)!;
    result.set(layer.index, {
      offsetX: state.offsetX,
      offsetY: state.offsetY,
      rotate: state.rotateDefined ? state.rotate : layer.baseRotate,
      scale: state.scaleDefined ? state.scale : layer.baseScale,
    });
  }

  return result;
}

function buildLayerSet(target: TransformRule['target'] | undefined): Set<string> {
  const set = new Set<string>();
  if (!target) return set;
  if (typeof target.layer === 'string' && target.layer.trim().length > 0) {
    set.add(target.layer);
  }
  if (Array.isArray(target.layers)) {
    for (const name of target.layers) {
      if (typeof name === 'string' && name.trim().length > 0) {
        set.add(name);
      }
    }
  }
  return set;
}

function buildValueSet(values: string[] | undefined): Set<string> | null {
  if (!Array.isArray(values) || values.length === 0) return null;
  return new Set(values);
}

function buildFilenameSet(filenames: string[] | undefined): Set<string> | null {
  if (!Array.isArray(filenames) || filenames.length === 0) return null;
  const set = new Set<string>();
  for (const name of filenames) {
    if (typeof name === 'string' && name.length > 0) {
      set.add(name.toLowerCase());
    }
  }
  return set.size > 0 ? set : null;
}
