import type { LayerCatalogEntry, LayerAssetOption } from './catalog.js';
import type { TraitKV } from './types.js';
import { createSeededRng } from './rng.js';
import { createRuleEngine, type ProjectRules } from './rules.js';
import { makeDna, type DnaConfig } from './dna.js';
import type { Pattern, PatternBinding } from './types/pattern.js';
import { placeFromPattern } from './pattern-placement.js';

export interface GenerateOptions {
  seed: string | number;
}

export interface GeneratedEdition {
  traits: TraitKV;
  picks: Array<{ layer: string; option: LayerAssetOption }>;
  placements?: Array<{
    layer: string;
    target: 'layer' | 'asset';
    patternId: string;
    dotId: string;
    left: number;
    top: number;
    centerX: number;
    centerY: number;
    rotationDeg: number;
    assetValue?: string;
    anchorNormalized?: { x: number; y: number };
  }>;
}

export function generateEditions(
  catalog: LayerCatalogEntry[],
  count: number,
  options: GenerateOptions,
): GeneratedEdition[] {
  const rng = createSeededRng(options.seed);
  const out: GeneratedEdition[] = [];
  for (let i = 0; i < count; i++) {
    const traits: TraitKV = {};
    const picks: Array<{ layer: string; option: LayerAssetOption }> = [];
    for (const entry of catalog) {
      if (entry.options.length === 0) continue;
      const pick = weightedPick(entry.options, rng.next());
      traits[entry.spec.name] = pick.value;
      picks.push({ layer: entry.spec.name, option: pick });
    }
    out.push({ traits, picks });
  }
  return out;
}

export interface ConstraintOptions {
  rules?: ProjectRules;
  uniqueness?: DnaConfig;
  maxAttemptsPerEdition?: number;
  // Optional pattern placement context
  patterns?: Pattern[];
  patternBindings?: PatternBinding[];
  imageSize?: { width: number; height: number };
}

export function generateEditionsConstrained(
  catalog: LayerCatalogEntry[],
  count: number,
  options: GenerateOptions,
  constraints: ConstraintOptions,
): GeneratedEdition[] {
  const rng = createSeededRng(options.seed);
  const out: GeneratedEdition[] = [];
  const engine = constraints.rules ? createRuleEngine(constraints.rules) : null;
  const seenDna = new Set<string>();
  const maxAttempts = constraints.maxAttemptsPerEdition ?? 500;
  const maxOccRules = constraints.rules?.maxOccurrences ?? [];
  const occCounts = new Map<string, number>(); // key like "Layer:Value"

  for (let i = 0; i < count; i++) {
    let attempts = 0;
    let accepted: GeneratedEdition | null = null;
    while (attempts++ < maxAttempts) {
      // draft one edition
      const traits: TraitKV = {};
      const picks: Array<{ layer: string; option: LayerAssetOption }> = [];
      const placements: GeneratedEdition['placements'] = [];
      for (const entry of catalog) {
        if (entry.options.length === 0) continue;
        const pick = weightedPick(entry.options, rng.next());
        traits[entry.spec.name] = pick.value;
        picks.push({ layer: entry.spec.name, option: pick });

        // Pattern placement integration
        if (constraints.patterns && constraints.patterns.length && constraints.patternBindings && constraints.patternBindings.length) {
          const matching = findMatchingBindings(constraints.patternBindings, entry.spec.name, pick);
          if (matching.length > 0) {
            const chosenBinding = weightedPick(
              matching.map((b) => ({ ...b, weight: Math.max(0, b.weight ?? 1) })),
              rng.next(),
            ) as PatternBinding & { weight: number };
            const choices = chosenBinding.choices && chosenBinding.choices.length ? chosenBinding.choices : [];
            if (choices.length > 0) {
              const chosenPatternId = weightedPick(choices, rng.next()).patternId;
              const pattern = constraints.patterns.find((p) => p.id === chosenPatternId);
              if (pattern && pattern.dots.length) {
                const seed = `${options.seed}:${i}:${entry.spec.name}:${pick.value}`;
                const centers = placements.map((p) => ({ x: p.centerX, y: p.centerY }));
                const imageSize = constraints.imageSize ?? { width: 1024, height: 1024 };
                const res = placeFromPattern({
                  seed,
                  canvas: { width: imageSize.width, height: imageSize.height },
                  // Real asset dimensions (loaded into the catalog) so anchor offsets are
                  // correct; falls back to a 1x1 point if dimensions are unavailable.
                  asset: { width: pick.width ?? 1, height: pick.height ?? 1 },
                  pattern,
                  binding: chosenBinding,
                  existingCenters: centers,
                });
                const anchorNorm = toAnchorNormalized(chosenBinding);
                placements.push({
                  layer: entry.spec.name,
                  target: chosenBinding.target.type,
                  patternId: res.patternId,
                  dotId: res.dotId,
                  left: res.left,
                  top: res.top,
                  centerX: res.centerX,
                  centerY: res.centerY,
                  rotationDeg: res.rotationDeg,
                  assetValue: pick.value,
                  anchorNormalized: anchorNorm,
                });
              }
            }
          }
        }
      }

      // rules check
      if (engine) {
        const res = engine.validate(traits);
        if (!res.ok) continue;
      }

      // max occurrences check
      if (maxOccRules.length > 0) {
        let violates = false;
        for (const rule of maxOccRules) {
          const key = rule.trait;
          const [layer, value] = key.split(':');
          if (!layer || !value) continue;
          if (traits[layer] === value) {
            const used = occCounts.get(key) ?? 0;
            if (used >= rule.max) {
              violates = true;
              break;
            }
          }
        }
        if (violates) continue;
      }

      // uniqueness check
      if (constraints.uniqueness) {
        const dna = makeDna(traits, constraints.uniqueness);
        if (seenDna.has(dna)) {
          continue;
        }
        // accept
        seenDna.add(dna);
      }

      accepted = { traits, picks, placements: placements?.length ? placements : undefined };
      break;
    }
    if (!accepted) {
      throw new Error(`Failed to generate a valid unique edition after ${maxAttempts} attempts. Consider relaxing rules or uniqueness.`);
    }

    // update occurrence counts
    for (const rule of maxOccRules) {
      const key = rule.trait;
      const [layer, value] = key.split(':');
      if (!layer || !value) continue;
      if (accepted.traits[layer] === value) {
        occCounts.set(key, (occCounts.get(key) ?? 0) + 1);
      }
    }

    out.push(accepted);
  }
  return out;
}

function weightedPick<T extends { weight: number }>(items: T[], roll: number): T {
  const total = items.reduce((acc, i) => acc + i.weight, 0);
  let r = roll * total;
  for (const item of items) {
    if (r < item.weight) return item;
    r -= item.weight;
  }
  // If for some reason roll is exactly 1.0, fall back to last item
  return items[items.length - 1] as T;
}

function findMatchingBindings(
  bindings: PatternBinding[],
  layerName: string,
  pick: LayerAssetOption,
): PatternBinding[] {
  return bindings.filter((b) => {
    if (b.target.type === 'layer') {
      return b.target.layer === layerName;
    }
    if (b.target.type === 'asset') {
      if (b.target.layer !== layerName) return false;
      if (b.target.value && b.target.value !== pick.value) return false;
      if (b.target.filename && !pick.filePath.endsWith(b.target.filename)) return false;
      return true;
    }
    return false;
  });
}

function toAnchorNormalized(binding: PatternBinding): { x: number; y: number } | undefined {
  const a = binding.anchor;
  if (!a) return undefined;
  if (a.mode === 'custom') return { x: clamp01(a.x), y: clamp01(a.y) };
  switch (a.mode) {
    case 'topLeft': return { x: 0, y: 0 };
    case 'topRight': return { x: 1, y: 0 };
    case 'bottomLeft': return { x: 0, y: 1 };
    case 'bottomRight': return { x: 1, y: 1 };
    case 'center':
    default: return { x: 0.5, y: 0.5 };
  }
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}


