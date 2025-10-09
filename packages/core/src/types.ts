export type TraitKV = Record<string, string>;

export interface LayerSpec {
  name: string;
  path: string;
  rarity?: 'filename' | 'uniform';
  required?: boolean;
  // Experimental: Only spawn/render this layer if any of these trait strings
  // (formatted as "Layer:Value", e.g., "Character:Angel") are already present
  // in the current composition during generation. If omitted or empty, the
  // layer can spawn unconditionally (subject to other rules).
  spawnWhenAnyOf?: string[];
  // Advanced conditional spawning: gate this layer with boolean logic
  // across trait presence. All specified fields are ANDed together.
  spawnWhen?: TraitCondition;
  // Additional negative guard; if true, layer will be skipped.
  spawnUnless?: TraitCondition;
  // Option-level conditional rules affecting inclusion/weights.
  optionRules?: LayerOptionRule[];
  // Default blending for this layer when compositing. Individual asset options
  // may override these in the future; for now, they apply to all options of the layer.
  blend?: BlendMode;
  opacity?: number; // 0..1
  // Optional default effects for all assets in this layer. Individual
  // per-asset overrides can refine/override these.
  effects?: AssetEffects;
  // Optional per-asset overrides. Each entry targets a specific asset in this
  // layer (by original filename or derived trait value) and can override
  // compositing parameters and effects for that asset only.
  overrides?: AssetOverride[];
}

// Effect knobs that can be applied to a single asset.
// Not all are necessarily implemented by the compositor yet; unknown fields
// should be ignored gracefully by downstream code.
export interface AssetEffects {
  // Compositing controls
  blend?: BlendMode;
  opacity?: number; // 0..1
  offsetX?: number; // pixels, can be negative
  offsetY?: number; // pixels, can be negative
  rotate?: number; // degrees
  scale?: number; // uniform scale multiplier

  // Visual effects (placeholders for future implementation)
  glow?: { color?: string; radius?: number; opacity?: number; preset?: string; inner?: boolean };
  stroke?: { color?: string; width?: number; opacity?: number; preset?: string; position?: 'outside' | 'inside' | 'center' };
  shadow?: { color?: string; blur?: number; offsetX?: number; offsetY?: number; opacity?: number; preset?: string; inner?: boolean };
  // Simple 3D extrusion effect by stacking offset silhouettes
  extrude?: { color?: string; depth?: number; angle?: number; opacity?: number; soften?: number; preset?: string };
  // Adjustments to the base layer content (applied before other effects)
  blur?: number; // Gaussian blur radius in px
  modulate?: { hue?: number; saturation?: number; brightness?: number }; // hue in degrees, others multipliers
  colorOverlay?: { color?: string; opacity?: number; blend?: BlendMode; preset?: string };
}

export interface AssetOverride {
  // How to match the asset in this layer
  target: 'filename' | 'value';
  // The string to match against target (e.g. "Hat#10.png" or value "Hat")
  match: string;
  // The effect overrides to apply
  effects: AssetEffects;
}

export interface RuleEngine {
  validate(traits: TraitKV): { ok: true } | { ok: false; reason: string };
}

// Boolean condition over trait presence (strings like "Layer:Value").
// All provided fields are combined with AND; groups within each field obey
// their own semantics (anyOf = OR, allOf = AND, noneOf = NOT-OR).
export interface TraitCondition {
  anyOf?: string[];
  allOf?: string[];
  noneOf?: string[];
  not?: TraitCondition;
}

export interface LayerOptionRuleMatch {
  target: 'value' | 'filename';
  pattern: string; // exact match
}

export interface LayerOptionRule {
  match: LayerOptionRuleMatch;
  when?: TraitCondition;
  unless?: TraitCondition;
  // Actions (exclusive): either exclude matched option, or multiply weight
  exclude?: boolean;
  weightMultiply?: number; // e.g., 0.0 to remove, 0.5 to reduce, 2 to boost
}

export type TransformTranslateMode = 'set' | 'add';
export type TransformRotateMode = 'set' | 'add';
export type TransformScaleMode = 'set' | 'multiply';

export interface TransformRuleTarget {
  layer?: string;
  layers?: string[];
  values?: string[];
  filenames?: string[];
}

export interface TransformTranslate {
  x?: number;
  y?: number;
  mode?: TransformTranslateMode;
}

export interface TransformRotate {
  degrees: number;
  mode?: TransformRotateMode;
}

export interface TransformScale {
  factor: number;
  mode?: TransformScaleMode;
}

export interface TransformRule {
  id?: string;
  description?: string;
  priority?: number;
  when?: TraitCondition;
  target: TransformRuleTarget;
  translate?: TransformTranslate;
  rotate?: TransformRotate;
  scale?: TransformScale;
}

// A feature-rich set of Photoshop-like blend modes supported by our compositor.
// Some are mapped directly to Sharp's native modes; others are computed via CPU fallback.
export type BlendMode =
  | 'normal'
  | 'clear'
  | 'source'
  | 'over'
  | 'in'
  | 'out'
  | 'atop'
  | 'dest'
  | 'dest-over'
  | 'dest-in'
  | 'dest-out'
  | 'dest-atop'
  | 'xor'
  | 'add' // alias: linear-dodge
  | 'linear-dodge'
  | 'saturate'
  | 'multiply'
  | 'screen'
  | 'overlay'
  | 'darken'
  | 'lighten'
  | 'color-dodge'
  | 'colour-dodge'
  | 'color-burn'
  | 'colour-burn'
  | 'hard-light'
  | 'soft-light'
  | 'difference'
  | 'exclusion'
  | 'subtract'
  | 'divide'
  | 'linear-burn'
  | 'vivid-light'
  | 'linear-light'
  | 'pin-light'
  | 'hard-mix'
  | 'darker-color'
  | 'lighter-color'
  | 'hue'
  | 'saturation'
  | 'color'
  | 'luminosity';

export interface ChainAdapter {
  id: 'solana' | 'ethereum' | 'tezos' | 'bitcoin';
  validateProjectConfig(cfg: unknown): void;
  buildOffchainJson(input: {
    index: number;
    name: string;
    description: string;
    imageUri: string;
    animationUri?: string;
    attributes: Array<{ trait_type: string; value: string }>;
    external_url?: string;
    files?: Array<{ uri: string; type: string }>;
  }): Record<string, unknown>;
  mint?: (args: {
    wallet: unknown;
    jsonUri: string;
    name: string;
    symbol?: string;
    sellerFeeBasisPoints?: number;
    creators?: Array<{ address: string; share: number; verified?: boolean }>;
    collectionMint?: string | null;
    isMutable?: boolean;
    usePnft?: boolean;
    rulesetPda?: string | null;
  }) => Promise<{ mint: string; metadataPda: string }>;
}

// ---------------- Spawn Dots (author-controlled placement) ----------------

export type FitMode = 'contain' | 'cover' | 'stretch';

export type SelectionPolicy = 'weighted' | 'sequential';

export type Anchor = 'center' | 'top-left' | 'custom';

export interface SpawnDot {
  id: string; // stable dot id
  // normalized position within authoring canvas space (0..1)
  x: number;
  y: number;
  weight?: number; // default 1
  jitterRadiusPx?: number; // optional jitter radius in pixels
  tags?: string[]; // optional
  maxPlacementsPerComposition?: number; // optional cap per composition
}

export interface SpawnMappings {
  // map layer name -> list of dot ids
  layerToDotIds?: Record<string, string[]>;
  // map asset key -> list of dot ids. Asset key convention: "LayerName:TraitValue"
  assetToDotIds?: Record<string, string[]>;
}

export interface JitterPolicy {
  defaultRadiusPx?: number;
  distribution?: 'uniform' | 'gaussian';
}

export interface CollisionPolicy {
  enabled?: boolean;
  paddingPx?: number; // extra padding for AABB checks
  strategy?: 'retry' | 'skip' | 'fallback';
  maxAttemptsPerAsset?: number;
}

export interface SpawnRules {
  selection?: SelectionPolicy; // default 'weighted'
  jitter?: JitterPolicy;
  collision?: CollisionPolicy;
  fitMode?: FitMode; // default 'contain'
  // Preferred asset anchor for bounding box; can be overridden per adapter call
  anchor?: Anchor;
}

export interface SpawnMapV1 {
  version: 1;
  authoringSize: { width: number; height: number };
  dots: SpawnDot[];
  mappings?: SpawnMappings;
  rules?: SpawnRules;
}

export type SpawnMap = SpawnMapV1; // future versions can union here

export interface PlacementDecisionLog {
  assetKey: string; // e.g., "Layer:Value" or file path
  layer: string;
  chosenDotId?: string;
  policy: SelectionPolicy;
  attempts: number;
  seed: string | number;
  finalX: number; // pixel coordinates in output space
  finalY: number;
  jitterX?: number;
  jitterY?: number;
  collided?: boolean;
  skipped?: boolean;
}
