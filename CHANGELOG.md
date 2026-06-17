### Changelog

All notable changes to this project will be documented in this file.

#### v5.0.0 — 2026-06-16

Major modernization, correctness, and feature release.

- Branding
  - Packages renamed `@foundry/*` → `@conkernftz/*`; CLI binary `foundry` → `conkernftz`
- Storage (breaking)
  - Replaced deprecated libraries with **Irys** (Arweave), the modern **Pinata** SDK (IPFS, JWT),
    and a new **local** provider for offline testing
  - `upload` drops `--provider` (now from config) and adds `--mode file|dir` and `--retries`,
    with per-file retry and aggregated error reporting; directory mode emits an ERC-721 `baseURI`
- Chains
  - Added an **EVM** adapter (`@conkernftz/chain-evm`): OpenSea metadata, an OpenZeppelin
    ERC-721 + ERC-2981 contract, and `deploy` / owner-`mint` via viem
  - `mint` is now chain-aware (`chain.target: "solana" | "evm"`); new `deploy` command
  - Solana mint path is now built and type-checked (previously excluded from the build)
- Core fixes
  - RNG now returns `[0, 1)` (was inclusive of 1.0, which could produce out-of-bounds indices)
  - Pattern placement uses real asset dimensions for anchoring (was hard-coded 1×1)
  - `preview` now renders pattern placements identically to `build` (WYSIWYG)
  - Compositor warns when a positioned layer forces a CPU-only blend to degrade
- Tooling & tests
  - ESLint flat config + `@typescript-eslint` 8; test scripts no longer mask failures
  - Expanded test coverage (RNG, generator, pattern placement, render, storage, chain builders)
  - Removed the abandoned Tauri package and an unused `canvas` dependency
- Requirements
  - Node.js baseline raised to **20.9+**

#### v4.0.0 — 2025-08-24

- Documentation
  - README streamlined; clarified quick start, configuration, and command usage
  - Added `RELEASE_NOTES_v4.0.0.md`; refreshed `CONTRIBUTING.md` examples
- Monorepo
  - Housekeeping to align and polish docs

Note: This release focuses on documentation. No API or CLI behavior changes.

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


