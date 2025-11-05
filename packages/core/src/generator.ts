import type { LayerCatalogEntry, LayerAssetOption } from './catalog.js';
import type { TraitKV, LayerOptionRule } from './types.js';
import path from 'node:path';
import { createSeededRng } from './rng.js';
import { createRuleEngine, evaluateTraitCondition, type ProjectRules } from './rules.js';
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
      // Conditional spawn: simple anyOf
      const traitSet = new Set(Object.entries(traits).map(([layer, value]) => `${layer}:${value}`));
      if (Array.isArray(entry.spec.spawnWhenAnyOf) && entry.spec.spawnWhenAnyOf.length > 0) {
        const allowed = entry.spec.spawnWhenAnyOf.some((t) => traitSet.has(t));
        if (!allowed) continue;
      }
      // Advanced when/unless
      if (entry.spec.spawnWhen && !evaluateTraitCondition(entry.spec.spawnWhen, traitSet)) continue;
      if (entry.spec.spawnUnless && evaluateTraitCondition(entry.spec.spawnUnless, traitSet)) continue;
      if (entry.options.length === 0) continue;
      const opts = applyOptionRules(entry.options, entry.spec.optionRules, traits);
      if (opts.length === 0) continue;
      
      let pick: LayerAssetOption;
      if (entry.spec.selectionMode === 'round-robin') {
        pick = roundRobinPick(entry, opts);
      } else {
        pick = weightedPick(opts, rng.next());
      }
      
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

  // Pre-compute rule lookups for better performance
  const ruleLookup = new Map<string, { max: number; layer: string; value: string }>();
  for (const rule of maxOccRules) {
    const [layer, value] = rule.trait.split(':');
    if (layer && value) {
      ruleLookup.set(rule.trait, { max: rule.max, layer, value });
    }
  }

  // Pre-filter catalog entries with options
  const validEntries = catalog.filter(entry => entry.options.length > 0);

  for (let i = 0; i < count; i++) {
    let attempts = 0;
    let accepted: GeneratedEdition | null = null;
    
    while (attempts++ < maxAttempts) {
      // draft one edition - optimized loop
      const traits: TraitKV = {};
      const picks: Array<{ layer: string; option: LayerAssetOption }> = [];
      
      for (const entry of validEntries) {
        const traitSet = new Set(Object.entries(traits).map(([layer, value]) => `${layer}:${value}`));
        // Conditional spawn: simple anyOf
        if (Array.isArray(entry.spec.spawnWhenAnyOf) && entry.spec.spawnWhenAnyOf.length > 0) {
          const allowed = entry.spec.spawnWhenAnyOf.some((t) => traitSet.has(t));
          if (!allowed) continue;
        }
        // Advanced when/unless
        if (entry.spec.spawnWhen && !evaluateTraitCondition(entry.spec.spawnWhen, traitSet)) continue;
        if (entry.spec.spawnUnless && evaluateTraitCondition(entry.spec.spawnUnless, traitSet)) continue;
        const opts = applyOptionRules(entry.options, entry.spec.optionRules, traits);
        if (opts.length === 0) continue;
        
        let pick: LayerAssetOption;
        if (entry.spec.selectionMode === 'round-robin') {
          pick = roundRobinPick(entry, opts);
        } else {
          pick = weightedPick(opts, rng.next());
        }
        
        traits[entry.spec.name] = pick.value;
        picks.push({ layer: entry.spec.name, option: pick });
      }

      // Early exit for rules check
      if (engine) {
        const res = engine.validate(traits);
        if (!res.ok) continue;
      }

      // Optimized max occurrences check
      if (ruleLookup.size > 0) {
        let violates = false;
        for (const [key, rule] of ruleLookup) {
          if (traits[rule.layer] === rule.value) {
            const used = occCounts.get(key) ?? 0;
            if (used >= rule.max) {
              violates = true;
              break;
            }
          }
        }
        if (violates) continue;
      }

      // Optimized uniqueness check
      if (constraints.uniqueness) {
        const dna = makeDna(traits, constraints.uniqueness);
        if (seenDna.has(dna)) {
          continue;
        }
        seenDna.add(dna);
      }

      accepted = { traits, picks };
      break;
    }
    
    if (!accepted) {
      throw new Error(`Failed to generate a valid unique edition after ${maxAttempts} attempts. Consider relaxing rules or uniqueness.`);
    }

    // Update occurrence counts efficiently
    for (const [key, rule] of ruleLookup) {
      if (accepted.traits[rule.layer] === rule.value) {
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

function roundRobinPick<T extends { weight: number }>(
  entry: LayerCatalogEntry, 
  items: T[]
): T {
  if (items.length === 0) {
    throw new Error('Cannot pick from empty items array');
  }
  
  // Initialize round-robin index if not set
  if (entry.roundRobinIndex === undefined) {
    entry.roundRobinIndex = 0;
  }
  
  // Pick the current item and advance the index
  const index = entry.roundRobinIndex % items.length;
  const picked = items[index]!; // We know this exists because items.length > 0
  entry.roundRobinIndex = (entry.roundRobinIndex + 1) % items.length;
  
  return picked;
}


function applyOptionRules(
  options: LayerAssetOption[],
  rules: LayerOptionRule[] | undefined,
  currentTraits: TraitKV,
): LayerAssetOption[] {
  if (!Array.isArray(rules) || rules.length === 0) return options;
  const traitSet = new Set(Object.entries(currentTraits).map(([layer, value]) => `${layer}:${value}`));
  const out: LayerAssetOption[] = [];
  for (const opt of options) {
    let weight = opt.weight;
    let excluded = false;
    for (const rule of rules) {
      if (!rule || !rule.match) continue;
      const targetVal = rule.match.target === 'filename' ? path.basename(opt.filePath) : opt.value;
      const isMatch = targetVal === rule.match.pattern;
      if (!isMatch) continue;
      if (rule.when && !evaluateTraitCondition(rule.when, traitSet)) continue;
      if (rule.unless && evaluateTraitCondition(rule.unless, traitSet)) continue;
      if (rule.exclude) { excluded = true; break; }
      if (typeof rule.weightMultiply === 'number' && isFinite(rule.weightMultiply)) {
        weight = Math.max(0, weight * rule.weightMultiply);
      }
    }
    if (!excluded && weight > 0) {
      out.push({ ...opt, weight });
    }
  }
  return out;
}

