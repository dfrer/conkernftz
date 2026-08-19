# Modernization handoff — 2026-08-16

## Outcome and scope

MAINT-1 modernizes the current GitHub build while preserving the owner-approved V1 design. It covers
the supported Node/Electron/Vite/Vitest/Sharp stack, reproducible CI installs, dependency security,
Electron IPC/navigation boundaries, browser bundle separation, and the matching tests and docs. It
does not perform live wallet, provider, devnet/mainnet, hosting, payment, or deployment actions.

## Changed areas

- Root/package manifests, lockfile, and CI runtime matrix.
- Core/CLI Sharp 0.35 compatibility and Vitest 4 source-only coverage configuration.
- Electron main-process IPC sender validation, navigation/window hardening, and regressions.
- Renderer/site/console browser boundaries, lazy WalletConnect settings, and Vite 8 configs.
- Runtime compatibility fixtures/tests and authoritative README/testing/plan documentation.

## Validation and results

- Frozen install, full build, typecheck, lint, source tests, and coverage: pass.
- 408 source tests: core 47, storage 13, Solana 17, EVM 81, UI 238, CLI 12.
- Production audit: 0 critical / 0 high / 5 moderate / 0 low.
- Solidity runtime artifacts regenerated with the documented exact solc 0.8.31 pin; EVM build and
  81-test adapter suite pass.
- UI QA driver: 0 findings. Screenshot harness: 52 captured / 0 failed; representative visual
  inspection passed. Real Edge static-site `file://` smoke: pass with zero page/console errors.
- CLI 4.0.0 version/help smoke: pass. `git diff --check`: pass.

## Delivery state

Merged into `main` through PR #97 after all five GitHub checks passed. Merge commit `985c6a0`
contains the reviewed modernization and the cross-platform UI timing regression fix. The obsolete
dirty `conkernftz-main` checkout remains untouched.

## Risks and blockers

- WalletConnect/browser-extension signing and Solana/devnet operations remain owner-environment
  checks; no credentials or chain traffic were used.
- Forge/Slither are not installed locally, so the prior contract result stands and OC-5 remains open;
  do not treat artifact regeneration alone as a fresh contract audit.
- Vite 8 reports informational `import.meta` replacement for the single-file IIFE site; the output
  contains no residual `import.meta` and passes the real `file://` smoke.
- Remaining high advisories are transitive development tooling only; production has none. Existing
  Metaplex UMI peer warnings remain and the chain suite passes.

## Next action

Run the owner-environment wallet and Solana devnet checklist before any live deployment; keep
mainnet blocked on the existing OC-5 audit/freeze gate.

---

# Existing-folder import handoff — 2026-08-19

## Outcome and scope

Projects can now import an ordinary art folder whose layer folders are present but whose
`foundry.config.json` is missing. The importer accepts one `Layers` container or direct layer
folders, recognizes direct PNG/WebP/GIF/SVG assets, infers natural numeric ordering, and writes
only the missing project metadata needed to open and use the folder.

## Safety and behavior

The importer never moves, renames, deletes, or overwrites art. A schema-valid existing config is
reused unchanged. In direct-folder mode, common generated root folders (`build`, `output`,
`previews`, `uploads`, `dist`, and related output/metadata folders) are ignored. Malformed or
schema-invalid configs, multiple layer containers, and folders without usable supported assets
fail closed without writing a config. Generated defaults include a 1024×1024 transparent PNG,
edition size capped at 100, filename rarity, SHA-256 uniqueness, local build output, and an EVM
target; the user can review them in Design. A successful import returns one authoritative
validated-or-generated schema-conformant snapshot and adopts it atomically with the project
directory and recents; existing configs are schema-validated and lossless, while generated
configs are tested equal to the persisted JSON. Cancellation, errors, and incomplete results
leave both main and renderer state unchanged.

## Validation and results

- Focused importer/security/Projects suite: **40/40**.
- UI typecheck and `build:ts` passed; lint exited 0 with 0 errors and 32 warnings; and `git diff --check` passed.
- Production UI build passed after resolving a main-process compile-only type-resolution issue.
- Screenshot harness: **52/52**, with the Projects screen inspected.
- QA driver: **0 findings**.
- Post-review full UI suite: **254/255** on first run because of one unrelated Design modal timing
  test (`edits a layer effect (glow) and saves losslessly`); isolated full `design.test.tsx` passed
  **7/7**.
- The owner’s NASAID folder was not found locally; validation used real temporary filesystem
  fixtures, not that exact folder.
- No network, provider, wallet, or live chain action was used.

## Delivery state and next action

The importer is merged into `main` through PR #99 after all five GitHub checks passed. Merge commit
`e85b7c0` contains the reviewed feature and its tests/documentation. The next practical check is
for the owner to select the NASAID folder in **Projects → Import layer folder…**, review the
generated config in **Design**, and report any layout-specific mismatch.

---

# Windows one-click launcher handoff — 2026-08-19

## Outcome and scope

`Launch ConkerNFTZ.bat` is the clear Windows double-click entry point. It resolves its own repository
directory, verifies the workspace and supported Node 22.14+ prerequisite (before Node 25), selects
pinned pnpm 9.1.0 through Corepack when available, and falls back only to a verified pnpm 9.x on
`PATH` when Corepack cannot prepare the pinned runner. Install, build, and Electron start all use
that same selected runner and propagate failures. `conkernftz.bat` remains a backwards-compatible
forwarding entry point.

`Launch ConkerNFTZ.bat --check` is intentionally side-effect-free: it verifies the repository layout,
Node version, and Corepack availability without installing, building, or starting Electron. When
Corepack is absent it checks only a directly resolvable pnpm 9.x; it never invokes a Corepack pnpm
shim, so the check cannot trigger a package download.
`make-desktop-shortcut.bat` now points to the obvious launcher, sets its working directory, and uses
Electron's executable icon only when that executable exists; the standard shortcut icon is the safe
fallback before dependencies are installed.

## Validation and delivery state

- Focused UI launcher contract test covers quoting, legacy forwarding, verified package-runner fallback
  and executable failure propagation, safe-check routing/caller-directory preservation, and shortcut
  target/icon fallback; its Windows-only smoke cases run `--check` from another working directory and
  use a temporary failing pnpm 9.x fixture without launching Electron.
- Automated validation did not open the GUI, install or download dependencies, access the network, or
  create a desktop shortcut.
- Delivery is through the one-click launcher PR after its required checks pass.

---

# Editable trait rarity handoff — 2026-08-19

## Outcome and scope

In **Design → Layers → traits**, each supported asset now has an **Edit rarity** disclosure for
filename-based rarity. Artists can enter a positive whole-number weight, preview the exact target
filename, and apply it without editing files by hand. The asset is renamed immediately, its drop
odds and representative thumbnail refresh from disk, and `foundry.config.json` remains unchanged.
Uniform-rarity layers explain that the layer must be switched to filename rarity first. JPEG assets
remain hidden because the generator catalog supports PNG, WebP, GIF, and SVG.

The new single-file rename bridge is project-bounded, rejects symlink/traversal escapes, reserves the
exact destination without overwriting or auto-suffixing, and attempts to roll back the destination
if removing the source fails while explicitly reporting any rollback failure. The editor rejects
collisions, unsafe path delimiters, non-integer weights, and
stale operations after a layer/project switch; keyboard focus returns to the renamed trait control.

## Validation and results

- Focused TraitBrowser, Design, and rarity-helper suite: **23/23**.
- Focused project IPC, preload, and IPC-security suites: **30/30**.
- Final combined feature regression: **5 files / 47 tests**.
- Full UI suite: **50 files / 279 tests**; UI typecheck and main-process `build:ts`: pass.
- Production UI build: pass, with only the existing non-fatal chunk/import-meta notices.
- Lint: exit 0 with the same 32 pre-existing warnings.
- Headless QA: 0 findings. Screenshot harness captured the opened
  `design-traits-rarity-editor` state with no failures.
- `git diff --check`: pass.

## Delivery state, risk, and next action

The feature is on `codex/trait-rarity-menu` pending commit, pull request checks, and merge. Automated
tests cover exact collision-safe filesystem behavior and the rendered editor flow, but the owner's
NASAID project has not been used for the final visual/filesystem acceptance check. After merge, open
that imported project, go to **Design → Layers → traits**, change one filename-mode weight, verify the
asset's renamed filename and refreshed odds, then generate a small sample to confirm the intended
distribution.
