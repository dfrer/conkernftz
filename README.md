## conkernftz — NFT Art Foundry (monorepo)

conkernftz is a modern, type‑safe NFT art foundry. It replaces legacy generators with a modular toolchain for composing layered artwork, enforcing trait rules, generating editions, previewing results, uploading to storage, and minting on Solana (Umi/Token Metadata).

This repository is a pnpm + Turbo monorepo. The workspace root is `conkernftz/`.

### What's new in v3.0.0

- Core and CLI documentation overhauled for clarity and completeness
- CLI now reports its version from `package.json` (no more hard‑coded version)
- General polish to messages and defaults; stability and DX improvements

### Features

- Deterministic generation with seedable RNG and SHA‑256 DNA for uniqueness
- Rules engine: `mutuallyExclusive`, `requires`, `maxOccurrences`
- Rarity via filename delimiter (e.g., `Trait#10.png`) with configurable defaults
- Compositor supports per‑layer blend mode and opacity; preview contact sheet and rarity report
- Storage: Arweave Bundlr and IPFS (NFT.Storage/Pinata)
- Solana mint via Umi/Token Metadata with optional pNFT and ruleset PDA
- TypeScript everywhere, Zod schemas, Vitest, ESLint/Prettier

### Requirements

- Node.js >= 18.18
- pnpm 9.x

### Workspace layout

- `conkernftz/packages/core`: Core engine (catalog, compositor, DNA, rarity, rules, generator)
- `conkernftz/packages/cli`: CLI `foundry` (init, validate, preview, build, upload, mint, e2e)
- `conkernftz/packages/storage`: Storage providers (Arweave Bundlr, IPFS)
- `conkernftz/packages/chain-solana`: Solana chain adapter (metadata JSON, Umi mint, optional pNFT)
- `conkernftz/packages/ui`: Electron GUI (optional)
- `conkernftz/packages/ui-tauri`: Tauri GUI (optional)

### Quick start

```bash
cd conkernftz
pnpm install
pnpm build

# Run the CLI (from the workspace root)
pnpm cli -- --help
```

### CLI commands

```bash
# Scaffold a new project in the current directory
foundry init

# Validate your config and assets
foundry validate

# Generate previews
foundry preview --count 10 --seed preview

# Build editions (images + local JSON)
foundry build --count 100

# Upload assets and rewrite local JSON URIs
foundry upload --provider arweave --concurrency 6
# or
foundry upload --provider ipfs --concurrency 6

# Mint on Solana (devnet by default; respects chain.solana.rpcUrl)
foundry mint --count 1 --from 1

# End‑to‑end helper
foundry e2e
```

Key options per command:

- `preview`: `--count <n>`, `--seed <s>`
- `build`: `--count <n>` (defaults to `editionSize`)
- `upload`: `--provider <arweave|ipfs>`, `--concurrency <n>`
- `mint`: `--count <n>`, `--from <n>`

### Configuration

The CLI expects a `foundry.config.json` in your project directory. Run `foundry init` to scaffold one. Important fields:

- `layers`: ordered list of layer specs with optional rarity hints
- `rules`: mutual exclusivity, requirements, and max occurrences
- `rarity`: mode and defaults (e.g., filename delimiter)
- `image`: output size and background
- `export`: output directories and options (supports `previewOutDir`)
- `storage`: Arweave/IPFS credentials
- `chain.solana`: cluster, wallet, fees, creators, and pNFT options

### Development

```bash
cd conkernftz
pnpm dev        # run dev tasks in parallel (where supported)
pnpm test       # run package tests
pnpm lint       # lint all packages
pnpm typecheck  # typecheck all packages
pnpm clean      # clean build outputs
```

### License

MIT — see `LICENSE`.

