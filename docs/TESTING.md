# conkernftz — Testing Strategy

This is the verification backbone for the overhaul. The headline constraint: the build
environment (and CI) **cannot launch or visually verify the Electron GUI**. The strategy
therefore pushes as much behavior as possible into headlessly-testable pure logic and
real-engine functional tests, and pairs the residual gap with a **manual GUI smoke
checklist** (§3) run before each release / cutover.

## 1. Test tiers

| Tier | Tooling | Scope | Status |
|------|---------|-------|--------|
| Unit (pure logic) | Vitest | core engine, rarity/dna/rules, studio `pure.ts`, engine-service helpers, IPC contract | ✅ in place |
| Functional (real engine, headless) | Vitest | `engine-service` builds a fixture collection + renders previews via real `@conkernftz/core`; CLI `e2e-build` | ✅ in place (O0) |
| Golden image (visual regression of the compositor) | Vitest + pixelmatch + sharp | blend/effects/transform parity, native vs CPU | ✅ in place |
| Contract / drift guard | Vitest | `preload-contract.test.ts` asserts runtime `preload.cjs` exposes the full `FoundryApi` | ✅ in place (O0) |
| Component (renderer) | Vitest + React Testing Library | React components in isolation | ⏳ O1 (with the React shell) |
| Component playground | Storybook or Ladle | visual catalog + snapshots of components | ⏳ O1 |
| End-to-end (GUI) | Playwright-for-Electron (+ xvfb in CI) | launch the packaged app, drive key flows | ⏳ O1 |

**Green gate (every change):** `pnpm -w build && pnpm -w typecheck && pnpm -w lint &&
pnpm -w test` → 0 errors, no masking; CI on ubuntu + windows (Node 20).

## 2. Why the React/Vite/Playwright tiers are O1, not O0

O0 deliberately delivered the **verifiable** foundation (engine boundary, typed IPC
contract, security/correctness, headless functional tests, parity matrix). The React +
Vite renderer toolchain, React Testing Library component tests, the component playground,
and Playwright-for-Electron E2E are **O1's opening work** because:

1. They are the foundation for the *new shell* (O1), and have nothing real to render or
   assert against until components exist.
2. Playwright-for-Electron E2E needs a display (xvfb in CI) and **cannot be validated in
   the current environment**; wiring an unverifiable job into CI would risk the green
   gate for no functional gain.

Until those land, the manual GUI smoke checklist (§3) covers the renderer gap.

## 3. Manual GUI smoke checklist

Run after any change to `packages/ui` main-process / preload / renderer, and before a
release. Build first: `pnpm -w build`, then `pnpm -C packages/ui start`.

**The React UI is the only renderer** (the legacy `app.ts` renderer was removed in the O6
stage-2 cutover). `pnpm -C packages/ui start` launches it; with a real project open it
exercises the live bridge (config load/save, `previewLive`, `buildWithProgress`) and
degrades to OFFLINE empty states off-bridge. The engine runs in a separate Electron
`utilityProcess`, so heavy generation/rendering never freezes the window. In a browser,
`pnpm -C packages/ui dev:renderer-next` serves the UI with the bridge absent.

**Boot & Projects**
- [ ] App launches; no errors in devtools console; window stays responsive.
- [ ] Projects screen shows recents; "Browse…" opens a project; switching updates the header label.

**Design**
- [ ] Basics loads current config; edits + Save persist to `foundry.config.json`.
- [ ] Layers table lists layers with correct asset counts; add/remove/reorder; edit blend & opacity; Save.
- [ ] `fx` opens the effects editor (blend/offset/glow/stroke/shadow/etc.) + per-asset overrides; Save preserves untouched fields.
- [ ] Rules editor: max-occurrences / mutually-exclusive / requires + the JSON escape hatch save correctly.
- [ ] Image Renamer: set-uniform-weight and sequence-rename produce correct `value<delim>weight` filenames.
- [ ] Spawn editor: click to add dots, drag to move, edit x/y/weight/jitter, per-layer mapping; Save writes the spawn map.

**Preview & Build**
- [ ] Preview renders a fresh thumbnail gallery from the engine; window stays responsive while rendering.
- [ ] Build runs with a live progress bar; **Pause / Resume / Stop** behave; images + JSON + `rarity.json` produced; rarity report + audits render.

**Publish / AI / Settings / Help**
- [ ] Publish: upload uses the real providers (irys/pinata/local), modes auto/dir/files; mint actions stream to the command console.
- [ ] AI (Fal): key, model, size, count, prompt → results gallery; save-to-project works.
- [ ] Settings: theme + accent switch live; storage/chain fields save losslessly.
- [ ] Help: About links open in the external browser; NASA easter egg (redaction stamp) present.

**Security spot-checks**
- [ ] `saveJson` / writes outside the project are refused ("Path escapes project").
- [ ] External links open in the OS browser (not a new Electron window).

## 4. Running tests

```
pnpm -w test                     # all packages
pnpm -C packages/ui test         # UI unit + functional + contract
pnpm -C packages/core test       # engine + golden images
UPDATE_GOLDEN=1 pnpm -C packages/core test   # regenerate golden refs (document why)
```

## 5. Visual review: screenshot harness

Unit tests prove inputs, not pixels — they can pass while a screen renders blank
(we hit exactly that with the file:// site export). The screenshot harness closes
that gap: it renders the built renderer in headless Edge/Chrome behind a mocked
`window.foundry` (sample project + canvas-generated art), drives the pipeline nav,
and writes a full-page PNG per stage to `packages/ui/screenshots/` (gitignored).

```
pnpm -C packages/ui build:renderer-next   # build what the harness will serve
pnpm -C packages/ui screenshots           # capture every stage → packages/ui/screenshots/*.png
```

It uses `playwright-core` against the **system** browser (no ~150 MB browser
download). The mock bridge lives in `scripts/screenshots.mjs` (`installMock`) —
extend it there when a new screen needs more bridge methods or richer sample data.
