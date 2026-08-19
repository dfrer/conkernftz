// Pure helpers for the per-layer trait browser. Turns a layer's image filenames into a
// rarity table: one row per asset with its effective weight and the probability that the
// generator picks it *within that layer*. DOM-free so the math is unit-tested directly.
//
// Rarity policy (mirrors the engine in @conkernftz/core):
//   - 'filename' rarity: weight is parsed from `<value><delim><weight>`, e.g. "Gold#5.png".
//     Missing/invalid/zero weights fall back to `defaultWeight`.
//   - 'uniform'  rarity: every asset weighs 1, regardless of any `#weight` in the name.
//   - probability = weight / Σ(weights in the layer). Non-image files are ignored.
//   - Each file is one row; we do NOT merge same-valued names (the OS guarantees distinct
//     files, and two files = two distinct images even if they share a trait value).

import { isCatalogImage, traitValueOf, weightOf } from './rename';

export interface TraitRow {
  /** Filename as it sits on disk, e.g. "Gold Crown#5.png". */
  file: string;
  /** Trait value (stem before the delimiter), e.g. "Gold Crown". */
  value: string;
  /** Effective rarity weight after applying the layer's rarity mode. */
  weight: number;
  /** Chance (0..1) the generator picks this asset within its layer. */
  probability: number;
}

export interface TraitTable {
  rows: TraitRow[];
  /** Sum of all effective weights (the normalization denominator). */
  total: number;
}

export interface TraitOpts {
  delimiter: string;
  defaultWeight: number;
  /** True when the layer uses 'uniform' rarity (ignore filename weights). */
  uniform?: boolean;
}

export function computeTraitTable(files: string[], opts: TraitOpts): TraitTable {
  const rows: TraitRow[] = files.filter(isCatalogImage).map((file) => ({
    file,
    value: traitValueOf(file, opts.delimiter),
    weight: opts.uniform ? 1 : weightOf(file, opts.delimiter, opts.defaultWeight),
    probability: 0,
  }));
  const total = rows.reduce((sum, r) => sum + r.weight, 0);
  for (const r of rows) r.probability = total > 0 ? r.weight / total : 0;
  return { rows, total };
}

/** Format a 0..1 probability as a compact percentage string, e.g. 0.0123 → "1.23%". */
export function formatPct(p: number): string {
  if (!Number.isFinite(p) || p <= 0) return '0%';
  if (p < 0.001) return '<0.1%';
  const pct = p * 100;
  return `${pct < 10 ? pct.toFixed(2) : pct.toFixed(1)}%`;
}
