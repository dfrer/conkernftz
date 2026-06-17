// Pure, DOM-free logic for the Studio panels. Kept free of `window`/`document` so it can be
// unit-tested under Node (vitest) and reused by the DOM orchestrator in studio.ts.

export interface CatalogValue {
  value: string;
  weight: number;
  filename: string;
}

export interface CatalogLayer {
  name: string;
  values: CatalogValue[];
}

/** Return a new array with the item at `from` moved to `to` (out-of-range/no-op safe). */
export function reorderLayers<T>(arr: readonly T[], from: number, to: number): T[] {
  const copy = arr.slice();
  if (from < 0 || from >= copy.length || to < 0 || to >= copy.length || from === to) return copy;
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item as T);
  return copy;
}

/** Parse the rarity weight encoded in a filename like `Hat#10.png` (delimiter '#'). */
export function parseWeightFromFilename(filename: string, delimiter = '#', defaultWeight = 1): number {
  const base = filename.replace(/\.[^.]+$/, '');
  const idx = base.lastIndexOf(delimiter);
  if (idx === -1) return defaultWeight;
  const w = Number(base.slice(idx + delimiter.length));
  if (!Number.isFinite(w) || w <= 0) return defaultWeight;
  return Math.floor(w);
}

/** Extract the trait value (filename without weight suffix or extension). */
export function traitValueFromFilename(filename: string, delimiter = '#'): string {
  const base = filename.replace(/\.[^.]+$/, '');
  const idx = base.lastIndexOf(delimiter);
  return idx === -1 ? base : base.slice(0, idx);
}

/** Return a new filename with the weight suffix set/replaced, preserving value + extension. */
export function setWeightInFilename(filename: string, weight: number, delimiter = '#'): string {
  const dot = filename.lastIndexOf('.');
  const ext = dot === -1 ? '' : filename.slice(dot);
  const base = dot === -1 ? filename : filename.slice(0, dot);
  const idx = base.lastIndexOf(delimiter);
  const value = idx === -1 ? base : base.slice(0, idx);
  const w = Math.max(1, Math.floor(weight));
  return `${value}${delimiter}${w}${ext}`;
}

export interface DistributionEntry {
  value: string;
  weight: number;
  share: number; // 0..1
}

/** Predicted per-value selection probability within a layer from its option weights. */
export function predictedDistribution(layer: CatalogLayer): DistributionEntry[] {
  const total = layer.values.reduce((acc, v) => acc + Math.max(0, v.weight), 0);
  return layer.values.map((v) => ({
    value: v.value,
    weight: v.weight,
    share: total > 0 ? Math.max(0, v.weight) / total : 0,
  }));
}

export interface HistogramBar {
  value: string;
  count: number;
  pct: number; // 0..1
}

/** Build sorted histogram bars from a rarity.json trait_type -> value -> count map. */
export function histogramFromCounts(counts: Record<string, number>, editionCount: number): HistogramBar[] {
  return Object.entries(counts)
    .map(([value, count]) => ({ value, count, pct: editionCount > 0 ? count / editionCount : 0 }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
}

const ANIMATION_RE = /\.(gif|mp4|webp|webm)$/i;
const VIDEO_RE = /\.(mp4|webm)$/i;
const IMAGE_RE = /\.(png|jpe?g|webp|gif)$/i;

/** Keep only animated/video output files from a directory listing. */
export function filterAnimationFiles(names: string[]): string[] {
  return names.filter((n) => ANIMATION_RE.test(n)).sort(numericAware);
}

export function isVideoFile(name: string): boolean {
  return VIDEO_RE.test(name);
}

export function isImageFile(name: string): boolean {
  return IMAGE_RE.test(name);
}

/** Build {from,to} rename pairs that renumber files as `Base N[#weight].ext`. */
export function buildRenamePairs(
  files: string[],
  baseName: string,
  startIndex = 1,
  delimiter = '#',
  weight?: number,
): Array<{ from: string; to: string }> {
  const w = weight && weight > 0 ? `${delimiter}${Math.floor(weight)}` : '';
  return files.map((from, i) => {
    const dot = from.lastIndexOf('.');
    const ext = dot === -1 ? '' : from.slice(dot);
    return { from, to: `${baseName} ${startIndex + i}${w}${ext}` };
  });
}

/** A fresh deterministic-ish seed for the regenerating gallery. */
export function makeSeed(prefix = 'studio'): string {
  return `${prefix}:${Date.now().toString(36)}:${Math.floor(Math.random() * 1e9).toString(36)}`;
}

/** Sort that orders embedded numbers naturally (1,2,10 not 1,10,2). */
function numericAware(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}
