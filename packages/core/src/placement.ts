import type { SpawnMap, SpawnDot, SelectionPolicy, FitMode, PlacementDecisionLog, Anchor } from './types.js';
import type { SeededRng } from './rng.js';

export interface CoordinateMapperConfig {
  authorWidth: number;
  authorHeight: number;
  outWidth: number;
  outHeight: number;
  fitMode: FitMode;
}

export interface AssetSize {
  width: number;
  height: number;
}

export interface PlacementRequest {
  // Stable identifiers to derive sub-seeds
  globalSeed: string | number;
  layerName: string;
  assetKey: string; // e.g., "Layer:Value"
  candidateDots: SpawnDot[];
  policy: SelectionPolicy;
  jitterDefaultPx: number;
  collision?: {
    enabled: boolean;
    paddingPx: number;
    strategy: 'retry' | 'skip' | 'fallback';
    maxAttempts: number;
  };
  mapper: CoordinateMapperConfig;
  asset: AssetSize;
  anchor: Anchor;
  // Occupancy is an array of already-placed item bounding boxes
  occupiedBoxes: Array<{ x: number; y: number; w: number; h: number }>;
  rng: SeededRng;
}

export interface PlacementResult {
  x: number; // final pixel position (anchor applied)
  y: number;
  w: number;
  h: number;
  chosenDot?: SpawnDot;
  log: PlacementDecisionLog;
  usedIndex?: number; // index used for sequential policy
}

export function mapNormalizedToPixels(cfg: CoordinateMapperConfig, nx: number, ny: number): { x: number; y: number; scaleX: number; scaleY: number; offsetX: number; offsetY: number } {
  const aw = cfg.authorWidth;
  const ah = cfg.authorHeight;
  const ow = cfg.outWidth;
  const oh = cfg.outHeight;
  const arA = aw / Math.max(1, ah);
  const arO = ow / Math.max(1, oh);
  if (cfg.fitMode === 'stretch') {
    return { x: nx * ow, y: ny * oh, scaleX: ow / aw, scaleY: oh / ah, offsetX: 0, offsetY: 0 };
  }
  if (cfg.fitMode === 'cover') {
    const scale = arO > arA ? oh / ah : ow / aw;
    const scaledW = aw * scale;
    const scaledH = ah * scale;
    const offX = (ow - scaledW) / 2;
    const offY = (oh - scaledH) / 2;
    return { x: offX + nx * scaledW, y: offY + ny * scaledH, scaleX: scale, scaleY: scale, offsetX: offX, offsetY: offY };
  }
  // contain
  const scale = arO > arA ? ow / aw : oh / ah;
  const scaledW = aw * scale;
  const scaledH = ah * scale;
  const offX = (ow - scaledW) / 2;
  const offY = (oh - scaledH) / 2;
  return { x: offX + nx * scaledW, y: offY + ny * scaledH, scaleX: scale, scaleY: scale, offsetX: offX, offsetY: offY };
}

function aabbCollides(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }, pad: number): boolean {
  return !(
    a.x + a.w + pad <= b.x ||
    a.x >= b.x + b.w + pad ||
    a.y + a.h + pad <= b.y ||
    a.y >= b.y + b.h + pad
  );
}

function applyAnchor(x: number, y: number, size: AssetSize, anchor: Anchor): { x: number; y: number } {
  if (anchor === 'top-left') return { x, y };
  // default center
  return { x: Math.round(x - size.width / 2), y: Math.round(y - size.height / 2) };
}

export function pickDotWeighted(dots: SpawnDot[], roll: number): { dot: SpawnDot; index: number } {
  const weights = dots.map((d) => Math.max(0, d.weight ?? 1));
  const total = weights.reduce((a, b) => a + b, 0);
  let r = roll * (total > 0 ? total : 1);
  for (let i = 0; i < dots.length; i++) {
    const w = weights[i] ?? 0;
    if (r < w) return { dot: dots[i]!, index: i };
    r -= w;
  }
  const last = dots.length - 1;
  return { dot: dots[last]!, index: last };
}

export function placeAsset(req: PlacementRequest): PlacementResult {
  const { rng } = req;
  const policy = req.policy || 'weighted';
  const dots = Array.from(req.candidateDots || []);

  const logBase = {
    assetKey: req.assetKey,
    layer: req.layerName,
    policy: policy,
    attempts: 0,
    seed: req.globalSeed,
    finalX: 0,
    finalY: 0,
  } as PlacementDecisionLog;

  if (dots.length === 0) {
    // No dots: default to center
    const mapped = mapNormalizedToPixels(req.mapper, 0.5, 0.5);
    const anchored = applyAnchor(mapped.x, mapped.y, req.asset, req.anchor);
    return {
      x: anchored.x,
      y: anchored.y,
      w: req.asset.width,
      h: req.asset.height,
      chosenDot: undefined,
      log: { ...logBase, finalX: anchored.x, finalY: anchored.y },
    };
  }

  const collision = req.collision && req.collision.enabled ? req.collision : undefined;
  const maxAttempts = Math.max(1, collision?.maxAttempts ?? 10);
  const padding = Math.max(0, collision?.paddingPx ?? 0);

  // For sequential policy, sort deterministically by id
  const ordered = policy === 'sequential' ? dots.slice().sort((a, b) => a.id.localeCompare(b.id)) : dots;

  let lastIdx = -1;
  let chosen: SpawnDot | undefined;
  let finalX = 0;
  let finalY = 0;
  let collided = false;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    logBase.attempts = attempt;
    let dotIdx = 0;
    if (policy === 'weighted') {
      const picked = pickDotWeighted(ordered, rng.next());
      chosen = picked.dot;
      dotIdx = picked.index;
    } else {
      // sequential: choose least used based on attempt number as a simple proxy (stable for deterministic runs)
      dotIdx = (attempt - 1) % ordered.length;
      chosen = ordered[dotIdx]!;
    }
    lastIdx = dotIdx;
    const wj = Math.max(0, chosen.jitterRadiusPx ?? req.jitterDefaultPx ?? 0);
    const nx = chosen.x;
    const ny = chosen.y;
    const mapped = mapNormalizedToPixels(req.mapper, nx, ny);
    // jitter: uniform circle
    const theta = rng.next() * Math.PI * 2;
    const radius = wj > 0 ? rng.next() * wj : 0;
    const jx = Math.cos(theta) * radius;
    const jy = Math.sin(theta) * radius;
    const posX = mapped.x + jx;
    const posY = mapped.y + jy;
    const anchored = applyAnchor(posX, posY, req.asset, req.anchor);
    const bbox = { x: anchored.x, y: anchored.y, w: req.asset.width, h: req.asset.height };
    // collision check
    collided = false;
    if (collision) {
      for (const b of req.occupiedBoxes) {
        if (aabbCollides(bbox, b, padding)) { collided = true; break; }
      }
    }
    if (!collision || !collided) {
      finalX = anchored.x;
      finalY = anchored.y;
      return {
        x: finalX,
        y: finalY,
        w: req.asset.width,
        h: req.asset.height,
        chosenDot: chosen,
        usedIndex: lastIdx,
        log: { ...logBase, chosenDotId: chosen?.id, finalX, finalY, jitterX: jx || undefined, jitterY: jy || undefined, collided: false },
      };
    }
  }
  // If here, collision persisted
  if (collision?.strategy === 'skip') {
    return {
      x: 0,
      y: 0,
      w: req.asset.width,
      h: req.asset.height,
      chosenDot: undefined,
      usedIndex: lastIdx,
      log: { ...logBase, chosenDotId: chosen?.id, finalX: 0, finalY: 0, collided: true, skipped: true },
    };
  }
  // fallback to center
  const mapped = mapNormalizedToPixels(req.mapper, 0.5, 0.5);
  const anchored = applyAnchor(mapped.x, mapped.y, req.asset, req.anchor);
  return {
    x: anchored.x,
    y: anchored.y,
    w: req.asset.width,
    h: req.asset.height,
    chosenDot: chosen,
    usedIndex: lastIdx,
    log: { ...logBase, chosenDotId: chosen?.id, finalX: anchored.x, finalY: anchored.y, collided: true, skipped: false },
  };
}

export function resolveCandidateDots(spawn: SpawnMap | undefined, layerName: string, assetKey: string): SpawnDot[] {
  if (!spawn || !Array.isArray(spawn.dots) || spawn.dots.length === 0) return [];
  const m = spawn.mappings;
  const assetDots = m?.assetToDotIds?.[assetKey];
  const layerDots = m?.layerToDotIds?.[layerName];
  const ids = (assetDots && assetDots.length ? assetDots : (layerDots && layerDots.length ? layerDots : []));
  if (!ids || ids.length === 0) return [];
  const byId = new Map(spawn.dots.map((d) => [d.id, d] as const));
  const out: SpawnDot[] = [];
  for (const id of ids) {
    const dot = byId.get(id);
    if (dot) out.push(dot);
  }
  return out;
}


