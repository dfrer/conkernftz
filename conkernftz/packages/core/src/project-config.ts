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

export const LayerSchema = z.object({
  name: z.string(),
  path: z.string(),
  rarity: z.enum(['filename', 'uniform']).optional(),
  required: z.boolean().optional(),
  blend: BlendModeSchema.optional(),
  opacity: z.number().min(0).max(1).optional(),
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
  provider: z.enum(['irys', 'pinata', 'local']),
  // Permanent Arweave storage via Irys (formerly Bundlr).
  irys: z
    .object({
      token: z.enum(['solana', 'ethereum']).optional(),
      keyPath: z.string(),
      rpcUrl: z.string().optional(),
    })
    .optional(),
  // IPFS via the modern Pinata SDK (JWT auth).
  pinata: z
    .object({
      jwt: z.string().optional(),
      gateway: z.string().optional(),
    })
    .optional(),
  // Offline/no-upload provider for local testing.
  local: z
    .object({ baseUri: z.string().optional() })
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
  // Pattern placement system
  patterns: z
    .array(
      z.object({
        id: z.string(),
        name: z.string().optional(),
        dots: z.array(
          z.object({
            id: z.string(),
            x: z.number().min(0).max(1),
            y: z.number().min(0).max(1),
            weight: z.number().min(0),
            color: z.string().optional(),
            jitterPx: z
              .object({ x: z.number().min(0).optional(), y: z.number().min(0).optional(), radial: z.number().min(0).optional() })
              .optional(),
            rotation: z.object({ baseDeg: z.number().optional(), varianceDeg: z.number().min(0).optional() }).optional(),
          }),
        ),
      }),
    )
    .default([]),
  patternBindings: z
    .array(
      z.object({
        id: z.string(),
        target: z.union([
          z.object({ type: z.literal('layer'), layer: z.string() }),
          z.object({ type: z.literal('asset'), layer: z.string(), value: z.string().optional(), filename: z.string().optional() }),
        ]),
        weight: z.number().min(0).optional(),
        choices: z.array(z.object({ patternId: z.string(), weight: z.number().min(0) })),
        anchor: z
          .union([
            z.object({ mode: z.enum(['center', 'topLeft', 'topRight', 'bottomLeft', 'bottomRight']) }),
            z.object({ mode: z.literal('custom'), x: z.number().min(0).max(1), y: z.number().min(0).max(1) }),
          ])
          .optional(),
        collision: z
          .object({ enabled: z.boolean().optional(), minDistancePx: z.number().min(0).optional(), maxAttempts: z.number().int().min(1).optional() })
          .optional(),
        rotation: z
          .union([
            z.object({ mode: z.literal('none') }),
            z.object({ mode: z.literal('uniform'), minDeg: z.number().optional(), maxDeg: z.number().optional() }),
            z.object({ mode: z.literal('inheritDot') }),
          ])
          .optional(),
      }),
    )
    .default([]),
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


