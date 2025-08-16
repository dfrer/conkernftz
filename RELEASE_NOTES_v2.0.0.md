## v2.0.0 — 2025-08-16

### Highlights
- Modern, type‑safe NFT art foundry with deterministic generation, strong validation, and a full pipeline from layers → previews → builds → uploads → Solana mint.

### Core
- Deterministic generation with seedable RNG and SHA‑256 DNA for uniqueness
- Rules: `mutuallyExclusive`, `requires`, `maxOccurrences`
- Rarity via filename delimiter (e.g., `Trait#10.png`) with configurable defaults
- Compositor supports per‑layer blend/opacity; preview contact sheet and rarity report

### CLI
- `init`: scaffolds `foundry.config.json` and layer directories
- `validate`: schema validation plus checks for missing/empty required layers
- `preview`: generates N seeded previews; normalizes preview dir and clears prior output
- `build`: writes `/build/images`, `/build/json`, `_metadata.json`, `rarity.json`
- `upload`: Arweave Bundlr or IPFS (NFT.Storage/Pinata) with concurrency; rewrites local JSON image URIs; emits `.upload-manifest.json`
- `mint`: Solana mint via Umi/Token Metadata; emits `minted.json`; respects RPC from config when provided
- `e2e`: convenience pipeline runner

### Chain (Solana)
- Metadata JSON builder and mint adapter
- Optional pNFT and ruleset PDA
- Configurable RPC via `chain.solana.rpcUrl`

### Storage
- Arweave Bundlr uploader
- IPFS via NFT.Storage and Pinata

### UI
- Optional Electron and Tauri scaffolds for a future desktop GUI

### Tooling & DX
- TypeScript across packages
- Zod schemas
- ESLint/Prettier
- Vitest
- Turbo + pnpm workspace

### Requirements / Breaking
- Node.js >= 18.18
- pnpm 9.x
- Version bump to 2.0.0 across packages

### Upgrade notes
- Re‑install workspace deps and rebuild:
  ```bash
  cd conkernftz
  pnpm install
  pnpm build
  ```
- Re‑scaffold a project if you want a fresh `foundry.config.json` layout:
  ```bash
  foundry init
  ```
- Validate and generate previews/builds as usual:
  ```bash
  foundry validate
  foundry preview --count 10 --seed preview
  foundry build --count 100
  foundry upload --provider arweave --concurrency 6
  foundry mint --count 1 --from 1
  ```


