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
    symbol?: string;
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


