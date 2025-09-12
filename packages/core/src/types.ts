export type TraitKV = Record<string, string>;

export interface LayerSpec {
  name: string;
  path: string;
  rarity?: 'filename' | 'uniform';
  required?: boolean;
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
