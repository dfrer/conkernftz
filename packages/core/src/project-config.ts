import { z } from 'zod';

const BlendModeSchema = z.enum([
  'normal',
  'clear',
  'source',
  'over',
  'in',
  'out',
  'atop',
  'dest',
  'dest-over',
  'dest-in',
  'dest-out',
  'dest-atop',
  'xor',
  'add',
  'linear-dodge',
  'saturate',
  'multiply',
  'screen',
  'overlay',
  'darken',
  'lighten',
  'color-dodge',
  'colour-dodge',
  'color-burn',
  'colour-burn',
  'hard-light',
  'soft-light',
  'difference',
  'exclusion',
  'subtract',
  'divide',
  'linear-burn',
  'vivid-light',
  'linear-light',
  'pin-light',
  'hard-mix',
  'darker-color',
  'lighter-color',
  'hue',
  'saturation',
  'color',
  'luminosity',
]);

const EffectsSchema = z
  .object({
    blend: BlendModeSchema.optional(),
    opacity: z.number().min(0).max(1).optional(),
    offsetX: z.number().int().optional(),
    offsetY: z.number().int().optional(),
    rotate: z.number().optional(),
    scale: z.number().positive().optional(),
    glow: z
      .object({
        color: z.string().optional(),
        radius: z.number().int().min(0).optional(),
        opacity: z.number().min(0).max(1).optional(),
        preset: z.string().optional(),
        inner: z.boolean().optional(),
      })
      .optional(),
    stroke: z
      .object({
        color: z.string().optional(),
        width: z.number().int().min(1).optional(),
        opacity: z.number().min(0).max(1).optional(),
        preset: z.string().optional(),
        position: z.enum(['outside', 'inside', 'center']).optional(),
      })
      .optional(),
    shadow: z
      .object({
        color: z.string().optional(),
        blur: z.number().int().min(0).optional(),
        offsetX: z.number().int().optional(),
        offsetY: z.number().int().optional(),
        opacity: z.number().min(0).max(1).optional(),
        preset: z.string().optional(),
        inner: z.boolean().optional(),
      })
      .optional(),
    extrude: z
      .object({
        color: z.string().optional(),
        depth: z.number().int().min(1).optional(),
        angle: z.number().optional(),
        opacity: z.number().min(0).max(1).optional(),
        soften: z.number().int().min(0).optional(),
        preset: z.string().optional(),
      })
      .optional(),
    blur: z.number().min(0).optional(),
    modulate: z
      .object({
        hue: z.number().optional(),
        saturation: z.number().optional(),
        brightness: z.number().optional(),
      })
      .optional(),
    colorOverlay: z
      .object({
        color: z.string().optional(),
        opacity: z.number().min(0).max(1).optional(),
        blend: BlendModeSchema.optional(),
        preset: z.string().optional(),
      })
      .optional(),
  })
  .partial();

const AssetOverrideSchema = z.object({
  target: z.enum(['filename', 'value']),
  match: z.string(),
  effects: EffectsSchema,
});

export const LayerSchema = z.object({
  name: z.string(),
  path: z.string(),
  rarity: z.enum(['filename', 'uniform']).optional(),
  required: z.boolean().optional(),
  blend: BlendModeSchema.optional(),
  opacity: z.number().min(0).max(1).optional(),
  effects: EffectsSchema.optional(),
  overrides: z.array(AssetOverrideSchema).optional(),
});

export const RulesSchema = z.object({
  mutuallyExclusive: z.array(z.array(z.string())).optional(),
  requires: z
    .array(z.object({ if: z.string(), thenAnyOf: z.array(z.string()) }))
    .optional(),
  maxOccurrences: z
    .array(z.object({ trait: z.string(), max: z.number().int().positive() }))
    .optional(),
});

export const RaritySchema = z.object({
  mode: z.literal('filenameDelimiter'),
  delimiter: z.string(),
  defaultWeight: z.number().int().positive(),
});

export const UniquenessSchema = z.object({
  hash: z.literal('sha256'),
  ignore: z.array(z.string()).optional(),
});

export const ImageSchema = z.object({
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  background: z.string().optional(),
});

export const StorageSchema = z.object({
  provider: z.enum(['arweave', 'ipfs']),
  arweave: z
    .object({ bundlrNode: z.string(), currency: z.string(), keyPath: z.string() })
    .optional(),
  ipfs: z
    .object({ pinataKey: z.string().optional(), pinataSecret: z.string().optional(), nftStorageKey: z.string().optional() })
    .optional(),
});

export const ChainSolanaSchema = z.object({
  cluster: z.enum(['devnet', 'testnet', 'mainnet-beta']),
  rpcUrl: z.string().optional(),
  walletKeypairPath: z.string(),
  sellerFeeBasisPoints: z.number().int().min(0).max(10000),
  creators: z.array(
    z.object({ address: z.string(), share: z.number().int().min(0).max(100), verified: z.boolean().optional() }),
  ),
  collection: z.object({ mint: z.string().nullable() }),
  isMutable: z.boolean().optional(),
  usePnft: z.boolean().optional(),
  rulesetPda: z.string().nullable().optional(),
});

export const ChainSchema = z.object({
  target: z.enum(['solana']),
  solana: ChainSolanaSchema.optional(),
});

export const ProjectConfigSchema = z.object({
  name: z.string(),
  symbol: z.string().optional(),
  description: z.string().optional(),
  editionSize: z.number().int().positive(),
  image: ImageSchema,
  layers: z.array(LayerSchema),
  rules: RulesSchema.optional(),
  rarity: RaritySchema,
  uniqueness: UniquenessSchema,
  export: z.object({
    outDir: z.string(),
    previewOutDir: z.string().optional(),
    imageFormat: z.enum(['png', 'webp', 'gif']).default('png'),
    includePreviewContactSheet: z.boolean().optional(),
  }),
  storage: StorageSchema,
  chain: ChainSchema,
});

export type ProjectConfig = z.infer<typeof ProjectConfigSchema>;
