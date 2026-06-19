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

- **Projects** — open a project folder (or pick a recent). The header shows the active project.
- **Design** — edit `foundry.config.json` visually:
  - *Basics*: name, symbol, description, edition size, image size/format.
  - *Layers*: add/remove/reorder layers, set blend & opacity, see live per-layer asset counts.
  - *Effects* (the `fx` button on a layer): blend, offset/rotate/scale, glow/stroke/shadow/blur/modulate/color-overlay, plus per-asset overrides.
  - *Rules*: structured editors for max-occurrences, mutually-exclusive groups, and requires, with a JSON escape hatch for transforms and anything advanced.
  - *Assets & rarity*: bulk image renamer (set a uniform weight, or sequence-rename) — filename rarity is `value<delimiter>weight`.
  - *Spawn/placement*: a canvas editor for placement dots (saved to the spawn map).
  - Edits are dirty-tracked; **Save** writes back losslessly (fields the UI doesn't surface are preserved).
- **Preview** — render a fresh random set straight from the engine (new seed each time) into a thumbnail gallery.
- **Build** — build N editions with a live progress bar (Pause / Resume / Stop), a completion summary, a rarity report, and asset/output audits.
- **Publish** — upload to a storage provider (irys / pinata / local; modes auto/dir/files) and run chain-aware mint actions (Solana direct mint + Candy Machine, or EVM deploy + owner-mint) via the CLI, with a live command console.
- **Mint FX** — design the interactive mint reveal: a card-pack "rip-open," flip-grid, or fade. Pick a preset, tune kind / cards / duration / label / accent / shake / auto-flip, pull live rendered art as the cards, preview it, and **Save** (lossless to the config). The same experience powers the mint site's mint widget.
- **Site** — a no-code, "Geocities-rich" page builder for the mint site: free-form **canvas** mode (drag-anywhere, z-order, tiled wallpapers, mobile viewport with per-element overrides) or stacked **flow** mode; widgets (hero, gallery, mint widget, FAQ, marquee, WordArt, blink, hit counter, web ring, raw-HTML, …). **Generate site** writes a self-contained deployable folder (`<project>/site-export`); **Host (deploy)** publishes it to your own Vercel account (paste a token → `npx vercel deploy --prod`). The site's mint button is preview-only until the wallet + on-chain contract land.
- **AI** — a Fal generator backed by a model catalog: pick from curated image/video models, fill the model's parameters (a dynamic form per model — image size, steps, guidance, seed, aspect ratio, …), prompt → results gallery with save-to-project. The **Model catalog** panel imports/exports custom models (persisted locally) and a "Custom endpoint" field targets any fal endpoint directly.
- **Settings** — appearance (theme + accent), storage provider + credentials, chain target + fields, and open-folder shortcuts. All edits save losslessly.
- **Help** — a field manual of the stages, plus About and links.

### Appearance

Light/dark theme and an accent color (amber / cyan / magenta / lime) are in **Settings ▸
Appearance** and persist across sessions. The UI respects `prefers-reduced-motion`.

### Accessibility

- Keyboard-friendly navigation with ARIA roles.
- Respects `prefers-reduced-motion`.

### Troubleshooting

- If `packages/cli/dist/bin.js` is missing, build from the repo root (`pnpm build`).
- On Windows, prefer a non-OneDrive path and consider enabling Win32 long paths.
