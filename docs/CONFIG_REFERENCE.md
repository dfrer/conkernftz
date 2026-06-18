## Project Configuration Reference (foundry.config.json)

This file controls generation, compositing, storage, and chain settings. It is validated with Zod schemas in `@foundry/core`.

### Top-level fields

- `name` (string): Collection name.
- `symbol` (string, optional): Token symbol.
- `description` (string, optional): Default description for metadata JSON.
- `editionSize` (positive int): Total editions to build unless overridden via CLI.
- `image` (object):
  - `width` (int > 0)
  - `height` (int > 0)
  - `background` (string, optional): CSS-like color name or hex.
- `layers` (array of Layer): Layer order top-to-bottom.
- `rules` (optional): Trait logic; see below.
- `rarity` (object):
  - `mode`: `filenameDelimiter`
  - `delimiter` (string): e.g., `#` in `Trait#10.png`.
  - `defaultWeight` (positive int): weight used when no weight suffix.
- `uniqueness` (object):
  - `hash`: `sha256`
  - `ignore` (string[], optional): layer names to ignore for DNA.
- `spawn` (optional): placement map pointer
  - `mapPath` (string, optional): relative path to a spawn map JSON.
  - `fitMode` (optional): `contain` | `cover` | `stretch`.
- `export` (object):
  - `outDir` (string): base output directory (e.g., `build`).
  - `previewOutDir` (string, optional): directory for previews; defaults to `<outDir>/preview`.
  - `imageFormat` (`png` | `webp` | `gif`, default `png`)
  - `includePreviewContactSheet` (boolean, optional)
- `storage` (object): provider credentials; see Storage section.
- `chain` (object): on-chain settings; see Chain section.
- `experimental` (optional):
  - `compositor`: `{ superSample?: 1..4, forceCpu?: boolean }`
  - `generation`: `{ seedJitter?: 0..1, shuffleLayers?: boolean }`

### Layer

```
{
  "name": "Eyes",
  "path": "layers/eyes",
  "rarity": "filename" | "uniform",
  "required": true,
  "spawnWhenAnyOf": ["Headwear:Crown"],
  "spawnWhen": { "anyOf": ["Body:Alien"] },
  "spawnUnless": { "noneOf": ["Mask:Full"] },
  "optionRules": [
    { "match": { "target": "value", "pattern": "Laser" }, "weightMultiply": 0.5 }
  ],
  "blend": "overlay",
  "opacity": 0.85,
  "effects": { "glow": { "preset": "subtle" } },
  "overrides": [
    { "target": "value", "match": "Laser", "effects": { "stroke": { "preset": "thin" } } }
  ]
}
```

Effects supported in schema: `blend`, `opacity`, `offsetX`, `offsetY`, `rotate`, `scale`, `glow`, `stroke`, `shadow`, `extrude`, `blur`, `modulate`, `colorOverlay`.

Note: Some effect knobs (e.g., `rotate`, `scale`) may be partially implemented in the compositor; unsupported combinations will be ignored or computed via CPU fallback as needed.

### Rules

- `mutuallyExclusive`: array of pairs/groups of traits that cannot co-exist.
- `requires`: array of `{ if: string, thenAnyOf: string[] }`.
- `maxOccurrences`: array of `{ trait: string, max: int }` — an upper bound on how many editions may carry a trait.
- `targets`: array of `{ trait: string, count: int }` — an **exact** target: the generator steers selection so the trait appears in exactly `count` editions (best-effort if targets over- or under-specify a layer, or conflict with other rules/uniqueness/conditional spawn). Where `maxOccurrences` only caps, `targets` actively fills toward the count.

Trait strings use the form `Layer:Value` (e.g., `Eyes:Laser`).

### Storage

```
{
  "provider": "arweave" | "ipfs",
  "arweave": { "bundlrNode": "https://node1.bundlr.network", "currency": "sol", "keyPath": "./keys/bundlr.json" },
  "ipfs": { "nftStorageKey": "...", "pinataKey": "...", "pinataSecret": "..." }
}
```

- Arweave uploads normalize to HTTPS gateway URLs (`https://arweave.net/<id>`).
- IPFS uploads return `ipfs://` URIs (gateway selection is wallet/app dependent).

### Chain (Solana)

```
{
  "target": "solana",
  "solana": {
    "cluster": "devnet" | "testnet" | "mainnet-beta",
    "rpcUrl": "", // optional; can also use SOLANA_RPC_URL env var
    "walletKeypairPath": "./keys/solana.json",
    "sellerFeeBasisPoints": 500,
    "creators": [{ "address": "...", "share": 100, "verified": true }],
    "collection": { "mint": null },
    "isMutable": true,
    "usePnft": false,
    "rulesetPda": null
  }
}
```

### Tips

- Use `foundry validate` after editing the config.
- Use deterministic seeds for reproducibility in `preview`/`build`.
- If strict rules make generation slow, increase `--max-attempts` or temporarily allow duplicates for previews.



