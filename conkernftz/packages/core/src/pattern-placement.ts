import { createSeededRng, type SeededRng } from './rng.js';
import type { Pattern, PatternBinding, Anchor, PatternDot, RotationStrategy } from './types/pattern.js';

export interface CanvasSize { width: number; height: number }
export interface AssetSize { width: number; height: number }

export interface PlacementInput {
  seed: string | number;
  canvas: CanvasSize;
  asset: AssetSize;
  pattern: Pattern;
  binding: PatternBinding;
  // Centers of already placed items within this image for collision checks
  existingCenters?: Array<{ x: number; y: number }>;
}

export interface PlacementResult {
  patternId: string;
  dotId: string;
  // Pixel coordinates for top-left of the asset after anchoring
  left: number;
  top: number;
  // Center used for collision checks
  centerX: number;
  centerY: number;
  rotationDeg: number;
}

export function placeFromPattern(input: PlacementInput): PlacementResult {
  const rng = createSeededRng(input.seed);
  const { pattern, binding, canvas, asset } = input;
  if (!pattern.dots.length) {
    throw new Error(`Pattern ${pattern.id} has no dots`);
  }

  const sampler = buildAliasSampler(pattern.dots.map((d) => Math.max(0, d.weight)));
  const collision = binding.collision || {};
  const minDist = Math.max(0, collision.minDistancePx ?? 32);
  const maxAttempts = Math.max(1, collision.maxAttempts ?? 8);
  const centers = input.existingCenters || [];

  let pickedDot: PatternDot | null = null;
  let final: PlacementResult | null = null;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const idx = sampler(rng);
    const dot = pattern.dots[idx]!;
    const base = normToPixels(dot.x, dot.y, canvas);
    const jitter = sampleJitter(dot, rng);
    const rotation = sampleRotation(binding.rotation, dot, rng);
    const anchor = toAnchor(binding.anchor);
    const anchorPx = { x: anchor.x * asset.width, y: anchor.y * asset.height };
    const centerX = clamp(base.x + jitter.dx, 0, canvas.width);
    const centerY = clamp(base.y + jitter.dy, 0, canvas.height);
    const left = Math.round(centerX - anchorPx.x);
    const top = Math.round(centerY - anchorPx.y);

    const violates = collision.enabled
      ? centers.some((c) => dist(c.x, c.y, centerX, centerY) < minDist)
      : false;
    if (violates) {
      continue;
    }
    pickedDot = dot;
    final = {
      patternId: pattern.id,
      dotId: dot.id,
      left,
      top,
      centerX,
      centerY,
      rotationDeg: rotation,
    };
    break;
  }

  if (!final || !pickedDot) {
    // If all attempts failed due to collisions, fall back to a deterministic first pick without collision
    const idx = sampler(createSeededRng(input.seed));
    const dot = pattern.dots[idx]!;
    const base = normToPixels(dot.x, dot.y, canvas);
    const jitter = sampleJitter(dot, createSeededRng(String(input.seed) + ':fb'));
    const rotation = sampleRotation(binding.rotation, dot, createSeededRng(String(input.seed) + ':r'));
    const anchor = toAnchor(binding.anchor);
    const anchorPx = { x: anchor.x * asset.width, y: anchor.y * asset.height };
    const centerX = clamp(base.x + jitter.dx, 0, canvas.width);
    const centerY = clamp(base.y + jitter.dy, 0, canvas.height);
    return {
      patternId: pattern.id,
      dotId: dot.id,
      left: Math.round(centerX - anchorPx.x),
      top: Math.round(centerY - anchorPx.y),
      centerX,
      centerY,
      rotationDeg: rotation,
    };
  }
  return final;
}

function normToPixels(x: number, y: number, canvas: CanvasSize): { x: number; y: number } {
  return { x: x * canvas.width, y: y * canvas.height };
}

function clamp(n: number, lo: number, hi: number): number {
  if (n < lo) return lo;
  if (n > hi) return hi;
  return n;
}

function dist(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}

function toAnchor(a?: Anchor): { x: number; y: number } {
  if (!a) return { x: 0.5, y: 0.5 };
  if (a.mode === 'custom') {
    return { x: clamp(a.x, 0, 1), y: clamp(a.y, 0, 1) };
  }
  switch (a.mode) {
    case 'topLeft': return { x: 0, y: 0 };
    case 'topRight': return { x: 1, y: 0 };
    case 'bottomLeft': return { x: 0, y: 1 };
    case 'bottomRight': return { x: 1, y: 1 };
    case 'center':
    default:
      return { x: 0.5, y: 0.5 };
  }
}

function sampleJitter(dot: PatternDot, rng: SeededRng): { dx: number; dy: number } {
  const j = dot.jitterPx || {};
  if (typeof j.radial === 'number' && j.radial > 0) {
    // Sample uniformly in disk using sqrt trick
    const r = Math.sqrt(rng.next()) * j.radial;
    const theta = rng.next() * 2 * Math.PI;
    return { dx: r * Math.cos(theta), dy: r * Math.sin(theta) };
  }
  const jx = Math.max(0, j.x ?? 0);
  const jy = Math.max(0, j.y ?? 0);
  // Uniform in [-jx, jx], [-jy, jy]
  const dx = (rng.next() * 2 - 1) * jx;
  const dy = (rng.next() * 2 - 1) * jy;
  return { dx, dy };
}

function sampleRotation(strategy: RotationStrategy | undefined, dot: PatternDot, rng: SeededRng): number {
  if (!strategy || strategy.mode === 'none') {
    return dot.rotation?.baseDeg ?? 0;
  }
  if (strategy.mode === 'uniform') {
    const min = strategy.minDeg ?? 0;
    const max = strategy.maxDeg ?? 360;
    return min + rng.next() * (max - min);
  }
  // inherit from dot
  const base = dot.rotation?.baseDeg ?? 0;
  const varDeg = Math.max(0, dot.rotation?.varianceDeg ?? 0);
  return base + (rng.next() * 2 - 1) * varDeg;
}

// Vose's alias method
function buildAliasSampler(weights: number[]): (rng: SeededRng) => number {
  const n = weights.length;
  if (n === 0) return () => 0;
  const sum = weights.reduce((a, b) => a + b, 0);
  if (sum <= 0) {
    // All zero: pick uniformly
    return (rng) => rng.int(n);
  }
  const prob = new Array<number>(n);
  const alias = new Array<number>(n);
  const scaled = weights.map((w) => (w / sum) * n);
  const small: number[] = [];
  const large: number[] = [];
  for (let i = 0; i < n; i++) {
    const s = scaled[i] ?? 0;
    if (s < 1) small.push(i); else large.push(i);
  }
  while (small.length && large.length) {
    const l = small.pop()!;
    const g = large.pop()!;
    const sl = scaled[l] ?? 0;
    prob[l] = sl;
    alias[l] = g;
    const sg = scaled[g] ?? 0;
    scaled[g] = sg - (1 - sl);
    if (scaled[g] < 1) small.push(g); else large.push(g);
  }
  while (large.length) { const idx = large.pop()!; prob[idx] = 1; }
  while (small.length) { const idx = small.pop()!; prob[idx] = 1; }

  return (rng: SeededRng) => {
    const i = rng.int(n);
    const r = rng.next();
    const p = prob[i] ?? 1;
    const a = alias[i];
    return r < p ? i : (typeof a === 'number' ? a : i);
  };
}

export type { PlacementResult as PatternPlacementResult };


