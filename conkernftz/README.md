# conkernftz — NFT Art Foundry

A modern, type-safe generative **NFT art foundry** (a HashLips replacement). Compose layered
artwork with weighted rarity, enforce trait rules, place assets with pattern overlays, generate
deterministic editions, preview results, upload to permanent/decentralized storage, and mint on
**Solana** (Metaplex Umi) or **EVM** chains (ERC-721 via viem).

This is a **pnpm + Turborepo** monorepo. Packages are scoped `@conkernftz/*` and the CLI binary is
`conkernftz`.

## Features

- **Deterministic generation** — seedable xorshift RNG and SHA-256 DNA for guaranteed uniqueness.
- **Rules engine** — `mutuallyExclusive`, `requires`, and cross-edition `maxOccurrences`.
- **Rarity** — filename-delimiter weights (e.g. `Trait#10.png`) with configurable defaults.
- **Compositor** — 60+ Photoshop-style blend modes (Sharp fast path + CPU fallback), per-layer
  opacity, and positioned/rotated overlays.
- **Pattern placement** — place an asset on weighted "dots" with jitter, rotation strategies,
  collision avoidance, and configurable anchors. Previews are WYSIWYG with the final build.
- **Storage** — **Irys** (permanent Arweave), **Pinata** (IPFS, JWT), and a **local** provider for
  offline testing. Per-file or whole-directory (`baseURI`) uploads with retry.
- **Chains** — **Solana** via Umi + Token Metadata (standard or pNFT) and **EVM** via viem
  (OpenZeppelin ERC-721 + ERC-2981 royalties).
- **DX** — TypeScript everywhere, Zod-validated config, Vitest, ESLint (flat config) + Prettier.

## Requirements

- Node.js **>= 20.9**
- pnpm **9.x**

## Workspace layout

| Package | Description |
| --- | --- |
| `packages/core` | Engine: catalog, compositor, DNA, rarity, rules, generator, pattern placement |
| `packages/cli` | CLI `conkernftz` — init, validate, preview, build, upload, mint, deploy, e2e |
| `packages/storage` | Storage providers: Irys (Arweave), Pinata (IPFS), local |
| `packages/chain-solana` | Solana adapter: metadata JSON, Umi mint, optional pNFT |
| `packages/chain-evm` | EVM adapter: ERC-721 metadata, contract deploy + owner-mint (viem) |
| `packages/ui` | Electron GUI over the CLI |

## Quick start

```bash
pnpm install
pnpm build

# CLI help
pnpm cli -- --help

# Electron GUI
pnpm -C packages/ui start
```

## CLI commands

```bash
conkernftz init                       # scaffold foundry.config.json + layer folders
conkernftz validate                   # validate config, layers, patterns, bindings
conkernftz preview --count 9 --seed 42 --overlay   # seeded previews (+ placement overlays)
conkernftz build --count 100          # render images + per-edition JSON into the output dir
conkernftz upload --mode file         # upload + rewrite URIs (file = per-NFT; dir = baseURI)
conkernftz deploy                     # (EVM) deploy the ERC-721 collection contract
conkernftz mint --count 1 --from 1    # mint (Solana per-edition, or EVM owner-mint)
conkernftz e2e                        # validate → preview → build → upload
```

Per-command options:

- `preview`: `--count <n>`, `--seed <s>`, `--overlay`
- `build`: `--count <n>` (defaults to `editionSize`), `--seed <s>`
- `upload`: `--mode <file|dir>`, `--concurrency <n>`, `--retries <n>`
- `mint`: `--count <n>`, `--from <n>` (Solana), `--to <address>` (EVM)
- `deploy`: `--base-uri <uri>` (else resolved from the upload manifest or config)

## Configuration

`conkernftz init` scaffolds a `foundry.config.json`. It is validated with Zod; key fields:

```jsonc
{
  "name": "Example Collection",
  "symbol": "EXMPL",
  "editionSize": 10,
  "image": { "width": 1024, "height": 1024, "background": "transparent" },
  "layers": [
    { "name": "Background", "path": "layers/background", "rarity": "filename", "required": true },
    { "name": "Body", "path": "layers/body", "blend": "normal", "opacity": 1 }
  ],
  "rules": {
    "mutuallyExclusive": [["Eyes:Laser", "Headwear:Visor"]],
    "requires": [{ "if": "Headwear:Crown", "thenAnyOf": ["Background:Royal"] }],
    "maxOccurrences": [{ "trait": "Headwear:Crown", "max": 5 }]
  },
  "rarity": { "mode": "filenameDelimiter", "delimiter": "#", "defaultWeight": 1 },
  "uniqueness": { "hash": "sha256", "ignore": ["Background"] },

  // Optional pattern placement: place a layer's asset on weighted dots.
  "patterns": [
    { "id": "corners", "dots": [
      { "id": "tl", "x": 0.2, "y": 0.2, "weight": 1, "jitterPx": { "radial": 8 } },
      { "id": "br", "x": 0.8, "y": 0.8, "weight": 1 }
    ]}
  ],
  "patternBindings": [
    { "id": "placeBody", "target": { "type": "layer", "layer": "Body" },
      "choices": [{ "patternId": "corners", "weight": 1 }],
      "anchor": { "mode": "center" },
      "rotation": { "mode": "uniform", "minDeg": 0, "maxDeg": 360 },
      "collision": { "enabled": true, "minDistancePx": 32 } }
  ],

  "export": { "outDir": "build", "previewOutDir": "build/preview", "imageFormat": "png", "includePreviewContactSheet": true },

  "storage": {
    "provider": "irys",                                   // "irys" | "pinata" | "local"
    "irys":   { "token": "solana", "keyPath": "./keys/solana.json" },
    "pinata": { "jwt": "", "gateway": "" },               // or set PINATA_JWT env var
    "local":  { "baseUri": "" }
  },

  "chain": {
    "target": "solana",                                   // "solana" | "evm"
    "solana": {
      "cluster": "devnet",
      "rpcUrl": "",
      "walletKeypairPath": "./keys/solana.json",
      "sellerFeeBasisPoints": 500,
      "creators": [{ "address": "<WALLET_PUBKEY>", "share": 100, "verified": true }],
      "collection": { "mint": null },
      "isMutable": true,
      "usePnft": false,
      "rulesetPda": null
    },
    "evm": {
      "chainId": 11155111,                                // Sepolia
      "rpcUrl": "https://rpc.sepolia.org",
      "privateKeyPath": "./keys/evm.key",
      "baseUri": "",
      "maxSupply": 0,                                     // 0 = unlimited
      "royaltyReceiver": "0x...",
      "royaltyBps": 500
    }
  }
}
```

> Secrets (wallet keypairs, EVM private keys, Pinata JWT) belong outside version control. The
> default `.gitignore` excludes `keys/` and `.env*`. The `PINATA_JWT` and `SOLANA_RPC_URL`
> environment variables override their config equivalents.

## Typical flows

**Solana (devnet):** `build` → `upload --mode file` → `mint` (each NFT gets its own metadata URI).

**EVM (Sepolia):** `build` → `upload --mode dir` (one base CID) → `deploy` (sets the contract
`baseURI`) → `mint` (owner-mint). Token *N* resolves to `<baseURI>N.json`.

The EVM contract source is `packages/chain-evm/contracts/ConkernftzCollection.sol` (OpenZeppelin
ERC-721 + ERC-2981). Its compiled ABI/bytecode artifact is committed; regenerate after editing the
contract with `pnpm -C packages/chain-evm compile-contract` (requires `solc` + `@openzeppelin/contracts`).

## Development

```bash
pnpm build       # turbo build (respects package graph)
pnpm test        # vitest across packages
pnpm lint        # eslint (flat config)
pnpm typecheck   # tsc --noEmit per package
pnpm clean       # remove build outputs
```

## Migrating from v3

- **Package scope** renamed `@foundry/*` → `@conkernftz/*`; the CLI binary `foundry` → `conkernftz`.
- **Storage** rewritten: `storage.provider` is now `"irys" | "pinata" | "local"`. The old
  `arweave`/`ipfs` (Bundlr, NFT.Storage, `pinata-sdk`) blocks are replaced by `irys`, `pinata`
  (JWT), and `local`. `upload` no longer takes `--provider` (set it in config) and gains
  `--mode file|dir` and `--retries`.
- **Chains**: `chain.target` may now be `"evm"`; new `chain.evm` block, `deploy` command, and
  chain-aware `mint`.
- **Node** baseline raised to **20.9+**.

## License

MIT — see `LICENSE`.
