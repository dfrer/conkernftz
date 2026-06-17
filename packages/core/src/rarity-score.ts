import { generateRarityReport } from './preview.js';
import type { TraitKV } from './types.js';

/** Per-trait-value statistics derived from a generated collection. */
export interface TraitValueStat {
  /** Number of editions that carry this value. */
  count: number;
  /** count / editionCount, in [0,1]. */
  frequency: number;
  /** Statistical rarity weight = 1 / frequency (rarer values score higher). */
  rarityScore: number;
}

export interface TraitStatistics {
  editionCount: number;
  /** trait_type -> value -> stat */
  traits: Record<string, Record<string, TraitValueStat>>;
}

/** A single token's rarity, scored and ranked against the whole collection. */
export interface TokenRarity {
  /** 1-based edition number. */
  edition: number;
  /** Sum of the per-trait rarityScore values. Higher = rarer. */
  score: number;
  /** 1-based rank; rank 1 is the rarest token. */
  rank: number;
  traits: TraitKV;
}

export interface RankedCollection {
  stats: TraitStatistics;
  tokens: TokenRarity[];
}

/**
 * Compute per-trait-value frequency statistics for a collection. Built on top of
 * the existing {@link generateRarityReport} frequency counts.
 */
export function computeTraitStatistics(editions: Array<{ traits: TraitKV }>): TraitStatistics {
  const report = generateRarityReport(editions);
  const editionCount = report.editionCount;
  const traits: Record<string, Record<string, TraitValueStat>> = {};
  for (const [traitType, values] of Object.entries(report.traitCounts)) {
    const byValue: Record<string, TraitValueStat> = {};
    for (const [value, count] of Object.entries(values)) {
      const frequency = editionCount > 0 ? count / editionCount : 0;
      const rarityScore = frequency > 0 ? 1 / frequency : 0;
      byValue[value] = { count, frequency, rarityScore };
    }
    traits[traitType] = byValue;
  }
  return { editionCount, traits };
}

/**
 * Score a single token: the sum of the statistical rarity of each of its traits.
 * Unknown trait/value pairs (not present in `stats`) contribute 0.
 */
export function scoreToken(traits: TraitKV, stats: TraitStatistics): number {
  let score = 0;
  for (const [traitType, value] of Object.entries(traits)) {
    const stat = stats.traits[traitType]?.[value];
    if (stat) score += stat.rarityScore;
  }
  return score;
}

/**
 * Score and rank an entire collection. Tokens are ranked by descending score
 * (rarest first); ties are broken by ascending edition number for determinism.
 */
export function rankEditions(editions: Array<{ traits: TraitKV }>): RankedCollection {
  const stats = computeTraitStatistics(editions);
  const scored = editions.map((ed, i) => ({
    edition: i + 1,
    score: scoreToken(ed.traits, stats),
    traits: ed.traits,
  }));
  const order = [...scored].sort((a, b) => b.score - a.score || a.edition - b.edition);
  const rankByEdition = new Map<number, number>();
  order.forEach((t, i) => rankByEdition.set(t.edition, i + 1));
  const tokens: TokenRarity[] = scored.map((t) => ({ ...t, rank: rankByEdition.get(t.edition)! }));
  return { stats, tokens };
}
