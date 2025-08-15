import type { LayerCatalogEntry, LayerAssetOption } from './catalog.js';
import type { TraitKV } from './types.js';
import { createSeededRng } from './rng.js';
import { createRuleEngine, type ProjectRules } from './rules.js';
import { makeDna, type DnaConfig } from './dna.js';

export interface GenerateOptions {
  seed: string | number;
}

export interface GeneratedEdition {
  traits: TraitKV;
  picks: Array<{ layer: string; option: LayerAssetOption }>;
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
      for (const entry of catalog) {
        if (entry.options.length === 0) continue;
        const pick = weightedPick(entry.options, rng.next());
        traits[entry.spec.name] = pick.value;
        picks.push({ layer: entry.spec.name, option: pick });
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

      accepted = { traits, picks };
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


