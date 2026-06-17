export interface PatternDot {
  id: string;
  // Normalized coordinates in [0, 1]
  x: number;
  y: number;
  // Relative selection weight (>= 0)
  weight: number;
  // Optional per-dot color hint for UI editors/overlays
  color?: string;
  // Optional jitter in pixels. If both x/y provided, use rectangular jitter; if only radial provided, sample in a disk.
  jitterPx?: { x?: number; y?: number; radial?: number };
  // Optional base rotation and variance for this dot (degrees)
  rotation?: { baseDeg?: number; varianceDeg?: number };
}

export interface Pattern {
  id: string;
  name?: string;
  dots: PatternDot[];
}

export type AnchorPreset = 'center' | 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight';

export interface AnchorCustom {
  mode: 'custom';
  // Normalized anchor within the asset bounds (0..1). For example, {x:0.5,y:0.5} is center.
  x: number;
  y: number;
}

export type Anchor = AnchorCustom | { mode: AnchorPreset };

export type RotationStrategy =
  | { mode: 'none' }
  | { mode: 'uniform'; minDeg?: number; maxDeg?: number }
  | { mode: 'inheritDot' };

export interface PatternChoice {
  patternId: string;
  weight: number;
}

export type PatternTarget =
  | { type: 'layer'; layer: string }
  | { type: 'asset'; layer: string; value?: string; filename?: string };

export interface CollisionOptions {
  enabled?: boolean; // default false
  minDistancePx?: number; // default 32
  maxAttempts?: number; // default 8
}

export interface PatternBinding {
  id: string;
  target: PatternTarget;
  weight?: number; // weight of this binding when multiple match the same target
  choices: PatternChoice[];
  anchor?: Anchor;
  collision?: CollisionOptions;
  rotation?: RotationStrategy;
}


