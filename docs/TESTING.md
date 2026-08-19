# conkernftz — Testing Strategy

This is the verification backbone for the overhaul. The headline constraint: the build
environment (and CI) **cannot launch or visually verify the Electron GUI**. The strategy
therefore pushes as much behavior as possible into headlessly-testable pure logic and
real-engine functional tests, and pairs the residual gap with a **manual GUI smoke
checklist** (§3) run before each release / cutover.

## 1. Test tiers

| Tier                                               | Tooling                                       | Scope                                                                                                        | Status                      |
| -------------------------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | --------------------------- |
| Unit (pure logic)                                  | Vitest                                        | core engine, rarity/dna/rules, studio `pure.ts`, engine-service helpers, IPC contract                        | ✅ in place                 |
| Functional (real engine, headless)                 | Vitest                                        | `engine-service` builds a fixture collection + renders previews via real `@conkernftz/core`; CLI `e2e-build` | ✅ in place (O0)            |
| Golden image (visual regression of the compositor) | Vitest + pixelmatch + sharp                   | blend/effects/transform parity, native vs CPU                                                                | ✅ in place                 |
| Contract / drift guard                             | Vitest                                        | `preload-contract.test.ts` asserts runtime `preload.cjs` exposes the full `FoundryApi`                       | ✅ in place (O0)            |
| Component (renderer)                               | Vitest 4 + React Testing Library + happy-dom  | React screens, components, and browser-safe wallet/bundle logic                                              | ✅ in place                 |
| Component playground                               | In-app Components screen + screenshot harness | visual catalog, themes, and compact layouts                                                                  | ✅ in place                 |
| End-to-end (built UI)                              | Playwright-core + system Edge/Chrome          | drive every headlessly-testable surface and verify outcomes                                                  | ✅ `pnpm -C packages/ui qa` |

**Green gate (every change):** frozen install, `pnpm -w build`, `pnpm -w typecheck`, `pnpm -w lint`,
`pnpm -w test`, and `pnpm -w test:coverage` → 0 errors, no masking. CI covers Ubuntu + Windows on
Node 22 and 24 with the frozen lockfile. Main-process or renderer changes also run the QA driver and
screenshot harness.

## 2. Automated UI verification

The React renderer now has component and pure-logic coverage under Vitest 4. The standing QA driver
loads the production renderer in a system browser, installs the mock bridge, drives all supported
screens and failure paths, and writes a machine-readable report. The screenshot harness separately
captures the full visual matrix. These gates validate the built renderer and exported static site;
wallet extensions, file pickers, and real chain/provider traffic remain manual because they require
the owner's environment and credentials.

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
- [ ] **Import layer folder…** accepts a root `Layers` container or direct layer folders,
  recognizes PNG/WebP/GIF/SVG assets, creates a missing `foundry.config.json`, and opens
  the project without moving, renaming, deleting, or overwriting art.
- [ ] Existing schema-valid config is reused unchanged; malformed, schema-invalid, or
  ambiguous layouts show an actionable error and do not write a config.

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
pnpm -w test:coverage            # coverage floors under Vitest 4
pnpm -C packages/ui test         # UI unit + functional + contract
pnpm -C packages/core test       # engine + golden images
pnpm -C packages/ui qa           # built-UI interaction and outcome driver
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

### Existing-folder importer evidence (2026-08-19)

The importer’s real temporary-filesystem fixtures cover both supported layouts, natural
layer ordering, supported extensions, ignored generated folders, existing-config reuse,
schema-invalid/malformed and ambiguous layouts, cancellation, and no-write failure paths.
The focused importer/security/Projects suite passed **40/40**; UI typecheck and `build:ts`
passed; lint exited 0 with 0 errors and 32 warnings; and `git diff --check` passed. The
production UI build passed after resolving a main-process compile-only type-resolution issue.
The successful import adopts one authoritative validated-or-generated schema-conformant snapshot
atomically with the project directory and recents; existing configs are schema-validated and
lossless, while generated configs are tested equal to the persisted JSON. Cancellation, errors,
and incomplete results leave both sides unchanged. The screenshot
harness captured **52/52** with the Projects screen inspected, and the QA driver reported
**0 findings**. The post-review full UI suite was **254/255** on the first run because of one
unrelated Design modal timing test (`edits a layer effect (glow) and saves losslessly`);
the isolated full `design.test.tsx` run passed **7/7**. No network or live chain action was
used. The owner’s NASAID folder was not present locally, so these checks use real temporary
fixtures rather than that specific folder.
