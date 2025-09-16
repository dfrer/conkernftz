## CLI Reference (foundry)

This document lists commands, options, and usage examples for the `foundry` CLI.

### Installation

- Build the workspace first from the repo root:
  - `pnpm install`
  - `pnpm build`
- Run the CLI:
  - `pnpm cli -- --help`
  - Or: `node packages/cli/dist/bin.js --help`

### Global

```
Usage: foundry <command> [options]

Modern NFT art foundry workflow:
  foundry init
  foundry validate
  foundry preview
  foundry build
  foundry upload
  foundry mint
```

---

### init

Scaffold a new project.

```
foundry init
```

Creates `foundry.config.json` and a `layers/` directory with starter subfolders.

---

### validate

Validate configuration and check assets are present.

```
foundry validate
```

Validates JSON schema, layer directories, and required layers.

---

### preview

Generate random previews for quick visual inspection.

Options:
- `--count <n>`: number of previews (default `10`)
- `--seed <s>`: RNG seed; use `random` for a fresh seed per run (default `preview`)
- `--max-attempts <n>`: maximum attempts per edition when enforcing uniqueness/rules (default `500`)
- `--allow-duplicates`: allow duplicate DNA in previews

Examples:
```
foundry preview --count 12 --seed demo
foundry preview --count 20 --seed random
foundry preview --count 20 --max-attempts 5000
foundry preview --count 20 --allow-duplicates
```

---

### build

Produce images and local JSON in the configured output directory.

Options:
- `--count <n>`: number of editions (default: `editionSize` from config)
- `--seed <s>`: RNG seed; `random` yields a fresh seed (default `build`)
- `--max-attempts <n>`: maximum attempts per edition (default `500`)

Examples:
```
foundry build
foundry build --count 100 --seed 42
foundry build --count 250 --max-attempts 5000
```

---

### upload

Upload images and metadata to storage, then rewrite local JSON image URIs.

Options:
- `--provider <arweave|ipfs>`: storage provider (default `arweave`)
- `--concurrency <n>`: parallel upload workers (default `4`)

Credentials:
- Arweave (Bundlr): `storage.arweave` section in `foundry.config.json` `{ bundlrNode, currency, keyPath }`
- IPFS: `storage.ipfs` section; either `nftStorageKey` or `pinataKey` + `pinataSecret`

Examples:
```
foundry upload --provider arweave --concurrency 6
foundry upload --provider ipfs --concurrency 4
```

Outputs a `.upload-manifest.json` mapping local filenames to uploaded URIs.

---

### mint

Mint on Solana using Umi + Token Metadata.

Options:
- `--count <n>`: number to mint (default `1`)
- `--from <n>`: starting index (1-based) in your generated set (default `1`)

Notes:
- Requires `foundry upload` beforehand to produce `.upload-manifest.json` and rewrite JSON files.
- Uses `chain.solana` config; you may set `SOLANA_RPC_URL` env var or `chain.solana.rpcUrl`.

Examples:
```
foundry mint --count 1 --from 1
foundry mint --count 10 --from 11
```

---

### e2e

Run a quick demo pipeline (validate → preview → build → upload).

```
foundry e2e
```



