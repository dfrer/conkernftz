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

**The new React UI is the default** (as of the O6 cutover). `pnpm -C packages/ui start`
launches it; with a real project open it exercises the live bridge (config load/save,
`previewLive`, `buildWithProgress`) and degrades to OFFLINE empty states off-bridge. The
**legacy renderer** remains available as an escape hatch via `pnpm -C packages/ui start:legacy`
(or `CONKERNFTZ_LEGACY=1`) until it is deleted. In a browser, `pnpm -C packages/ui
dev:renderer-next` serves the new UI with the bridge absent.

**Boot & project**
- [ ] App launches; no errors in the console pane or devtools.
- [ ] Launcher shows recents; "Browse…" opens a project; switching projects updates the header label.

**Design**
- [ ] Configure ▸ Basics loads current config; edits + Save persist to `foundry.config.json`.
- [ ] Layers table lists layers with correct asset counts; add/reorder/edit blend & opacity; Save.
- [ ] Spawn Editor opens and edits placement dots.
- [ ] Image Renamer bulk + step-through rename works; rarity weights apply.
- [ ] Rules & Export: rules JSON validates + saves; Transforms modal edits + saves.
- [ ] Conditional spawn + per-option rules (form + advanced JSON) save correctly.

**Preview & build**
- [ ] Live Preview overlay shows; drag, reroll, fit modes, background modes work; export/save.
- [ ] Generate Previews writes preview images; gallery + lightbox work.
- [ ] Build Collection runs with progress; **Pause / Resume / Stop** behave; images + JSON + rarity.json produced.
- [ ] **Studio tab:** layer reorder, weight sliders + predicted %, rarity histogram, regenerating gallery,
      **animation preview (verifies the readFileBase64 fix)**, asset manager delete/renumber.

**Reports / publish / AI / settings**
- [ ] Reports: open rarity.json; Audit Assets + Audit Outputs return results.
- [ ] Mint tab: upload + mint controls invoke the CLI (until the Publish rebuild).
- [ ] Fal AI: key, quick image generate, catalog explore/import/export, param editor, dry run, output save.
- [ ] Options: theme/accent/radius/blur/noise/glow apply live; Reset UI.
- [ ] About links open in the external browser; NASA easter egg present.

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
