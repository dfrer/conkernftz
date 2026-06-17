import type { RuleEngine, TraitKV, TraitCondition, TransformRule } from './types.js';

export interface ProjectRules {
  mutuallyExclusive?: string[][]; // [["Eyes:Laser","Headwear:Visor"]]
  requires?: Array<{ if: string; thenAnyOf: string[] }>;
  maxOccurrences?: Array<{ trait: string; max: number }>;
  transforms?: TransformRule[];
}

export function createRuleEngine(rules: ProjectRules): RuleEngine {
  const mutuallyExclusive = rules.mutuallyExclusive ?? [];
  const requires = rules.requires ?? [];
  // Note: maxOccurrences is enforced across editions by the generator, not here.

  return {
    validate(traits: TraitKV) {
      // Build a set of "Layer:Value" strings for easy lookup
      const entries = Object.entries(traits).map(([layer, value]) => `${layer}:${value}`);
      const traitSet = new Set(entries);

      // mutuallyExclusive: no pair should both be present
      for (const group of mutuallyExclusive) {
        const present = group.filter((g) => traitSet.has(g));
        if (present.length > 1) {
          return { ok: false as const, reason: `Mutually exclusive traits present: ${present.join(', ')}` };
        }
      }

      // requires: if IF is present, at least one of thenAnyOf must be present
      for (const req of requires) {
        if (traitSet.has(req.if)) {
          const any = req.thenAnyOf.some((t) => traitSet.has(t));
          if (!any) {
            return { ok: false as const, reason: `Trait ${req.if} requires any of: ${req.thenAnyOf.join(', ')}` };
          }
        }
      }

      // maxOccurrences: count occurrences across editions is enforced externally.
      // This RuleEngine only validates a single edition's trait set, so skip here.

      return { ok: true as const };
    },
  };
}

export function evaluateTraitCondition(cond: TraitCondition | undefined, traitSet: Set<string>): boolean {
  if (!cond) return true;
  const any = Array.isArray(cond.anyOf) && cond.anyOf.length > 0 ? cond.anyOf.some((t) => traitSet.has(t)) : true;
  const all = Array.isArray(cond.allOf) && cond.allOf.length > 0 ? cond.allOf.every((t) => traitSet.has(t)) : true;
  const none = Array.isArray(cond.noneOf) && cond.noneOf.length > 0 ? cond.noneOf.every((t) => !traitSet.has(t)) : true;
  const notOk = cond.not ? !evaluateTraitCondition(cond.not, traitSet) : true;
  return any && all && none && notOk;
}


