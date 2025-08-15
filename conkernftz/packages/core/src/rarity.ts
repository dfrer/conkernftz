export interface RarityConfig {
  mode: 'filenameDelimiter';
  delimiter: string; // e.g. '#'
  defaultWeight: number; // used when no delimiter found
}

export function parseWeightFromFilename(filename: string, cfg: RarityConfig): number {
  if (cfg.mode !== 'filenameDelimiter') return cfg.defaultWeight;
  const base = filename.replace(/\.[^.]+$/, '');
  const idx = base.lastIndexOf(cfg.delimiter);
  if (idx === -1) return cfg.defaultWeight;
  const maybe = base.slice(idx + cfg.delimiter.length);
  const w = Number(maybe);
  if (!Number.isFinite(w) || w <= 0) return cfg.defaultWeight;
  return Math.floor(w);
}


