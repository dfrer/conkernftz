// Pure model + operations for spawn maps (author-controlled placement). The canvas
// component is a thin layer over these functions, so the model logic is unit-tested
// directly (canvas pointer events can't be measured headlessly).

export interface SpawnDot {
  id: string;
  x: number; // normalized 0..1
  y: number; // normalized 0..1
  weight?: number;
  jitterRadiusPx?: number;
  tags?: string[];
  maxPlacementsPerComposition?: number;
}

export interface SpawnRules {
  selection?: 'weighted' | 'sequential';
  jitter?: { defaultRadiusPx?: number; distribution?: 'uniform' | 'gaussian' };
  collision?: { enabled?: boolean; paddingPx?: number; strategy?: 'retry' | 'skip' | 'fallback'; maxAttemptsPerAsset?: number };
  fitMode?: 'contain' | 'cover' | 'stretch';
  anchor?: 'center' | 'top-left' | 'custom';
}

export interface SpawnMap {
  version: 1;
  authoringSize: { width: number; height: number };
  dots: SpawnDot[];
  mappings?: { layerToDotIds?: Record<string, string[]>; assetToDotIds?: Record<string, string[]> };
  rules?: SpawnRules;
}

export function clampUnit(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

export function emptyMap(width = 1024, height = 1024): SpawnMap {
  return {
    version: 1,
    authoringSize: { width, height },
    dots: [],
    mappings: { layerToDotIds: {} },
    rules: { selection: 'weighted', fitMode: 'contain', anchor: 'center' },
  };
}

export function nextDotId(dots: SpawnDot[]): string {
  const ids = new Set(dots.map((d) => d.id));
  let n = dots.length + 1;
  while (ids.has(`dot-${n}`)) n++;
  return `dot-${n}`;
}

export function addDot(map: SpawnMap, x: number, y: number): SpawnMap {
  const id = nextDotId(map.dots);
  return { ...map, dots: [...map.dots, { id, x: clampUnit(x), y: clampUnit(y), weight: 1 }] };
}

export function moveDot(map: SpawnMap, id: string, x: number, y: number): SpawnMap {
  return { ...map, dots: map.dots.map((d) => (d.id === id ? { ...d, x: clampUnit(x), y: clampUnit(y) } : d)) };
}

export function updateDot(map: SpawnMap, id: string, patch: Partial<SpawnDot>): SpawnMap {
  return { ...map, dots: map.dots.map((d) => (d.id === id ? { ...d, ...patch } : d)) };
}

export function removeDot(map: SpawnMap, id: string): SpawnMap {
  const ltd: Record<string, string[]> = { ...(map.mappings?.layerToDotIds ?? {}) };
  for (const k of Object.keys(ltd)) ltd[k] = (ltd[k] ?? []).filter((x) => x !== id);
  return { ...map, dots: map.dots.filter((d) => d.id !== id), mappings: { ...map.mappings, layerToDotIds: ltd } };
}

export function toggleLayerDot(map: SpawnMap, layer: string, dotId: string): SpawnMap {
  const ltd: Record<string, string[]> = { ...(map.mappings?.layerToDotIds ?? {}) };
  const cur = ltd[layer] ?? [];
  ltd[layer] = cur.includes(dotId) ? cur.filter((x) => x !== dotId) : [...cur, dotId];
  return { ...map, mappings: { ...map.mappings, layerToDotIds: ltd } };
}

export function setRules(map: SpawnMap, patch: Partial<SpawnRules>): SpawnMap {
  return { ...map, rules: { ...map.rules, ...patch } };
}

export function layerHasDot(map: SpawnMap, layer: string, dotId: string): boolean {
  return (map.mappings?.layerToDotIds?.[layer] ?? []).includes(dotId);
}
