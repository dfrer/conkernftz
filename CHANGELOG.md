### Changelog

All notable changes to this project will be documented in this file.

#### v3.0.0 — 2025-08-16

- CLI
  - CLI version is now sourced from `package.json` at runtime
  - Improved help text, defaults, and error messages
- Documentation
  - README restructured for clarity with command summaries and config highlights
  - Added guidance on `previewOutDir` and RPC usage in `mint`
- Monorepo
  - Bumped all packages to 3.0.0
  - Minor stability and DX improvements across commands

Note: Requires Node.js >= 18.18 and pnpm 9.x.

#### v2.0.0 — 2025-08-16

- Core
  - Deterministic generation with seedable RNG and SHA‑256 DNA hashes for uniqueness
  - Rules engine supports `mutuallyExclusive`, `requires`, and `maxOccurrences`
  - Rarity weights via filename delimiter (e.g., `Trait#10.png`) with configurable defaults
  - Compositor supports per‑layer blend mode and opacity; preview contact sheet and rarity report
- CLI
  - `init` scaffolds `foundry.config.json` and layer directories
  - `validate` performs schema validation and checks for missing/empty required layers
  - `preview` generates N previews with a seed; normalizes preview output dir and clears previous previews
  - `build` outputs `/build/images`, `/build/json`, `_metadata.json`, and `rarity.json`
  - `upload` to Arweave Bundlr or IPFS (NFT.Storage / Pinata) with bounded concurrency and JSON URI rewriting; writes `.upload-manifest.json`
  - `mint` mints on Solana (devnet by default) via Umi/Token Metadata; writes `minted.json`
  - `e2e` convenience command to run the full pipeline
- Chain (Solana)
  - Metadata JSON builder and mint adapter with optional pNFT and ruleset support; configurable RPC via config
- Storage
  - Arweave Bundlr uploader; IPFS via NFT.Storage and Pinata
- UI
  - Optional Electron and Tauri scaffolds for a future desktop GUI
- Tooling & DX
  - TypeScript across packages, Zod schemas, ESLint/Prettier, Vitest, Turbo + pnpm workspace

Note: Requires Node.js >= 18.18 and pnpm 9.x.

#### v0.1.0

- Initial public workspace layout
- Core engine (catalog, compositor, generator, DNA, rarity, rules)
- CLI with `init`, `validate`, `preview`, `build`, `upload`, `mint`, `e2e`
- Storage providers: Arweave Bundlr, IPFS
- Solana chain adapter and basic minting flow
- Optional Electron/Tauri UI scaffolds


