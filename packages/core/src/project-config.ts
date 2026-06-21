import { z } from 'zod';
import type { TraitCondition } from './types.js';

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
    recolor: z
      .object({
        low: z.string().optional(),
        high: z.string().optional(),
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

const TraitConditionSchema: z.ZodType<TraitCondition> = z.lazy(() =>
  z
    .object({
      anyOf: z.array(z.string()).optional(),
      allOf: z.array(z.string()).optional(),
      noneOf: z.array(z.string()).optional(),
      not: TraitConditionSchema.optional(), // self-referential
    })
    .partial(),
);

const LayerOptionRuleSchema = z.object({
  match: z.object({ target: z.enum(['value','filename']), pattern: z.string() }),
  when: TraitConditionSchema.optional(),
  unless: TraitConditionSchema.optional(),
  exclude: z.boolean().optional(),
  weightMultiply: z.number().positive().optional(),
});

const TransformTargetSchema = z
  .object({
    layer: z.string().optional(),
    layers: z.array(z.string()).optional(),
    values: z.array(z.string()).optional(),
    filenames: z.array(z.string()).optional(),
  })
  .refine(
    (val) =>
      (typeof val.layer === 'string' && val.layer.trim().length > 0) ||
      (Array.isArray(val.layers) && val.layers.length > 0),
    { message: 'Transform target must specify at least one layer', path: ['layer'] },
  );

const TransformTranslateSchema = z
  .object({
    x: z.number().optional(),
    y: z.number().optional(),
    mode: z.enum(['add', 'set']).optional(),
  })
  .refine((val) => val.x !== undefined || val.y !== undefined, {
    message: 'Translate must set x or y',
    path: ['x'],
  });

const TransformRotateSchema = z.object({
  degrees: z.number(),
  mode: z.enum(['add', 'set']).optional(),
});

const TransformScaleSchema = z.object({
  factor: z.number().positive(),
  mode: z.enum(['multiply', 'set']).optional(),
});

const TransformRuleSchema = z
  .object({
    id: z.string().optional(),
    description: z.string().optional(),
    priority: z.number().optional(),
    when: TraitConditionSchema.optional(),
    target: TransformTargetSchema,
    translate: TransformTranslateSchema.optional(),
    rotate: TransformRotateSchema.optional(),
    scale: TransformScaleSchema.optional(),
  })
  .refine((val) => val.translate || val.rotate || val.scale, {
    message: 'Transform rule must include at least one action',
    path: ['translate'],
  });


const AnimationKeyframeSchema = z.object({ from: z.number(), to: z.number() });

const LayerAnimationSchema = z.object({
  rotate: AnimationKeyframeSchema.optional(),
  scale: AnimationKeyframeSchema.optional(),
  translateX: AnimationKeyframeSchema.optional(),
  translateY: AnimationKeyframeSchema.optional(),
  opacity: AnimationKeyframeSchema.optional(),
  easing: z.enum(['linear', 'easeInOut', 'sine']).optional(),
  loopMode: z.enum(['loop', 'pingpong']).optional(),
});

export const LayerSchema = z.object({
  name: z.string(),
  path: z.string(),
  rarity: z.enum(['filename', 'uniform']).optional(),
  required: z.boolean().optional(),
  animation: LayerAnimationSchema.optional(),
  spawnWhenAnyOf: z.array(z.string()).optional(),
  spawnWhen: TraitConditionSchema.optional(),
  spawnUnless: TraitConditionSchema.optional(),
  optionRules: z.array(LayerOptionRuleSchema).optional(),
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
  targets: z
    .array(z.object({ trait: z.string(), count: z.number().int().nonnegative() }))
    .optional(),
  transforms: z.array(TransformRuleSchema).optional(),
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
  // Modern providers: irys (Arweave), pinata (IPFS via JWT), local (filesystem).
  // 'arweave' (Bundlr) and 'ipfs' (nft.storage/legacy Pinata) are deprecated and now
  // throw a migration error at upload time, but still parse so old configs load.
  provider: z.enum(['irys', 'pinata', 'local', 'arweave', 'ipfs']),
  irys: z
    .object({
      token: z.string().optional(),
      keyPath: z.string().optional(),
      node: z.string().optional(),
      rpcUrl: z.string().optional(),
    })
    .optional(),
  pinata: z
    .object({ jwt: z.string().optional(), gateway: z.string().optional() })
    .optional(),
  local: z
    .object({ outDir: z.string().optional(), gatewayBase: z.string().optional() })
    .optional(),
  // Deprecated legacy blocks (kept for back-compat parsing only).
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
  // Optional Core Candy Machine public-mint configuration (alongside direct Umi mint).
  candyMachine: z
    .object({
      collectionName: z.string().optional(),
      collectionUri: z.string().optional(),
      nameLength: z.number().int().positive().optional(),
      uriLength: z.number().int().positive().optional(),
      guards: z
        .object({
          solPayment: z.object({ sol: z.number().nonnegative(), destination: z.string() }).optional(),
          startDate: z.object({ date: z.union([z.string(), z.number()]) }).optional(),
          mintLimit: z.object({ id: z.number().int().min(0), limit: z.number().int().positive() }).optional(),
          allowList: z.object({ path: z.string() }).optional(),
        })
        .optional(),
      // Populated after the in-app/CLI Candy-Machine create (the on-chain CM + its collection),
      // mirroring EVM's chain.evm.launch.contractAddress. Used by the Launch status read.
      address: z.string().optional(),
      collectionAddress: z.string().optional(),
    })
    .optional(),
});

/**
 * Phase-L launch-contract (`ConkernftzLaunch`) config. Optional — only set when using the
 * launch-grade phased mint rather than the simple owner-mint collection. Prices are wei as
 * decimal STRINGS (JSON has no bigint); the allowlist cap is per-address in the Merkle proof,
 * so there is no global allowlist cap here (decision A).
 */
export const ChainEvmLaunchSchema = z.object({
  // Populated after `deploy-launch`.
  contractAddress: z.string().optional(),
  treasury: z.string().optional(),
  placeholderUri: z.string().optional(),
  provenanceHash: z.string().optional(),
  allowlistRoot: z.string().optional(),
  allowlistPriceWei: z.string().optional(),
  publicPriceWei: z.string().optional(),
  publicWalletCap: z.number().int().min(0).optional(),
  maxPerTx: z.number().int().min(1).optional(),
});

export const ChainEvmSchema = z.object({
  chainId: z.number().int().positive(),
  rpcUrl: z.string(),
  privateKeyPath: z.string(),
  // Populated after `deploy`; reused by `mint`.
  contractAddress: z.string().optional(),
  baseUri: z.string().optional(),
  maxSupply: z.number().int().min(0).optional(),
  royaltyReceiver: z.string().optional(),
  royaltyBps: z.number().int().min(0).max(10000).optional(),
  // Optional phased-launch contract config (separate from the simple collection above).
  launch: ChainEvmLaunchSchema.optional(),
});

export const ChainSchema = z.object({
  target: z.enum(['solana', 'evm']),
  solana: ChainSolanaSchema.optional(),
  evm: ChainEvmSchema.optional(),
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
  // Optional spawn map configuration is stored as an external JSON file typically.
  // For convenience, allow embedding a minimal config pointer here.
  spawn: z
    .object({
      // Relative path to spawn map JSON from project root. If provided, it will be loaded at generation time.
      mapPath: z.string().optional(),
      // Default fit mode for mapping normalized coords to output pixels when using the spawn map.
      fitMode: z.enum(['contain', 'cover', 'stretch']).optional(),
    })
    .optional(),
  export: z.object({
    outDir: z.string(),
    previewOutDir: z.string().optional(),
    imageFormat: z.enum(['png', 'webp', 'gif']).default('png'),
    includePreviewContactSheet: z.boolean().optional(),
    animation: z
      .object({
        enabled: z.boolean().optional(),
        fps: z.number().int().min(1).max(60).optional(),
        durationMs: z.number().int().min(1).optional(),
        format: z.array(z.enum(['gif', 'mp4', 'webp'])).optional(),
        loop: z.boolean().optional(),
      })
      .optional(),
  }),
  storage: StorageSchema,
  chain: ChainSchema,
  experimental: z
    .object({
      compositor: z
        .object({
          superSample: z.number().int().min(1).max(4).optional(),
          forceCpu: z.boolean().optional(),
        })
        .optional(),
      generation: z
        .object({
          seedJitter: z.number().min(0).max(1).optional(),
          shuffleLayers: z.boolean().optional(),
        })
        .optional(),
    })
    .optional(),
  // Mint-experience config (the interactive reveal/card-pack moment). The renderer owns the
  // canonical shape (renderer-next/lib/mintExperience); core validates leniently and
  // passes unknown keys through so the field round-trips losslessly.
  mintExperience: z
    .object({
      kind: z.enum(['cardPack', 'flip', 'fade']).optional(),
      packCount: z.number().int().optional(),
      durationMs: z.number().int().optional(),
      label: z.string().optional(),
      shake: z.boolean().optional(),
      autoFlip: z.boolean().optional(),
      backArt: z.string().optional(),
      packArt: z.string().optional(),
      accent: z.string().optional(),
    })
    .passthrough()
    .optional(),
  // Mint-site builder config (theme + blocks). The renderer owns the canonical shape
  // (renderer-next/lib/site); core accepts it leniently and passes it through losslessly.
  site: z
    .object({
      theme: z.record(z.string(), z.unknown()).optional(),
      blocks: z.array(z.record(z.string(), z.unknown())).optional(),
    })
    .passthrough()
    .optional(),
});

export type ProjectConfig = z.infer<typeof ProjectConfigSchema>;
