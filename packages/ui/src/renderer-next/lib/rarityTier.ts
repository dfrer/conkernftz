// Rarity rank → tier mapping (OC-3). Deterministic + pure, so the SAME logic drives the Mint FX
// preview and the exported mint widget. A token's rarity `rank` (1 = rarest, from the build's
// rarity-ranks.json) maps to a configured tier label, which selects a rarity-specific card back.

/** A tier rule: a label + the optional share of the collection it covers. */
export interface TierShareRule {
  tier: string;
  /** Fraction of the collection (0–1) the rarest tokens this tier covers. Default DEFAULT_TIER_SHARE. */
  share?: number;
}

/** Default per-tier share when a rule doesn't set one (5% of the collection). */
export const DEFAULT_TIER_SHARE = 0.05;

/**
 * Map a rarity rank (1 = rarest) to a tier label, or '' (common → the default card back).
 *
 * Tiers apply RAREST-FIRST and cumulatively: each tier claims a band of the rarest remaining
 * tokens sized by its `share`. Ranks past the last tier's band are common. Example — 3 tiers at the
 * default 5% over 1000 editions: ranks 1–50 → tier 1, 51–100 → tier 2, 101–150 → tier 3, 151+ →
 * common. The creator can override `share` per tier to widen/narrow a band.
 */
export function tierForRank(rank: number, editionCount: number, tiers: TierShareRule[]): string {
  if (!Number.isFinite(rank) || rank < 1 || editionCount <= 0) return '';
  let cutoff = 0;
  for (const t of tiers) {
    const share = typeof t.share === 'number' && t.share > 0 ? t.share : DEFAULT_TIER_SHARE;
    cutoff += Math.max(1, Math.round(share * editionCount));
    if (rank <= cutoff) return t.tier;
  }
  return '';
}

/**
 * Build a lean per-token tier map (edition id → tier) for embedding in the exported site, from the
 * build's ranked tokens ({ edition, rank }). Only non-common tokens are included — the widget reads
 * a minted token's id, looks up its tier here, and falls back to the default back when absent.
 */
export function buildTierMap(
  tokens: Array<{ edition: number; rank: number }>,
  editionCount: number,
  tiers: TierShareRule[],
): Record<number, string> {
  const map: Record<number, string> = {};
  if (!tiers.length || editionCount <= 0) return map;
  for (const t of tokens) {
    const tier = tierForRank(t.rank, editionCount, tiers);
    if (tier) map[t.edition] = tier;
  }
  return map;
}
