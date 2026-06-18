# conkernftz — Holistic Overhaul Master Plan

> **Status:** Planning of record (authored 2026-06-17). Supersedes nothing in
> `hazy-riding-pearl.md` — that plan's Phases 0–4 are done/merged and its Phase 5 (EVM
> launch) is carried here as the deferred final phase. This document governs the
> **massive, feature-preserving overhaul** of the entire program, with the UI/UX as the
> headline.
> **Constraint of record:** nothing currently in the program may lose capability. Every
> phase ends with the green gate intact (`pnpm -w build && typecheck && lint && test`,
> ubuntu + windows, Node 20).

---

## 0. Resolved decisions (locked with the owner, 2026-06-17)

| # | Decision | Choice | Consequence for the plan |
|---|----------|--------|--------------------------|
| 1 | UI framework | **React + Vite** | New renderer is a React app; Vite is the renderer build. |
| 2 | Rewrite strategy | **Ground-up parallel rewrite** | New app built alongside the monolith; single gated cutover; parity matrix is the safety contract. Applies to renderer + main-process IPC only — engine/CLI/chains are kept. |
| 3 | Platform | **Stay on Electron** | No platform port; sharp/ffmpeg stay in-process; pairs with electron-builder for a signed installer. |
| 4 | Target users | **Both, packaged-app-first** | Non-technical creators (signed installer, guided flows) are primary; the CLI stays a first-class, documented surface for devs/CI. |
| 5 | Design language | **Replace identity; keep CONKERNFTZ name + NASA easter egg** | A wholly new visual language (palette, type, layout, motion, icons); brand name and the NORTHAMERICANSURVEILLANCEASSOCIATION easter egg are retained and reimagined. |
| 6 | Pace | **Multi-month phased program** | Sequenced phases, each green; the rest of the app stays shippable throughout. |
| 7 | Performance | **~10k editions, animation first-class** | Justifies worker-pool parallel rendering + incremental/cached builds in core; not over-engineered for 50k+. |
| 8 | UI test infra | **Heavy** | Pure-logic unit tests + React component tests + Playwright-for-Electron E2E + visual regression + a component playground, all in CI. |

---

## 1. Context & vision

`conkernftz` is a TypeScript pnpm + Turborepo monorepo (an open-source HashLips
replacement / generative NFT art foundry). The first major update (Phases 0–4) is done and
merged: quality hardening, storage modernization (irys/pinata/local), animated output
(GIF/MP4/WebP), Solana Core Candy Machine, and an initial Electron "Studio" tab. The
engine is strong; the product works; but it has grown organically and the desktop UI is a
12,090-line vanilla-DOM monolith that caps how good the product can get.

### North star
> **The best-in-class desktop studio for generative art + NFT collections** — a tool a
> non-technical creator can open and be guided from blank project → composed art →
> previewed editions → built collection → published on-chain, with a depth of compositing,
> rarity, rules, animation, and multi-chain power that developers reach for via the CLI.
> Premium, trustworthy, fast, and verifiably correct.

### Guiding principles
1. **Never regress green, never lose a capability.** Every phase is green; cutover is
   gated on a literal feature-parity matrix.
2. **The engine is the asset — protect it.** `packages/core` is mature and correct. The
   overhaul is mostly *above* it (UI, IPC, packaging, DX) and *around* it (perf, generation
   power), not a rewrite of it.
3. **One render path, owned by core.** The UI must call `renderEdition`/`buildCollection`
   directly through a typed engine boundary — never re-implement the pipeline (it does
   today) and never shell `pnpm build` at runtime (it does today).
4. **Verifiability is a first-class feature.** Because this environment cannot launch the
   GUI, the architecture favours pure, headlessly-testable logic + components, and invests
   heavily in automated UI testing.
5. **Secrets/keys stay out of the repo and the app.** Testnet/devnet by default; mainnet
   gated; the removed native `canvas` dep never returns; the deferred funds-handling
   contract is audit-gated.

---

## 2. Current-state audit (verified against the code, 2026-06-17)

Legend: **KEEP** (sound, carry forward) · **IMPROVE** (keep capability, materially upgrade)
· **REPLACE** (rebuild for a materially better result).

### 2.1 Engine — `packages/core` → **KEEP + IMPROVE**
Mature and high-quality. `compositor.ts` (850 lines) has a real Sharp fast-path plus a
complete CPU blend fallback with full HSL math (`rgbToHsl`/`luminance`/`setHslComponent`)
across ~40 modes; the Phase-0 unified `renderEdition()`, golden-image harness
(`__tests__/golden/`), rarity scoring, animation encoders (`animation/{frames,gif,ffmpeg}`),
and the Zod `project-config.ts` schema are coherent. The 2025 `QUALITY_REVIEW.md`
high-priority items (unsupported-mode CPU-fallback detection; rotate/scale application) read
as addressed (the fast/CPU decision now inspects `layer.effects?.blend`).
- **IMPROVE:** worker-pool parallel rendering (worker_threads + sharp), incremental/cached
  builds (hash inputs → skip unchanged), constraint solver for exact trait-distribution
  targeting, palette recoloring of grayscale layers, optional SVG/vector layers, RNG `[0,1)`
  audit, positive-weight validation, and finishing the `no-explicit-any` → error burndown.

### 2.2 CLI — `packages/cli` → **KEEP + IMPROVE**
Clean commander structure; 11 commands (init/validate/preview/build/dupes/audit/upload/
mint/deploy/candy/e2e); lazy SDK imports keep typecheck green. **Wart:** the `addHelpText`
banner still says "foundry" though `.name('conkernftz')`.
- **IMPROVE:** fix the help string; structured logging with `--verbose/--quiet/--json`; a
  `conkernftz doctor` preflight; config schema versioning + migration; an EVM `init`
  template (currently Solana-only); plugin-architecture groundwork; npm-publish readiness.

### 2.3 Storage — `packages/storage` → **KEEP + IMPROVE**
Phase 1 modernization is solid: `StorageProvider` interface + `withRetry` + factory; local
(CI-safe, dir base-URI), Pinata-JWT (dir pinning), Irys (lazy/optional); legacy
bundlr/nft.storage throwing stubs; 0 runtime deps.
- **IMPROVE (brief asks):** redundant pinning, resumable/idempotent uploads + CID
  re-verification. **Wart:** dual ESM/CJS build (`dist` + `dist-cjs`) is the source of the
  "tests-compiled-into-dist" cruft and the vitest-restricted-to-src workaround.

### 2.4 Chains — `chain-solana` (**KEEP**) / `chain-evm` (**KEEP, defer expansion**)
Solana: direct Umi mint + Core Candy Machine (chosen over classic CMv3 for umi-1.2 compat);
on-chain create/insert/mint compile but need a funded **devnet** wallet to validate live.
EVM: `ConkernftzCollection.sol` is the simple owner-mint ERC-721 + ERC-2981 + `Ownable` +
settable `<baseURI><id>.json`. **Version skew:** chain-evm is `5.0.0` while everything else
is `4.0.0`. The public-mint launch contract is the deferred Phase L.

### 2.5 UI — `packages/ui` → **REPLACE (renderer + main-process IPC)**
This is the headline. Concrete, verified findings:

**The renderer monolith.** `renderer/app.ts` = **12,090 lines**, with **403**
`getElementById`/`querySelector` calls, **41** `innerHTML` assignments, **120** `any`s.
`index.html` = 863 lines with **96** inline `style=` attributes — despite a genuinely good
`design-system/tokens.css` (full color/surface/border/typography/accent/status/shadow/
dimension/easing tokens, dark+light) that is only partially adopted. The architecture is a
flat sea of free functions over shared module state with HTML-string templating
(`layerRowTemplate`, `effectsRowTemplate`, `buildTransformCardHtml`) and manual event
binding. The Phase-4 `studio.ts` (395 lines) is the **counter-example and the seed of the
target**: a self-mounting module with a safe `h()` hyperscript (uses `textContent`, not
`innerHTML`), `replaceChildren()`, and DOM-free unit-tested logic in `studio/pure.ts`.

**Two root-cause architecture defects (not in the original brief):**
- **The UI does not depend on `@conkernftz/core`.** Its only deps are `execa` +
  `@conkernftz/storage`. So `main/ipc-project.ts` loads the engine by filesystem
  archaeology — three fragile loaders (`dynamicImportCore`/`requireCore`/`importCore`)
  that resolve `core/dist/*.js` by hardcoded relative path and **shell out to `pnpm build`
  at runtime** to self-heal. *This is the single biggest blocker to a packaged executable*
  and an architecture smell that must die.
- **The render pipeline is re-implemented in the main process.** `previewWithProgress`,
  `previewLive`, and `previewEffects` (in the 1,005-line `ipc-project.ts`) each hand-
  reassemble generation → spawn placement → transforms → `compositeLayers`, *separate* from
  core's unified `renderEdition()`. Three+ copies that can silently drift from build output.

**Capability mismatches / staleness (parity risks):**
- Mint tab's Upload Provider dropdown still offers **"Arweave"/"IPFS"** — the engine now
  uses irys/pinata/local. The UI's options no longer match reality.
- Mint tab is an explicit stub ("We will expand this page later…").
- Loose `window.foundry` IPC bridge is fully `any`-typed (`preload.d.ts`).

**Security baseline.** `main.ts` is good (contextIsolation on, nodeIntegration off,
`setWindowOpenHandler` deny). But CSP uses `unsafe-inline` (script + style), and several IPC
handlers (`saveJson`, `readFile`, `listImages`, `openInExplorer`) lack the path-containment
that `readFileBase64`/`renameFiles` correctly have — `saveJson` even accepts **absolute**
paths (renderer → arbitrary-path write). Tighten before the wallet-connect phase.

**Inventory of UI capabilities to preserve (the parity contract seed):**
Launcher (recents grid, create/add) · Main→Overview (previews gallery, lightbox, stats,
console) · Main→Files (project file browser: up/refresh/open/new-folder/upload/rename/
delete) · Main→Configure (Basics; Layers table w/ blend/opacity/rarity/required/assets +
Spawn Editor embed + Image Renamer w/ step-through; Utility: Rarity/Uniqueness/Export;
Experimental: Compositor/Generation/Conditional Layer Spawn w/ form + advanced JSON +
per-option rules) · Main→Rules&Export (rules JSON + transforms modal editor) ·
Main→Reports (rarity.json + asset/output audit) · Studio (layer reorder, weight sliders,
rarity histogram, regenerating gallery, animation preview, asset manager) · Mint (upload
provider/concurrency + mint from/count) · Options (theme/accent/radius/blur/noise/glow +
reset) · Fal AI (key, quick image, model catalog explore/import/export, dynamic param
editor, queue/webhook/dry-run, output save-all/open/clear) · Help (contextual `data-help`
popovers + a built help page) · About (brand, easter egg, links) · Live Preview overlay
(drag/reroll/fit/background) · build/preview pause/resume/stop.

### 2.6 Build/CI/quality → **IMPROVE**
`ci.yml` runs build+typecheck+lint+test on ubuntu+windows × Node 20 (Phase-0 consolidated).
No bundler anywhere (plain `tsc`; UI renderer compiled file-by-file). Known warts: storage
dist-test-cruft; build-vs-typecheck tsconfig split; `no-explicit-any` still `warn`.

### 2.7 Docs & brand → **IMPROVE / REPLACE-skin**
Docs are **systematically stale**: README calls the CLI `foundry` and lists a `ui-tauri`
package that no longer exists; `CONFIG_REFERENCE.md` documents the deprecated `arweave|ipfs`
storage + `@foundry/core`; `QUALITY_REVIEW.md` is dated 2025-09-10 (pre-Phase-0). Brand
(CONKERNFTZ + NASA easter egg) is **kept** per decision #5, but gets a wholly new visual
identity.

---

## 3. Target architecture

### 3.1 Layered model (Electron, post-overhaul)
```
┌───────────────────────────────────────────────────────────────────────┐
│ Renderer (React + Vite)                                                 │
│  • Design-system component library on enforced tokens (new identity)     │
│  • Feature modules per pipeline stage; pure logic in DOM-free TS         │
│  • State: lightweight store (Zustand); React Query-style async for IPC   │
│  • Talks ONLY through the typed IPC client (no Node, no fs, no core)     │
└───────────────▲───────────────────────────────────────────────────────┘
                │ typed, zod-validated IPC contract (shared types package)
┌───────────────┴───────────────────────────────────────────────────────┐
│ Preload (contextBridge)  — minimal, typed surface; replaces any-typed    │
│                            window.foundry                                │
└───────────────▲───────────────────────────────────────────────────────┘
                │
┌───────────────┴───────────────────────────────────────────────────────┐
│ Main (Node) — the "Engine Service"                                      │
│  • imports @conkernftz/core / storage / chain-* DIRECTLY (workspace dep) │
│  • owns FS (path-contained), native render (sharp/ffmpeg), CLI orchestr. │
│  • NO runtime pnpm build; NO re-implemented pipeline — calls core APIs   │
└───────────────▲───────────────────────────────────────────────────────┘
                │ in-process function calls
┌───────────────┴───────────────────────────────────────────────────────┐
│ Engine: @conkernftz/core (+ storage, chain-solana, chain-evm)            │
│  • renderEdition / buildCollection / generator / compositor / animation  │
│  • worker-pool rendering, incremental builds (new)                       │
└───────────────────────────────────────────────────────────────────────┘
```

### 3.2 Key decisions & trade-offs
1. **React + Vite** over Svelte/Solid/vanilla. *Why:* the richest ecosystem of accessible
   primitives (Radix) for the "premium UI" goal, the most mature headless testing
   (Testing Library + Playwright) to close the no-display gap, and the largest help/example
   base for a solo maintainer. *Trade-off:* heavier renderer runtime — acceptable in a
   desktop app.
2. **Ground-up parallel rewrite** over strangler. *Owner's call.* *Mitigations:* a literal
   feature-parity matrix as the cutover gate; the old renderer stays shippable until one
   gated switch; "ground-up" is scoped to renderer + main IPC, not the engine. *Trade-off:*
   longer to first cutover, cleaner end-state.
3. **Engine-as-dependency** over runtime path-archaeology. The UI gains a real
   `@conkernftz/core` workspace dependency; the three fragile loaders and runtime `pnpm
   build` are deleted. *Unblocks packaging and kills pipeline drift in one move.*
   *Trade-off:* must solve native-dep bundling (asarUnpack sharp + ffmpeg-static).
4. **Typed, zod-validated IPC contract** in a shared package over the loose `any`
   `window.foundry`. Safety + testability; every channel validates input and enforces path
   containment.
5. **Stay on Electron** over Tauri/web. Native sharp/ffmpeg in-process, lowest risk, budget
   goes to UX. *Trade-off:* larger binaries than Tauri — accepted.
6. **Token-driven styling, strictly enforced.** *Recommendation:* Tailwind v4 wired to
   CSS-variable design tokens (fast, consistent, pairs well with the design workflow), with
   a lint rule banning inline `style=`/hex. *Alternative:* vanilla-extract (type-safe,
   zero-runtime) if stricter typing of tokens is preferred. (Within-track sub-decision.)
7. **Worker-pool rendering in core** for the ~10k target, using `worker_threads` + a sharp
   pool — respects the no-`canvas` constraint; determinism preserved (golden tests guard it).

### 3.3 Information architecture — the headline redesign
Today's 7 tabs (+ launcher, + buried sub-tabs) become a **guided creator pipeline** with a
persistent project context and a stage indicator:

| New stage | Replaces / absorbs | Notes |
|-----------|--------------------|-------|
| **Projects** | Launcher | Recents, create/add, **templates (Solana + EVM)**, onboarding. |
| **Design** | Configure (Basics/Layers/Utility/Experimental) + Studio + Spawn Editor + Renamer | The authoring core: Layers, Traits & Rarity (with live weight sliders + predicted distribution), Rules (structured editors + JSON escape hatch), Effects (glow/stroke/shadow/extrude/blur/modulate/colorOverlay + presets + per-asset overrides), Spawn/Placement, Assets/Renamer. |
| **Preview** | Overview previews + Live Preview overlay + Studio gallery/animation | Live preview, regenerating gallery, lightbox, animation preview. |
| **Build** | Build controls + Reports | Generate w/ progress/pause/resume/stop; rarity histograms; dupes/audit. |
| **Publish** | Mint (stub) | Provider selection matching real providers; dir-CID upload; Solana CM/Umi + EVM owner-mint; later the wallet-connect launch. |
| **AI** | Fal AI | Preserved + polished. |
| **Settings** | Options + Files + provider creds | Theme/accent/customization (preserved), storage/chain credentials, project file browser, app prefs. |
| **Help / About** | Help + About | Contextual help preserved; brand + reimagined easter egg. |

A persistent **pipeline status rail** (Design → Preview → Build → Publish) makes the flow
legible; empty/loading/error/skeleton states are first-class throughout.

---

## 4. Phased roadmap

Effort key: S ≈ days, M ≈ 1–2 wks, L ≈ 2–4 wks, XL ≈ 4–8 wks (solo). The **Engine track**
runs parallel to the UI track after O0. **Phase L (EVM launch) is last and audit-gated.**

### Phase O0 — Program foundations & the parity contract  *(enabling; do first)*

> **Status: ✅ DONE (2026-06-17).** Delivered: the feature-parity matrix
> (`docs/UI_PARITY_MATRIX.md`); the engine-boundary refactor — `packages/ui` now depends
> on `@conkernftz/core` + `@conkernftz/chain-solana`, a new electron-free
> `main/engine-service.ts` calls core's one render path (`renderEdition`/`buildCollection`/
> `renderPreviewEdition`) loaded by package specifier via `main/dynamic-import.js`; the
> three runtime core-loaders (`dynamicImportCore`/`requireCore`/`importCore`) and **all
> runtime `pnpm build` self-heal removed** (the packaging blocker); the typed IPC contract
> (`src/shared/ipc.ts` → `FoundryApi`/`FOUNDRY_METHODS`) typed through preload, with the
> latent **`readFileBase64`/`saveJson` preload.cjs drift fixed** + a drift-guard test;
> path-containment on write/delete IPC handlers (absolute *reads* still allowed for
> absolute layer dirs); CLI `--help` "foundry"→"conkernftz"; chain-evm version aligned to
> 4.0.0; `spawn.js` added to the core barrel. Tests: UI 17→25 (added headless engine-service
> functional coverage + preload contract). Green gate verified on Windows; runtime
> package-specifier resolution of core/chain-solana verified by Node.
> **Deferred to O1:** the Vite+React+RTL renderer toolchain, Playwright-for-Electron E2E,
> and the component playground — they belong with the React shell and the E2E tier cannot
> be validated headlessly here (see `docs/TESTING.md` §2). The manual GUI smoke checklist
> (`docs/TESTING.md` §3) covers the renderer gap until then.

- **Goal:** lay the rewrite's safety rails and fix the root-cause architecture defects *on
  the existing app first*, so the new app is built on a clean boundary and the old app stays
  shippable.
- **Scope:**
  1. **Feature-parity matrix** — exhaustive inventory of UI screens/controls/flows, the 33
     IPC channels, 11 CLI commands, and the config surface; each tagged keep/improve/replace
     with acceptance criteria. *This is the cutover gate.*
  2. **Engine boundary refactor** — add `@conkernftz/core` (+ storage, chain-*) as
     `workspace:*` deps of `packages/ui`; delete `dynamicImportCore`/`requireCore`/
     `importCore` + the runtime `pnpm build` self-heal; replace `previewWithProgress`/
     `previewLive`/`previewEffects` with direct typed calls into `renderEdition`/
     `buildCollection`. Introduce a single `main/engine-service.ts`.
  3. **Typed IPC contract** — a shared `packages/ipc-contract` (or `core/ipc-types`) with
     zod schemas per channel; preload exposes the typed surface.
  4. **Build system** — Vite for the renderer; keep/upgrade tsc (or tsup/esbuild) for
     main/preload; verify native deps resolve.
  5. **Heavy test scaffolding** — Vitest + RTL + Playwright-for-Electron + visual-regression
     + a component playground (Storybook or Ladle), one passing test each, in CI.
  6. **Cheap correctness/security wins** — path-containment on all IPC handlers; fix the CLI
     "foundry" help string; align chain-evm version; CSP hardening plan.
- **Areas/files:** `packages/ui/package.json`, `src/main/{ipc-project,cli-runner}.ts`, new
  `src/main/engine-service.ts`, new shared IPC-contract package, `vite.config`, `.github/
  workflows/ci.yml`, `eslint.config.mjs`, docs.
- **New deps:** `vite`, `react`, `react-dom`, `@vitejs/plugin-react`, `@playwright/test`,
  `@testing-library/react`, `happy-dom`/`jsdom`, `zod` (UI), Storybook/Ladle.
- **Effort:** L. **Risk:** M (touches the fragile loader — mitigated by doing it behind the
  *current* UI and verifying preview/build before any React exists).
- **Depends on:** nothing. **Verification:** green gate; existing Electron app still
  launches + previews/builds via the new engine boundary (manual smoke); parity matrix
  signed off.

### Phase O1 — New identity, design system & React app shell

> **Status: 🟡 FOUNDATION LANDED (2026-06-17).** Stood up the deferred toolchain
> (React 18 + Vite 5 + React Testing Library + happy-dom + @fontsource fonts) as a
> **parallel `packages/ui/src/renderer-next`** (own `tsconfig.renderer-next.json`,
> `vite.config.ts`, `vitest.config.ts`; legacy renderer untouched until O6). Delivered a
> committed **new visual identity** — "Field Instrument / Classified Dossier" (instrument
> amber on ink / ink on manila paper, IBM Plex Mono + Archivo, hairline grids, registration
> crop-marks, status lamps; CONKERNFTZ kept, NASA easter egg reimagined as a redaction
> stamp) as CSS-variable tokens (`styles/tokens.css` + `ui.css`, dark+light). Built the
> accessible primitive library (Button, Panel, Field/Input/Select, Lamp, Badge, Dialog,
> Toast, Skeleton, EmptyState, RedactionStamp), a `ThemeProvider`, the instrument-console
> **app shell** (header + pipeline IA nav + status bar) with state-based navigation, the
> **Projects launcher** (recents + bridge-aware open) wired to the optional `window.foundry`
> bridge, stage placeholders, and an in-app **component playground**. Tests: UI 30→**+6**
> (component + smoke, happy-dom). Verified: Vite dev server runs and the app mounts with
> zero console errors; full gate (build/typecheck/lint/test) green. _Visuals not yet
> screenshot-verified here (the capturer timed out); run `pnpm -C packages/ui
> dev:renderer-next`._
> **Remaining O1 / next:** real screen content per stage is O2+; Playwright-for-Electron
> E2E + visual-regression still pending; wire Electron to load the new bundle at cutover (O6).

- **Goal:** the new visual language + the React skeleton everything mounts on.
- **Scope:** new identity (palette, typography, spacing/elevation/motion/iconography; brand
  keeps CONKERNFTZ + reimagined NASA easter egg) delivered as enforced tokens; React app
  shell (navigation = the new IA, theming incl. preserved accent/radius/blur/noise
  customization, lightweight store); the component library (buttons/inputs/tabs/modals/
  cards/toasts + empty/loading/error/skeleton states) on Radix primitives; component
  playground populated.
- **Areas/files:** new `packages/ui/src/renderer` React tree; design-system tokens + lint
  rule banning inline styles.
- **New deps:** `@radix-ui/*`, `zustand`, icon set (lucide), styling (Tailwind v4 *or*
  vanilla-extract).
- **Effort:** L. **Risk:** M (design + framework standup). **Depends on:** O0.
- **Verification:** component tests + visual-regression baselines; playground snapshots;
  manual smoke.

### Phase O2 — Project lifecycle + Design surface  *(largest UI phase; split O2a/O2b)*

> **Status: 🟡 O2a LANDED (2026-06-17).** Real project-state plumbing
> (`state/project.tsx` ProjectProvider — parsed config + recents + load/save with
> **lossless round-trip** via the expanded `lib/bridge.ts`), the **Design** screen
> (project basics + a layers table: name/path/rarity/required/opacity + live asset
> counts, add/remove/reorder, dirty-tracked Save), and the **Preview** screen (live
> render gallery via the engine's `previewLive`, with loading/idle/offline states).
> Wired into the shell nav; Projects launcher now drives the shared context. Tests:
> UI 30→34 (Design load/edit/save + lossless round-trip; Preview renders returned
> images — mocked bridge). Gate green.
>
> **O2b LANDED (2026-06-17):** per-layer **effects editor** (blend-mode select + offset/
> rotate/scale + glow/stroke/shadow/blur/modulate/colorOverlay/extrude) reached via an "fx"
> button per layer, and a **rules editor** with a JSON escape hatch (full
> mutuallyExclusive/requires/maxOccurrences/transforms capability now; structured editors to
> follow). Effect types not yet rendered are still preserved on save (config is cloned, not
> rebuilt). Tests: UI 34→36 (effects-glow round-trip + rules-JSON apply, both lossless).
> **Remaining:** structured rule editors, conditional-spawn / per-option-rule UI, the
> spawn/placement editor, the image renamer, and per-asset overrides.

- **Goal:** migrate the authoring experience (the most-used surface) at parity+.
- **O2a:** Projects (launcher/onboarding, recents, create/add, Solana+EVM templates);
  Design→Layers (drag-reorder, paths, rarity, blend/opacity, asset counts); config Basics;
  the project file browser (Settings).
- **O2b:** Effects editor (full effect set + presets + per-asset overrides); Rules editor
  (mutuallyExclusive/requires/maxOccurrences + transforms — structured UI replacing the raw
  JSON textarea, **with a JSON escape hatch to preserve capability**); conditional spawn
  (form + advanced JSON + per-option rules); Spawn/Placement editor (port `spawn-editor.ts`);
  Image Renamer (bulk + step-through). All via the typed engine boundary.
- **New deps:** drag-and-drop lib (e.g. `@dnd-kit/core`) if needed.
- **Effort:** XL. **Risk:** M–H (most feature surface; parity-critical). **Depends on:**
  O1, Engine track (for predicted-distribution helpers). **Verification:** parity items
  checked; component + E2E tests; manual smoke.

### Phase O3 — Generate → Preview → Build (guided flow + reports)
- **Goal:** the preview/build experience with the new perf + reports.
- **Scope:** live preview overlay reimagined; regenerating gallery + lightbox; build with
  progress/pause/resume/stop (preserved); reports (rarity histograms, dupes/audit
  integration); animation preview + format selection; Studio panels folded into the IA.
- **Effort:** L. **Risk:** M. **Depends on:** O2, Engine track (worker pool for big builds).
- **Verification:** golden tests green; perf benchmark (10k build time); E2E.

### Engine track (parallel after O0) — Power & performance
- **Goal (decision #7):** worker-pool parallel rendering (`worker_threads` + sharp pool);
  incremental/cached builds (hash inputs → skip unchanged); constraint solver for exact
  trait-distribution targeting; palette recoloring of grayscale layers; optional SVG/vector
  layers; RNG `[0,1)` + positive-weight validation; finish `no-explicit-any`→error.
- **Areas/files:** `packages/core/src/*` + `cli` flags; storage redundant-pinning/resumable
  uploads + CID verification.
- **Effort:** L. **Risk:** M (determinism under parallelism — golden tests guard it).
- **Depends on:** O0. **Verification:** golden/determinism tests; perf benchmarks; unit tests.

### Phase O4 — Publish surface + CLI/DX hardening
- **Goal:** fix the stub Mint tab + the storage-provider mismatch; first-class
  upload→mint; harden CLI.
- **Scope:** Publish tab — provider selection matching **real** providers (irys/pinata/
  local), dir-CID upload surfaced, idempotent/resumable uploads + CID verification, manifest
  visibility, progress/logs; Solana Candy Machine end-to-end (devnet) + direct Umi mint; EVM
  owner-mint healthy. CLI/DX — structured logging + verbosity (`--verbose/--quiet/--json`),
  `conkernftz doctor`, config versioning + migration, plugin-architecture groundwork,
  npm-publish prep.
- **Effort:** L. **Risk:** M (CM needs devnet; storage needs creds → default local/mocks).
- **Depends on:** O0, O3. **Verification:** local-provider e2e; devnet CM dry-run; CLI tests.

### Phase O5 — Packaging & distribution (signed installer)
- **Goal (decision #4):** a real installable executable.
- **Scope:** electron-builder → signed Windows installer (NSIS) bundling `dist` + native
  binaries (**sharp, ffmpeg-static**) via `asarUnpack`; optional mac/linux + auto-update;
  retire the interim `.bat` launcher. *Depends on the O0 boundary cleanup (no runtime
  `pnpm build`).* Code-signing certificate procurement.
- **Effort:** M. **Risk:** M (Windows native-binary packaging + signing). **Depends on:** O0
  (hard), ideally O2+ for a meaningful app to ship. **Verification:** install on a clean
  Windows VM, launch, run a full **offline** build (no pnpm/node toolchain present).

### Phase O6 — Cutover & monolith retirement
- **Goal:** the single gated switch old → new.
- **Scope:** final parity-matrix sign-off; flip the Electron entry to the React app; delete
  `app.ts` (12k), old `index.html`/`styles.css`; rewrite README/UI_GUIDE/CONFIG_REFERENCE;
  fresh release notes.
- **Effort:** M. **Risk:** H (the moment capability could be lost — gated by the parity
  matrix + heavy test suite). **Depends on:** O2–O5. **Verification:** full parity checklist
  + all test tiers + manual smoke on the packaged build.

### Phase L — *DEFERRED:* EVM public-mint launch contract + wallet-connect *(LAST · mainnet · audit-gated)*
Carries the full Phase-5 spec from `hazy-riding-pearl.md`. See §6.

---

## 5. Cross-cutting tracks
- **Testing/CI (heavy, decision #8):** pure-logic unit tests (Vitest) · React component
  tests (RTL) · component playground snapshots (Storybook/Ladle) · Playwright-for-Electron
  E2E on key flows · visual-regression on key screens · existing golden-image engine tests.
  All on ubuntu+windows × Node 20. Define a **manual GUI smoke checklist** for the residual
  gap. Resolve storage dist-test-cruft; split build-vs-typecheck tsconfigs.
- **Performance:** worker-pool + incremental builds (Engine track); a tracked 10k-build
  benchmark; preview-grid virtualization in the renderer; lazy-load heavy tabs.
- **Accessibility:** Radix primitives for focus/ARIA; preserve+extend today's keyboard tab
  nav and `prefers-reduced-motion`; color-contrast budget on the new palette; automated a11y
  checks (axe) in component tests.
- **Docs & brand:** rewrite README/UI_GUIDE/CONFIG_REFERENCE/CLI_REFERENCE to reality
  (irys/pinata/local, animation, CM, EVM, `conkernftz` CLI); retire `QUALITY_REVIEW.md` or
  refresh it; document the new identity + design-system usage; keep the easter egg.
- **Packaging/distribution:** electron-builder pipeline; signing; auto-update; offline-first
  guarantee (no runtime build).
- **Security:** path-containment everywhere; CSP without `unsafe-inline`; the typed IPC
  contract; the deferred wallet-connect never custodies keys.

---

## 6. Deferred future phase — EVM launch contract + wallet-connect (Phase L)

> **Clearly marked future work. Sequenced AFTER the overhaul. Mainnet → audit-gated.**
> Full spec: `hazy-riding-pearl.md` (Phase 5). Settled decisions carried verbatim:

- **Contract** `packages/chain-evm/contracts/ConkernftzLaunch.sol`: **ERC-721A + ERC-2981 +
  Ownable2Step + ReentrancyGuard** + pause; phases **Closed → Allowlist (Merkle) →
  fixed-price Public → Reveal** (placeholder URI → flip `baseURI`); **provenance hash** at
  construction; **withdraw/treasury** (pull-payment); **keep `ownerMint`**.
- **Chains:** Base + Ethereum L1. **Mainnet blockers (mandatory):** external audit +
  Foundry (forge) fuzz/invariant tests + Slither + gas/economic review. `.sol` is the single
  source; the committed `artifact.ts` is **derived from forge `out/`** (replacing the solc-js
  double-compile). viem deploys from the artifact.
- **Wallet-connect:** in-app **WalletConnect v2**, the **app never custodies private keys**
  (external wallet signs). Deploy / set-allowlist-root / advance-phase / reveal / withdraw /
  mint from the GUI, each with explicit **mainnet confirmation + gas display**. Wired into
  the **new React app's wallet module** (not the retired renderer), reusing the typed IPC
  contract + the Publish surface.
- **Storage:** already produces the directory-CID `baseUri` the `<baseURI><id>.json` pattern
  needs (Phase 1). 
- **Effort:** XL. **Risk:** highest in the program (real funds). **Verification:** forge
  test/coverage + Slither clean; Base-Sepolia + Sepolia full e2e (deploy → set root →
  allowlist mint → public mint → reveal → withdraw → verify); **external audit complete
  before any mainnet deploy** — I produce audit-ready artifacts (NatSpec, threat model,
  coverage) but a human/firm audit + economic review is the gate I cannot substitute for.

---

## 7. Sequencing & dependencies
```
O0 (foundations + parity contract + engine boundary)
 ├─► O1 (identity + design system + React shell)
 │     └─► O2 (projects + design surface)  ──► O3 (preview/build + reports)
 │                                                 └─► O4 (publish + CLI/DX)
 ├─► Engine track (worker pool, incremental, generation power)  ──┘ (feeds O2/O3)
 └─► O5 (packaging) ── needs O0; ships meaningfully after O2+
                                   │
              O2…O5 complete ──► O6 (cutover + retire app.ts)
                                   │
                                   ▼
              Phase L — EVM launch + wallet-connect (LAST, audit-gated)
```

## 8. Risks, unknowns & open decisions
- **Ground-up rewrite ⇒ capability-loss risk.** *Mitigation:* the parity matrix is the
  cutover gate; old renderer stays shippable until O6.
- **Native-dep packaging (sharp + ffmpeg-static on Windows).** *Mitigation:* asarUnpack +
  a clean-VM offline-build test in O5; the O0 boundary cleanup removes the runtime-build
  dependency that would otherwise make packaging impossible.
- **No GUI in the agent environment.** *Mitigation:* heavy automated UI testing +
  component playground + manual smoke checklist; pure logic stays DOM-free.
- **Determinism under parallel rendering.** *Mitigation:* golden tests are the guard;
  seed/work partitioning designed to be order-independent.
- **Solana CM + EVM launch need funded testnet/devnet wallets.** *Mitigation:* default
  local/devnet, mock in CI, gate mainnet.
- **Open within-track decision:** styling tech (Tailwind v4 + token vars vs vanilla-extract)
  — recommendation Tailwind v4; confirm at O1.
- **Open within-track decision:** whether the shared IPC contract lives in a new package or
  inside `core` — confirm at O0.

## 9. Global verification gate (every phase)
`pnpm -w build && pnpm -w typecheck && pnpm -w lint && pnpm -w test` → 0 errors, no masking;
plus the phase-specific tests / testnet dry-runs above; CI green on ubuntu + windows (Node
20); parity-matrix items closed before O6 cutover.
