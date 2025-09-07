# conkernftz – NFT Art Foundry (Monorepo)

Modern, type‑safe, open‑source NFT art foundry. Compose layered artwork, enforce trait rules, generate editions, preview, upload to storage, and mint on Solana (Umi/Token Metadata). Comes with a CLI and optional Electron/Tauri GUIs.

---

## 1) Features at a Glance

- Deterministic generation with seedable RNG and SHA‑256 DNA for uniqueness
- Rules engine: `mutuallyExclusive`, `requires`, `maxOccurrences`
- Rarity via filename delimiter (e.g., `Trait#10.png`) with configurable defaults
- Compositor supports per‑layer blend/opacity; preview contact sheet + rarity report
- Storage: Arweave Bundlr and IPFS (NFT.Storage/Pinata)
- Solana mint via Umi/Token Metadata with optional pNFT and ruleset PDA
- TypeScript throughout; Zod schemas; Vitest; ESLint/Prettier
- Electron GUI with Fal AI image generation page
- Tauri packaging option

---

## 2) System Requirements

- Node.js ≥ 18.18 (Node 20.x recommended)
- PNPM 9.x (via Corepack)
- Git (for cloning)
- Optional: Rust toolchain if building the Tauri app
  - Windows: Rust + MSVC "Desktop development with C++" (Visual Studio Build Tools)
  - macOS: Xcode Command Line Tools
  - Linux: GTK/WebKit and dev headers per Tauri docs

Notes for Windows
- Prefer a local path (e.g., `C:\dev\conkernftz`) over OneDrive or network‑mapped drives to avoid policy/long‑path issues.
- Optional but helpful: enable Win32 long paths (Group Policy → Computer Configuration → Administrative Templates → System → Filesystem → "Enable Win32 long paths" = Enabled).

---

## 3) Quick Start (Everything, End‑to‑End)

```bash
# 1) Clone
git clone <your-fork-or-upstream-url> conkernftz
cd conkernftz

# 2) Enable Corepack + pin pnpm 9
corepack enable
corepack prepare pnpm@9.1.0 --activate

# 3) Install workspace deps (root)
pnpm install

# 4) Build everything (CLI, core, UI, etc.)
pnpm build

# 5) Try the CLI
pnpm cli -- --help           # runs @foundry/cli (foundry)
node packages/cli/dist/bin.js --version

# 6) Run the Electron GUI (dev)
pnpm -C packages/ui build    # ensure UI assets exist
pnpm -C packages/ui start    # launches Electron
```

If you only run `pnpm -C packages/ui start` without a prior `pnpm build`, the GUI tries to build missing packages on demand via pnpm. If pnpm isn’t installed, it falls back to Corepack. If both are unavailable, it shows a clear message with the exact fix.

---

## 4) Monorepo Layout

- `packages/core` – Core engine (catalog, compositor, DNA, rarity, rules, generator)
- `packages/cli` – CLI `foundry` (init, validate, preview, build, upload, mint, e2e)
- `packages/storage` – Storage providers (Arweave Bundlr, IPFS)
- `packages/chain-solana` – Solana adapter (metadata JSON, Umi mint, optional pNFT)
- `packages/ui` – Electron GUI (optional)
- `packages/ui-tauri` – Tauri GUI (optional)

We use PNPM workspaces + Turborepo. Root scripts:

- `pnpm build` – builds all packages
- `pnpm dev` – runs dev tasks in parallel (where supported)
- `pnpm test` – runs tests
- `pnpm lint` – lints all packages
- `pnpm typecheck` – type‑checks all packages
- `pnpm clean` – removes `dist/` and similar outputs
- `pnpm cli -- <args>` – runs CLI from workspace

---

## 5) Setting Up Node & PNPM

Recommended: Use Corepack (bundled with Node ≥ 18)

```bash
corepack enable
corepack prepare pnpm@9.1.0 --activate
```

Alternative: Install PNPM globally (not required if using Corepack)

```bash
npm i -g pnpm@9
```

Node version managers
- macOS/Linux: `nvm install 20 && nvm use 20`
- Windows: `nvm-windows` or `Volta` (e.g., `volta install node@20`)

Verify versions

```bash
node -v           # v20.x preferred
pnpm -v           # 9.x
git --version
```

---

## 6) Building the Project

At the repo root:

```bash
pnpm install
pnpm build
```

This compiles the CLI and all dependent packages so `packages/cli/dist/bin.js` exists. The GUI will use the compiled CLI.

Clean and rebuild:

```bash
pnpm clean
pnpm build
```

---

## 7) Using the CLI (foundry)

Run from the workspace root after building:

```bash
pnpm cli -- --help
node packages/cli/dist/bin.js --help
```

Common workflow:

```bash
# 1) Scaffold a project in the current directory
foundry init

# 2) Validate configuration and assets
foundry validate

# 3) Generate previews
foundry preview --count 10 --seed preview
# If tight rules cause failures:
#   --max-attempts 5000   (increase search attempts)
#   --allow-duplicates    (for previews only)

# 4) Build editions (images + local JSON)
foundry build --count 100

# 5) Upload assets; rewrite local JSON URIs
foundry upload --provider arweave --concurrency 6
# or
foundry upload --provider ipfs --concurrency 6

# 6) Mint (Solana devnet by default)
foundry mint --count 1 --from 1

# All‑in‑one helper
foundry e2e
```

Key options per command
- `preview`: `--count <n>`, `--seed <s>`, `--max-attempts <n>`, `--allow-duplicates`
- `build`: `--count <n>` (defaults to `editionSize`)
- `upload`: `--provider <arweave|ipfs>`, `--concurrency <n>`
- `mint`: `--count <n>`, `--from <n>`

---

## 8) Project Configuration

Run `foundry init` to create `foundry.config.json` and starter folders. Important fields:

- `layers`: Ordered list of layer specs; rarity hints via filenames (e.g., `Alien#5.png`).
- `rules`: Trait logic (`mutuallyExclusive`, `requires`, `maxOccurrences`).
- `rarity`: Defaults and filename delimiters.
- `image`: Output size/background.
- `export`: Output directories and preview options.
- `storage`: Provider credentials (Arweave/IPFS).
- `chain.solana`: Cluster/wallet/fees/creators/pNFT options.

Asset naming for rarity
- Use `Trait#<weight>.png` to assign weights per asset within a layer.
- If you omit weights, defaults from `rarity` config apply.

---

## 9) Storage Setup (Arweave / IPFS)

Arweave via Bundlr
- Obtain a Bundlr key and fund the node you choose.
- Configure `storage.provider = "arweave"` and credentials in `foundry.config.json` (or environment variables if supported by your setup).

IPFS
- NFT.Storage: create an API token.
- Pinata: create an API token.
- Configure `storage.provider = "ipfs"` with the respective token.

Uploading

```bash
foundry upload --provider arweave --concurrency 6
# or
foundry upload --provider ipfs --concurrency 6
```

---

## 10) Minting on Solana (Devnet)

Prereqs
- A devnet RPC URL (optional; defaults typically work).
- A wallet/keypair with devnet SOL for fees.

Configure `chain.solana` in `foundry.config.json` (cluster, creators, fees, pNFT options). Then:

```bash
foundry mint --count 1 --from 1
```

---

## 11) Electron GUI (Dev)

Build the UI and start Electron:

```bash
pnpm -C packages/ui build
pnpm -C packages/ui start
```

Notes
- On first run, the GUI ensures the CLI and deps are compiled. If `pnpm` isn’t in PATH, it falls back to `corepack pnpm`.
- If the CLI dist is still missing, the app shows a clear message with the exact fix: run `corepack enable`, then `pnpm install` and `pnpm build` at the repo root.

Fal AI page
- Generate images via [fal.ai](https://fal.ai); choose models, set size/count, and save to your project folder.

Customization & Accessibility
- Theme & accent: Use the Options tab to switch Light/Dark and pick an accent color. Accent derivatives (`--accent-2`, `--accent-soft`, `--accent-glow`) update automatically.
- UI tokens: The GUI consumes `design-system/tokens.css`; avoid inline hex colors. Radius/blur/noise controls apply to `:root` variables and persist.
- Keyboard-friendly tabs: Primary tabs and subtabs support Arrow Left/Right, Home/End; current tab is marked with ARIA attributes and `tabindex`.
- Reduced motion: The app respects `prefers-reduced-motion` and tones down hover transforms.
- Icons: Common actions (open, save, run, refresh) get consistent SVG icons via lightweight injection.

---

## 12) Tauri Packaging (Optional)

Build steps

```bash
# Ensure everything is built and UI has assets
pnpm build

# Package the Tauri app
pnpm -C packages/ui-tauri build
```

The binary is written to `packages/ui-tauri/src-tauri/target/release`.

---

## 13) Troubleshooting

Cannot find module `packages/cli/dist/bin.js`
- Cause: CLI TypeScript not compiled.
- Fix: `corepack enable` → `pnpm install` → `pnpm build` (at repo root).
- The GUI attempts to compile on demand via pnpm/Corepack and surfaces a clear message if it can’t.

`pnpm` not found
- Run `corepack enable` and `corepack prepare pnpm@9.1.0 --activate`.

Windows path issues (OneDrive/network drives)
- Use a local path like `C:\dev\conkernftz`.
- Consider enabling Win32 long paths.

Clean/full rebuild
- `pnpm clean` → `pnpm build`.

Node version mismatch
- Prefer Node 20.x; use `nvm`/`nvm-windows`/`Volta` to switch.

Corporate proxies / SSL MITM
- Set `npm_config_https_proxy`/`npm_config_proxy` as needed; configure Git proxy/CA if required.

Antivirus interference on Windows
- Exclude the repo directory from real‑time scanning if builds are unexpectedly slow or failing.

---

## 14) Development

Useful commands

```bash
pnpm dev        # run dev tasks (where available)
pnpm test       # run package tests
pnpm lint       # lint all packages
pnpm typecheck  # typecheck all packages
pnpm clean      # clean build outputs
```

Contributing
- See `CONTRIBUTING.md`.

---

## 15) License

MIT — see `LICENSE`.

