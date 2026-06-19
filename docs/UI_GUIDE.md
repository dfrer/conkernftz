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

- **Projects** — **create a new collection** (starter config + layer folders) or open an existing project folder (or pick a recent). The header shows the active project.
- **Design** — edit `foundry.config.json` visually, organized into **tabs** (Basics / Layers / Assets & rarity / Rules):
  - *Basics*: name, symbol, description, edition size, image size/format.
  - *Layers*: add/remove/reorder layers, set blend & opacity, live per-layer asset counts + a **rarity-distribution bar**; expand a layer ("traits") to browse every asset with its weight and computed drop-odds.
  - *Effects* (the `fx` button on a layer): blend, offset/rotate/scale, glow/stroke/shadow/blur/modulate/color-overlay, plus per-asset overrides.
  - *Rules*: structured editors for max-occurrences, mutually-exclusive groups, and requires, with a JSON escape hatch for transforms and anything advanced.
  - *Assets & rarity*: bulk image renamer (set a uniform weight, or sequence-rename) — filename rarity is `value<delimiter>weight`.
  - *Spawn/placement*: a canvas editor for placement dots (saved to the spawn map).
  - Edits are dirty-tracked; **Save** writes back losslessly (fields the UI doesn't surface are preserved).
- **Preview** — render a fresh random set straight from the engine into a thumbnail gallery. Set a **seed** to reproduce a specific set; click a tile to inspect it full-size (with paging).
- **Build** — build N editions with a live progress bar (Pause / Resume / Stop), a completion summary, a rarity report, an **output gallery** of the built editions (click to inspect, open the folder), and asset/output audits.
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
