// Pure helpers for the image renamer. Filename-encoded rarity uses `<value><delim><weight>`,
// e.g. "Gold Crown#5.png". Kept DOM-free so the logic is unit-tested directly.

const IMG_RE = /\.(png|jpe?g|webp|gif|svg)$/i;
const EXT_RE = /\.[^.]+$/;

export function isImage(name: string): boolean {
  return IMG_RE.test(name);
}

export function splitName(filename: string): { stem: string; ext: string } {
  const m = filename.match(EXT_RE);
  const ext = m ? m[0] : '';
  return { stem: filename.slice(0, filename.length - ext.length), ext };
}

export function traitValueOf(filename: string, delimiter: string): string {
  const { stem } = splitName(filename);
  const i = stem.lastIndexOf(delimiter);
  return i >= 0 ? stem.slice(0, i) : stem;
}

export function weightOf(filename: string, delimiter: string, defaultWeight: number): number {
  const { stem } = splitName(filename);
  const i = stem.lastIndexOf(delimiter);
  if (i < 0) return defaultWeight;
  const w = Number(stem.slice(i + delimiter.length));
  return Number.isFinite(w) && w > 0 ? w : defaultWeight;
}

export function setWeight(filename: string, weight: number, delimiter: string): string {
  const { ext } = splitName(filename);
  return `${traitValueOf(filename, delimiter)}${delimiter}${weight}${ext}`;
}

export interface RenamePair {
  from: string;
  to: string;
}

/** Set a uniform rarity weight on every file (filenames only, not paths). */
export function uniformWeightRenames(files: string[], weight: number, delimiter: string): RenamePair[] {
  return files
    .map((f) => ({ from: f, to: setWeight(f, weight, delimiter) }))
    .filter((p) => p.from !== p.to);
}

/** Sequence-rename files to `<base> <index>` (zero-padded), optionally keeping each file's weight. */
export function sequenceRenames(
  files: string[],
  base: string,
  start: number,
  pad: number,
  delimiter: string,
  keepWeight: boolean,
  defaultWeight = 1,
): RenamePair[] {
  return files
    .map((f, i) => {
      const { ext } = splitName(f);
      const idx = String(start + i).padStart(Math.max(0, pad), '0');
      const weightSuffix = keepWeight ? `${delimiter}${weightOf(f, delimiter, defaultWeight)}` : '';
      return { from: f, to: `${base} ${idx}${weightSuffix}${ext}` };
    })
    .filter((p) => p.from !== p.to);
}
