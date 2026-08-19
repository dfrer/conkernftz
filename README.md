# conkernftz – NFT Art Foundry (Monorepo)

Modern, type‑safe, open‑source NFT art foundry. Compose layered artwork, enforce trait rules, generate editions, preview, upload to storage, and mint on Solana (Umi/Token Metadata). Comes with a CLI and optional Electron/Tauri GUIs.

---

## Quick start (Windows): open the app

Double‑click **`conkernftz.bat`** in this folder. On the first run it installs
dependencies and builds (a few minutes); after that it launches the desktop app
in a few seconds. Keep the small console window open while you use the app.

Want a desktop icon? Double‑click **`make-desktop-shortcut.bat`** once to create a
`conkernftz` shortcut on your Desktop, then launch from there.

From a terminal you can also run `pnpm app` (equivalent to `pnpm -C packages/ui start`).

---

## 1) Features at a Glance

- Deterministic generation with seedable RNG and SHA‑256 DNA for uniqueness
- Rules engine: `mutuallyExclusive`, `requires`, `maxOccurrences`
- Rarity via filename delimiter (e.g., `Trait#10.png`) with configurable defaults
- Compositor supports per-layer blend/opacity and visual effects (glow, stroke, shadow, 3D extrude, rotate, scale) with presets; preview contact sheet + rarity report
- Storage: Arweave Bundlr and IPFS (NFT.Storage/Pinata)
- Solana mint via Umi/Token Metadata with optional pNFT and ruleset PDA
- TypeScript throughout; Zod schemas; Vitest; ESLint/Prettier
- Electron GUI with Fal AI image generation page
- Tauri packaging option
- End‑to‑end image format selection: `png` or `webp` (configurable)

Live Preview overlay (UI)

- Toggle an overlay to preview a single edition at any time. The UI asks the core to render accurate images via IPC when possible; it falls back to a canvas compositor for a quick approximation when core rendering is unavailable. The overlay can be dragged, rerolled, and configured for fit (contain/cover/actual) and background (checker/dark/light).

---

## 2) System Requirements

- Node.js ≥ 22.14 and < 25 (Node 22 or 24 recommended)
- PNPM 9.x (via Corepack)
- Git (for cloning)

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

# 3) Install the exact workspace dependency lock (root)
pnpm install --frozen-lockfile

# 4) Build everything (CLI, core, UI, etc.)
pnpm build

# 5) Try the CLI
pnpm cli -- --help           # runs the conkernftz CLI
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
- `packages/ui` – Electron + React desktop app

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

Recommended: use Corepack with Node 22 or 24

```bash
corepack enable
corepack prepare pnpm@9.1.0 --activate
```

Alternative: Install PNPM globally (not required if using Corepack)

```bash
npm i -g pnpm@9
```

Node version managers

- macOS/Linux: `nvm install 22 && nvm use 22`
- Windows: `nvm-windows` or `Volta` (e.g., `volta install node@22`)

Verify versions

```bash
node -v           # v22.x or v24.x
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
- `build`: `--count <n>` (defaults to `editionSize`), `--seed <s>`, `--max-attempts <n>`
- `upload`: `--provider <arweave|ipfs>`, `--concurrency <n>`
- `mint`: `--count <n>`, `--from <n>`

---

## 8) Project Configuration

Run `foundry init` to create `foundry.config.json` and starter folders. Important fields:

- `layers`: Ordered list of layer specs; rarity hints via filenames (e.g., `Alien#5.png`).
- `rules`: Trait logic (`mutuallyExclusive`, `requires`, `maxOccurrences`).
- `rarity`: Defaults and filename delimiters.
- `image`: Output size/background.
- `export`: Output directories, image format, and preview options.
  - `imageFormat`: `png` or `webp` (end‑to‑end). `gif` is not currently supported.
- `storage`: Provider credentials (Arweave/IPFS).
- `chain.solana`: Cluster/wallet/fees/creators/pNFT options.

Asset naming for rarity

- Use `Trait#<weight>.png` to assign weights per asset within a layer.
- If you omit weights, defaults from `rarity` config apply.

Effects on layers and overrides

- Each layer can define `effects` (plus legacy `blend`/`opacity`) that apply to all assets in the layer.
- Per-asset `overrides` can refine any effect fields by matching `filename` or derived trait `value`.
- Supported effects: `glow`, `shadow`, `stroke`, `extrude` (simple 3D), `blur`, `modulate` (hue/saturation/brightness), `colorOverlay`, `rotate`, `scale`. Presets are available where applicable.
  - `glow.inner: true` enables inner glow (clipped to the shape)
  - `shadow.inner: true` enables inner shadow (clipped to the shape)
  - `stroke.position: "outside"|"inside"|"center"` controls stroke placement

Available presets

- `glow`: `subtle`, `medium`, `strong`, `neon`
- `stroke`: `thin`, `medium`, `thick`, `white`
- `shadow`: `soft`, `hard`, `long`
- `extrude`: `short`, `long`, `isometric`
- `colorOverlay`: `tint`, `shade`, `highlight`

Example layer snippet

```
{
  "name": "Eyes",
  "path": "./assets/eyes",
  "effects": {
    "glow": { "preset": "subtle", "color": "#00eaff", "inner": true },
    "stroke": { "preset": "thin", "color": "#000", "position": "center" }
  },
  "overrides": [
    {
      "target": "value",
      "match": "Laser",
      "effects": {
        "glow": { "preset": "neon", "inner": false },
        "shadow": { "preset": "long", "opacity": 0.25, "inner": true },
        "extrude": { "preset": "short", "angle": 120 }
      }
    }
  ]
}
```

---

## 9) Storage Setup (Arweave / IPFS)

Arweave via Bundlr

- Obtain a Bundlr key and fund the node you choose.
- Configure `storage.provider = "arweave"` and credentials in `foundry.config.json` (or environment variables if supported by your setup).
- Uploaded URIs are normalized to HTTPS gateway form: `https://arweave.net/<id>` for broad wallet/explorer compatibility.

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
- Configure page now has a Save button next to “Project Config” to persist changes from any pane.

### Import an existing layer folder

On **Projects**, choose **Import layer folder…** when you have art folders but no
`foundry.config.json` yet. Select either a folder containing one `Layers` folder, or a
folder whose immediate subfolders are the layers themselves. The importer recognizes
`.png`, `.webp`, `.gif`, and `.svg` files, infers layer order naturally (for example,
`Layer2` before `Layer10`), and writes a usable `foundry.config.json` beside the art.

The generated configuration uses safe starter defaults: a 1024×1024 transparent PNG,
an edition size capped at 100, filename-based rarity (`#`), SHA-256 uniqueness, local
build output, and an EVM target. Review these values in **Design** before building.
Existing valid configuration is reused unchanged. The import is non-destructive: it
does not move, rename, delete, or overwrite art or an existing configuration. Common
generated root folders such as `build`, `output`, `previews`, `uploads`, and `dist` are
ignored when direct layer folders are inferred. Ambiguous layouts, malformed JSON, or
folders without supported art produce an actionable error and leave the folder alone.

Fal AI page

- Generate images via [fal.ai](https://fal.ai); choose models, set size/count, and save to your project folder.

Customization & Accessibility

- Theme & accent: Use the Options tab to switch Light/Dark and pick an accent color. Accent derivatives (`--accent-2`, `--accent-soft`, `--accent-glow`) update automatically.
- UI tokens: The GUI consumes `design-system/tokens.css`; avoid inline hex colors. Radius/blur/noise controls apply to `:root` variables and persist.
- Keyboard-friendly tabs: Primary tabs and subtabs support Arrow Left/Right, Home/End; current tab is marked with ARIA attributes and `tabindex`.
- Reduced motion: The app respects `prefers-reduced-motion` and tones down hover transforms.
- Icons: Common actions (open, save, run, refresh) get consistent SVG icons via lightweight injection.

---

## 12) Documentation

- CLI Reference: `docs/CLI_REFERENCE.md`
- Configuration Reference: `docs/CONFIG_REFERENCE.md`
- UI Guide: `docs/UI_GUIDE.md`

---

## 13) Tauri Packaging (Optional)

Build steps

```bash
# Ensure everything is built and UI has assets
pnpm build

# Package the Tauri app
pnpm -C packages/ui-tauri build
```

The binary is written to `packages/ui-tauri/src-tauri/target/release`.

---

## 14) Troubleshooting

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

- Use Node 22.x or 24.x; use `nvm`/`nvm-windows`/`Volta` to switch.

Corporate proxies / SSL MITM

- Set `npm_config_https_proxy`/`npm_config_proxy` as needed; configure Git proxy/CA if required.

Antivirus interference on Windows

- Exclude the repo directory from real‑time scanning if builds are unexpectedly slow or failing.

---

## 15) Development

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

## 16) License

MIT — see `LICENSE`.
