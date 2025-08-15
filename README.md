## conkernftz — NFT Art Foundry (monorepo)

conkernftz is a next‑gen open‑source NFT art foundry. It replaces legacy generators with a modern, type‑safe, modular toolchain for composing layers, enforcing rules, generating editions, previewing, uploading to storage, and minting (Solana via Umi/Token Metadata).

This repo is a monorepo. The workspace root is `conkernftz/`.

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

# Run the CLI (from workspace root)
pnpm cli -- --help
```

### CLI usage

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

# Mint on Solana (devnet by default)
foundry mint --count 1 --from 1

# End‑to‑end helper
foundry e2e
```

The CLI expects a `foundry.config.json` in your project directory. Run `foundry init` to scaffold one. Key fields include:

- `layers`: Ordered list of layer specs with optional rarity hints
- `rules`: Mutual exclusivity, requirements, and max occurrences
- `rarity`: Mode and defaults (e.g., filename delimiter)
- `image`: Output size and background
- `export`: Output directory and options
- `storage`: Arweave/IPFS credentials
- `chain.solana`: Cluster, wallet, fees, creators, and pNFT options

### Develop

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


