## UI Guide (Electron)

The Electron GUI is a React app (Vite-built) that wraps the full foundry workflow —
configure a project, preview generations, build the collection, and publish — in a
single "Field Instrument" console. It calls the same `@conkernftz/core` engine the CLI
uses, so the GUI and CLI always agree.

### Start

```
pnpm -C packages/ui build
pnpm -C packages/ui start
```

`start` rebuilds the UI assets if needed, then launches Electron. If the CLI or
dependencies are missing, the app shows an actionable message (run `corepack enable`,
then `pnpm install` and `pnpm build` at the repo root).

> The engine runs in a separate Electron `utilityProcess`, so generation and rendering
> never block the window — long previews/builds keep the UI responsive (you'll see
> progress, not a frozen window).

### The pipeline

The left rail is the workflow, in order:

- **Projects** — **create a new collection** (starter config + layer folders), import an existing layer folder, or open an existing project folder (or pick a recent). The header shows the active project.

#### Importing existing art

Choose **Import layer folder…** from the Projects header or empty state. Select either:

- a project root containing exactly one `Layers` folder whose immediate subfolders are
  layers; or
- a project root whose immediate subfolders are the layer folders.

The importer reads direct `.png`, `.webp`, `.gif`, and `.svg` assets, preserves natural
numeric order, and creates `foundry.config.json` only when it is missing. It does not
move, rename, delete, or overwrite art. If a valid config already exists, it is opened
unchanged after schema validation. The successful import returns one authoritative
validated-or-generated schema-conformant snapshot, so the project directory, recents list, and
displayed configuration change together without a second read. In direct-folder mode, generated
folders such as
`build`, `output`, `previews`, `uploads`, and `dist` are ignored. A malformed or
schema-invalid config, multiple `Layers` containers, or no usable layer folders is
rejected with an explanatory error; no config is written in those cases. After import,
review the inferred layers and generated defaults in **Design** before previewing or
building.
- **Design** — edit `foundry.config.json` visually, organized into **tabs** (Basics / Layers / Assets & rarity / Rules):
  - *Basics*: name, symbol, description, edition size, image size/format, build and preview output folders, uniqueness ignores, and consumed compositor/generation controls.
  - *Layers*: add/remove/reorder layers, set blend & opacity, live per-layer asset counts + a **rarity-distribution bar**; expand a layer ("traits") to browse every asset with its weight and computed drop-odds. The selected layer also has structured conditional spawn and per-option match/exclude/positive-weight controls; recursive imported conditions remain available through validated advanced JSON with Reload/Cancel protection.
  - *Effects* (the `fx` button on a layer): blend, offset/rotate/scale, glow/stroke/shadow/blur/modulate/color-overlay, plus per-asset overrides.
  - *Rules*: structured editors for max-occurrences, mutually-exclusive groups, requires, and full transform rules (targets, conditions, translate/rotate/scale, modes). Transform changes use an explicit validated Apply/Cancel/Reload draft. A whole-object JSON escape hatch remains for advanced imported fields and rejects non-object roots.
  - *Assets & rarity*: bulk image renamer (set a uniform weight, or sequence-rename) — filename rarity is `value<delimiter>weight`.
  - *Spawn/placement*: a canvas editor for placement dots (saved to the spawn map).
  - Edits are dirty-tracked; **Save** writes back losslessly (fields the UI doesn't surface are preserved).
- **Preview** — render a fresh random set straight from the engine into a thumbnail gallery. Set a **seed** to reproduce a specific set; click a tile to inspect it full-size (with paging). The inline inspection stage adds Contain/Cover/Actual fit, Checker/Dark/Light transparency backgrounds, fresh-seed **Reroll**, frame selection, and drag or arrow-key crop positioning.
- **Build** — build N editions with a live progress bar (Pause / Resume / Stop), a completion summary, a rarity report, an **output gallery** of the built editions (click to inspect, open the folder), asset/output audits, and a bounded animation inspector. Animation discovery lists at most 24 outputs and loads one selected GIF/WebP/MP4/WebM on demand; the desktop bridge rejects files larger than 16 MiB with a visible error.
- **Publish** — a **readiness strip** (build images / metadata / upload status + baseURI) shows what's ready, then upload to a storage provider (irys / pinata / local; modes auto/dir/files) and run chain-aware mint actions (Solana direct mint + Candy Machine, or EVM deploy + owner-mint) via the CLI, with a live command console.
- **Mint FX** — design the interactive mint reveal: a card-pack "rip-open," flip-grid, or fade. Pick a preset, tune kind / cards / duration / label / accent / shake / auto-flip, pull live rendered art as the cards, preview it (with **Replay**), and **Save** (lossless to the config). The same experience powers the mint site's mint widget.
- **Site** — a no-code, "Geocities-rich" page builder for the mint site (start from a **template** — Minimal mint / Gallery drop / GeoCities): free-form **canvas** mode (drag-anywhere, z-order, tiled wallpapers, mobile viewport with per-element overrides) or stacked **flow** mode; widgets (hero, gallery, mint widget, FAQ, marquee, WordArt, blink, hit counter, web ring, raw-HTML, …). **Generate site** writes a self-contained deployable folder (`<project>/site-export`); **Host (deploy)** publishes it to your own Vercel account (paste a token → `npx vercel deploy --prod`). The site's mint button is preview-only until the wallet + on-chain contract land.
- **AI** — a Fal generator backed by a model catalog: pick from curated image/video models, fill the model's parameters (a dynamic form per model — image size, steps, guidance, seed, aspect ratio, …), prompt → results gallery with save-to-project. The **Model catalog** panel imports/exports custom models (persisted locally) and a "Custom endpoint" field targets any fal endpoint directly.
- **Settings** — appearance (theme + accent), storage provider + credentials, chain target + fields, and open-folder shortcuts. All edits save losslessly.
- **Help** — a field manual of the stages, plus About and links.

### Appearance

Light/dark theme and an accent color (amber / cyan / magenta / lime) are in **Settings ▸
Appearance** and persist across sessions. The UI respects `prefers-reduced-motion`.

Contributors: the design system (tokens, utilities, components, screen patterns) is documented
in [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md).

### Accessibility

- Keyboard-friendly navigation with ARIA roles.
- Respects `prefers-reduced-motion`.

### Troubleshooting

- If `packages/cli/dist/bin.js` is missing, build from the repo root (`pnpm build`).
- On Windows, prefer a non-OneDrive path and consider enabling Win32 long paths.
