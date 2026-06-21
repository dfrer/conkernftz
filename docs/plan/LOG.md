# ConkerNFTZ — Decision & Request Log

> Append-only record of owner directives + key decisions. **Newest first.** Each entry: date,
> what was decided/requested, and the effect. The "what the owner said, and when" source of truth.

---

### 2026-06-20 — QA-1c/1d/1e: finish the per-surface sweep (every editor driven)
Drove the remaining controls to completion, all returning **0 findings**:
- **RulesEditor** (QA-1c): add-cap + edit + **invalid-JSON → error banner** (unhappy path).
- **Site canvas** (QA-1d): apply template, add widget (block count +1 + auto-select asserted), select.
- **EffectsEditor** (QA-1e): blend/offset/rotate; Glow group toggle reveals/hides its body + color fill;
  Modulate toggle. **OverridesEditor**: add/set/remove. **RenamerPanel** + **SpawnEditor** selects +
  save. **Fal AI** form (key/model/prompt — never Generate; that's a real fal.run call). **Reduced
  motion**: `emulateMedia` + asserted the nav-item transition collapses to ~0.
Three more **driver-selector artifacts** found + fixed along the way (not app bugs): an fx-editor
toggle left open by a prior step (force a remount), and two loose `getByLabel` matches (`Theme`,
`Model`) → `{exact:true}`. Net: every drivable surface×function is exercised; the only un-driven bits
are drag-placement (spawn dots, canvas move/resize) and the owner-only real-env items —
[QA-REAL-ENV-CHECKLIST.md](QA-REAL-ENV-CHECKLIST.md). Driver 0 findings; gates green.

### 2026-06-20 — QA-1b: cross-cutting (light/compact) + a11y; fix Dialog focus trap
Added driver passes for **light theme** + **compact viewport** (walk stages + a key interaction; no
runtime errors) and a **keyboard/a11y** pass (tablist arrow nav; dialog focus trap; Escape-close).
Two findings:
- *Tablist ArrowRight "didn't move selection"* → **driver artifact**: the `Tabs` use automatic
  activation, but the test focused the first tab while a different tab was selected; fixed to focus
  the selected tab.
- *Dialog doesn't trap focus* → **real a11y bug**, fixed. The `Dialog` had `role=dialog` +
  `aria-modal` + Escape but **no focus management** — focus never entered the modal and Tab escaped to
  the background. Added a proper trap: on open, remember the trigger + move focus into the dialog;
  wrap Tab/Shift+Tab at the boundaries; restore focus to the trigger on close. (onClose read via a ref
  so the trap sets up once per open, not per render.) Affects every dialog (Projects "New collection",
  Components, …). The driver now asserts the trap every run.
Re-run: **driver 0 findings**. Verified: typecheck clean · 203/203 vitest (Dialog "renders body when
open" still passes) · renderer build clean.

### 2026-06-20 — OC-4: audit handoff package assembled
Continuing the NEXT board autonomously. Skipped **OC-3** for now — it embeds a genuine
rarity-tiering **product decision** (how a token's rank maps to "Rare"/"Legendary") that's the
owner's to set, and its live half runs in the unverifiable buyer mint runtime; flagged for a quick
owner decision later. Took **OC-4** instead (fully ownable + verifiable, no devnet/decision): wrote
**`docs/AUDIT_HANDOFF.md`** — an auditor's-front-door package for `ConkernftzLaunch.sol`:
scope/out-of-scope, **exact `forge build/test/coverage/snapshot` + Slither repro commands** (incl.
the no-local-forge/no-CI-budget reality → the auditor's run is the authoritative gate), architecture
+ full external surface (functions/events/state, the Merkle leaf format), trust model, the 4 forge
invariants mapped to the spec's 8 (+ which unit/fuzz tests cover #4–#8), the **T1–T13** threat model,
the **30 unit/fuzz + 4 invariant** test suite (incl. the JS↔Sol proof cross-check for T13), the 7
open decisions with shipped defaults, and assumptions/gating. Verified the references it cites
(`compile-contract` script, `remappings.txt`, the 11.9 KB/EIP-170 note). Docs-only (no build impact);
finalize against the **freeze commit (OC-5)**.

### 2026-06-20 — OC-2 (EVM) finished + merged: reveal UX (auto-fill + stepper + Go-to-Publish)
Closed out the EVM reveal flow and merged `feat/oc2-reveal-ux` → `main`. Final finishing touch:
when the reveal step has no uploaded metadata, the panel now offers a **"Go to Publish →"** button
(navigation threaded into `LaunchScreen` via `onNavigate`), so the guided upload→reveal→freeze flow
is clickable end-to-end. The harness mock's `readFile` honors `failMethods` so the no-upload state is
drivable; the QA driver asserts the affordance appears and navigates to Publish. Full pre-merge gate:
typecheck · full build · UI 203/203 · workspace tests (chain-solana merkle test flaked under the
concurrent run — passes 17/17 in isolation, pre-existing, not OC-2) · screenshots · QA driver 0
findings. **Solana reveal (hidden-settings) split out as OC-2b** — deferred for the same
devnet-unverifiable reason as OC-1b. So **OC-2's verifiable EVM scope is complete.**

### 2026-06-20 — OC-2 (start): EVM reveal UX — auto-fill baseURI from the upload manifest
Owner skipped OC-1b (Phantom unverifiable-by-agent) → took OC-2 (next in-order, fully driver-
verifiable). The EVM Launch "Reveal & metadata" panel made you hand-paste the revealed baseURI;
now `LaunchScreen` reads `${outDir}/.upload-manifest.json` and **auto-fills the baseURI** (+ a "Use
uploaded baseURI" button), with clear status: *revealed* / *uploaded metadata detected — pre-filled* /
*no upload yet → Publish first*. Manifest read is best-effort (try/catch) so a missing/unreadable
manifest never breaks `refresh` (fixed a console error the LaunchScreen test surfaced from the new
read). Verified: typecheck · full build · 203/203 UI tests (clean, no console error) · screenshots
52/52 (new `launch-reveal-panel`) · QA driver **0 findings** (+ asserts the baseURI auto-fills).
On-chain reveal itself stays owner/devnet-verified.
**+ Guided stepper:** added an **upload → reveal → freeze** progress indicator above the controls that
reflects live state (✓ done / amber active / pending; "Freeze · optional"), so the operator sees the
whole flow at a glance. Verified: typecheck · 203/203 UI tests · full build · screenshots · QA driver
**0 findings** (asserts the stepper marks the upload step done). On branch `feat/oc2-reveal-ux`.

### 2026-06-20 — OC-1: Solana Launch parity — slices 1+2 (status + create + insert, key-file)
Owner: "continue onto OC-1." Branch `feat/oc1-solana-launch`. Owner scoped the first slice to the
**core deploy path** (status + create + insert + UI), **key-file signer first** + Phantom
wallet-adapter to follow (slice 3).
- **Slice 1 (chain-solana):** `readCandyMachineState()` — the Solana analog of EVM's `readSaleState`
  — with a pure, unit-tested `mapCandyMachineAccount()` (items available/loaded/redeemed →
  fullyLoaded/soldOut). Schema: `chain.solana.candyMachine.{address,collectionAddress}` (populated
  after create, mirroring `chain.evm.launch.contractAddress`). 17 chain-solana tests (+5).
- **Slice 2 (in-app):** `launch-runner-solana.ts` IPC handlers (`solanaLaunchStatus`/`solanaCreate`/
  `solanaInsertItems`) mirroring the CLI `candy` flow (read `_metadata.json` count + `.upload-manifest`
  URIs; persist to config + `candy-machine.json`; **mainnet-beta confirm-token gate**, key-file
  signer). Wired into `main.ts`; added to the IPC contract (`FoundryApi`+`FOUNDRY_METHODS`), both
  preloads, and the renderer bridge. **`LaunchScreen` now dispatches by `chain.target`** — new
  `LaunchSolana` screen (status / signing / create / insert) for Solana, EVM unchanged.
Verified locally: UI typecheck clean · **full build clean · 203/203 UI tests incl. preload drift** ·
screenshots 51/51 (new `launch-solana` + `launch-solana-created`, both render chain-equal) · QA
driver **0 findings** (new Solana Launch step). Chain ops are devnet-unverified by the agent → owner
runs the [real-env checklist](QA-REAL-ENV-CHECKLIST.md) (Solana create/upload/mint on devnet).

### 2026-06-20 — ✅ QA sweep merged to `main` (owner-authorized)
Owner: "push and merge." Merged `fix/app-wide-qa` → `main` (`1e80e30`, 8 commits): the
interaction+verification driver + shared harness, full per-surface coverage (0 driver findings),
real engine/CLI verification, and the 2 fixes (validate wallet hard-error → WARN; Dialog focus trap).
Pushed branch + `main`. Gates green at merge: typecheck · full build · 368/368 workspace tests ·
driver 0 findings. (CI ❌ = billing.) `pnpm -C packages/ui qa` is now a standing regression gate.
**Active focus → NEXT board (OC-1 Solana Launch parity).** Owner-side QA remainder = the real-env
checklist + drag/visual/motion judgment.

### 2026-06-20 — QA-2: real engine/CLI end-to-end + fix `validate` wallet hard-error
Drove the **real** pipeline (not the mock) on a throwaway temp project: `conkernftz init` →
`validate` → `build --count 8 --seed 42` → `dupes` → `audit`. Generated real 256² layer PNGs via
`sharp` (10 traits across 4 layers). Results: build produced **8 correct editions** — images +
per-edition metadata (attributes, **sha256 DNA**, rarity score+rank) + `rarity.json` /
`rarity-ranks.json` / `_metadata.json`; **`dupes`** found none; **`audit`** correctly flagged the
fully-transparent layer as near-empty. The full-workspace suite is green (**368 tests**: core 47,
chain-evm 81, chain-solana 12, cli 12, storage 13, ui 203).

**Bug found + fixed:** `conkernftz validate` (whose job is "config + assets presence", and which
`init` literally tells you to run next) **hard-ERRORed (exit 1) on a missing Solana wallet keypair**
— a mint-time-only credential — blocking a no-code creator from validating their art before any
wallet setup. Downgraded the wallet checks to **WARN** (`validate.ts`); a fresh `init` now validates
to `Config OK` (exit 0) with a heads-up. Verified: cli typecheck clean · 12/12 cli tests. (Windows
path-interop note for future runs: Git Bash `/tmp` ≠ Node `/tmp`; use a shared path like
`C:/Users/<u>/… ↔ /c/Users/<u>/…`.)

### 2026-06-20 — QA-0: app-wide QA driver (tooling) + clean baseline
Owner kicked off a new self-running goal: **comprehensive A→Z functional + visual QA sweep** — drive
every surface/control/flow to completion, verify it, fix every problem. Built the gating tooling on
branch `fix/app-wide-qa`:
- **Extracted** the shared headless-harness primitives (static server, mocked `window.foundry`,
  system-browser launch, stage list) into `packages/ui/scripts/lib/harness.mjs`; refactored
  `screenshots.mjs` to import them (still 49/49 shots). The mock gained an **`opts.failMethods`** hook
  so action calls can return errors on demand (unhappy-path testing).
- **Built `scripts/qa-driver.mjs`** (`pnpm -C packages/ui qa`): drives controls, WAITS for each op,
  captures **console errors/warnings + pageerror + requestfailed** attributed per surface, **asserts**
  outcomes (state updated / element appeared / value applied), injects mock failures, and emits
  `screenshots/qa-report.{md,json}`. Exits non-zero on any FAIL so it gates the loop.
- First run flagged 1 issue → diagnosed as a **driver artifact** (a loose `getByLabel('Theme')` also
  matched the header's "Toggle color theme" button); fixed with `{exact:true}`. **Re-run: 0 findings**
  (0 console errors / 0 page errors / 0 failed requests / all assertions pass) across every stage +
  happy AND unhappy (injected build/upload/preview failures) flows — V1 shipped clean.
Coverage tracked in `docs/plan/QA-COVERAGE.md`. Gates green: typecheck · full build · 203/203 vitest ·
49/49 screenshots · driver 0 fails. ◐ — QA-1+ deepens coverage control-by-control.

### 2026-06-20 — ✅ V1-16: owner confirmed — V1 COMPLETE, merged to `main`
Owner reviewed the build and signed off: **"Everything looks good to go for the V1-16, you can
commit/push/merge."** That closes the V1 gate. Flipped V1-0…V1-16 to ☑ in PLAN, marked STATUS
complete, and **merged `feat/v1-design` → `main`** (17 commits: visual-assessment harness; token +
first-class-light foundation; primitive states + Components catalog; app-shell polish; all 12 screen
passes; flow-coherence; Design-density deepen). Pushed branch + `main`. (CI will show red ❌ —
**billing, not code**; all gates were verified locally: typecheck · full build · 203/203 vitest ·
preload-contract drift · screenshots 49/49.) **Next focus → the NEXT board (OC-1: Solana Launch
parity).** Owner-accepted follow-ups carried, not blockers: a live **Site builder** widget/inspector
UX session; revisit **Mint FX reveal motion** + **light-theme palette** as taste items.

### 2026-06-20 — V1-5 deepen: Design Layers-table density/legibility
Went back to the screen flagged as needing the most UX work. The 9-column Layers rows had **no
inter-row separation, padding, or hover** — only the fx-selected row got a thin inset bar — so
tracking one layer across all 9 columns was hard. Added per-row padding (breathing room), a quiet
**hover highlight** (`surface-2` + hairline) so the row under the cursor is trackable, and made the
**active (fx-selected) row** clearly highlighted (`accent-soft` + amber border + the inset bar) so it
visibly ties to the "Effects — <layer>" panel below. Header row keeps its underline + column
alignment. Verified via the `design-layers-panel` close-up (rows now breathe) · typecheck clean ·
203/203 vitest · renderer build clean · screenshots 49/49. Still pending owner live-review; deeper
Design ideas (e.g. action-column grouping) remain candidates for the V1-16 walkthrough.

### 2026-06-20 — V1-15: flow coherence (loading affordance unified)
Coherence has been accruing across the whole effort (token layer, themed checkboxes, the numbered
stage-kicker series, the "NFT Art Foundry" naming fixes). This pass closed the **loading affordance**:
adopted the Button `loading` prop on the last ad-hoc text-swap buttons — Projects "Choose folder &
create", the Renamer "Apply (N)", and the Spawn-map save. Audited the whole renderer: **every button
busy-state now uses the `loading` primitive** (spinner + `aria-busy` + auto-disable); the only
remaining inline "Loading…" is a Design empty-state *hint*, which is correct (not a button). Net: one
consistent loading language A→Z. Other coherence checks held — every screen uses StageHeader + Panel +
`stack/stagger`, every empty/idle view uses EmptyState, both themes are first-class. Verified: typecheck
clean · 203/203 vitest · renderer build clean. ◐ pending owner live-review; remaining deep item is the
Site builder widget/inspector UX (V1-10), to be done live.

### 2026-06-20 — V1-12/13/14: utility screens (Packs · Fal AI · Settings/Help)
The utility screens were mostly solid; focused passes:
- **Packs (V1-12):** made the import busy-state **per-section** (`busy: PackKind`) so only the section
  being added shows the spinner (was a shared boolean that greyed both). Library grid + built-in/custom
  badges + delete were already clean.
- **Fal AI (V1-13):** adopted Button `loading` on Generate (already had skeleton output loading).
- **Settings (V1-14):** already clean (Appearance theme/accent, provider-aware Storage, target-aware
  Chain, Project folder shortcuts) — no change.
- **Help (V1-14):** real **content** fixes — the field manual was missing the **Launch** stage entirely,
  had Publish/Mint FX out of pipeline order, and omitted **Packs**; reordered to match the nav and added
  both. Aligned the About copy from the old "creator toolkit for layer-based generative art" to
  "**an NFT art foundry** for building and launching collections" (matches the VISION reframe + the
  header tagline). Verified: typecheck clean · 203/203 vitest (incl. help tests) · renderer build clean ·
  screenshots 49/49. ◐ pending owner live-review.

### 2026-06-20 — V1-11: Launch screen pass
Launch (status readout · signing modes — key-file / WalletConnect / browser console · deploy ·
sale setup · allowlist · reveal · proceeds) is functional; this pass tightened consistency. The
kicker (→ `STAGE 07 // DEPLOYMENT`) and the off-palette danger color landed in earlier commits; now
adopted Button `loading` **per on-chain action** (Connect wallet, Sign-in-browser console, Preflight,
Deploy, Build & set root, Withdraw) so the in-flight transaction shows a spinner — important when an
on-chain write is pending and you need to know which op is running. Verified: typecheck clean ·
203/203 vitest (incl. the 4 LaunchScreen tests) · renderer build clean · screenshots 49/49. ◐ pending
owner live-review.

### 2026-06-20 — V1-10: Site builder pass (loading adoption; deep UX flagged)
Adopted Button `loading` on the Site action buttons (Use live art · Generate site · Preview locally ·
Deploy to <host>). **Deferred the deep work:** the Site builder is the most complex screen (~860 lines:
free-form canvas, drag/resize/rotate widgets, the widget zoo, the inspector, multi-host deploy). STATUS
flags "tighten widgets + inspector UX" — that's genuinely interactive design work that needs the owner
**live** (can't safely restructure the canvas builder from static frames), so it's carried as the top
remaining design item, to be done as a focused owner+agent session rather than blind edits. Verified:
typecheck clean · 203/203 vitest · renderer build clean. ◐ — loading done; widget/inspector UX pending
a live session.

### 2026-06-20 — V1-9: Mint FX (Experience) pass + stage-kicker consistency
Experience screen (preset/kind/cards/duration/label/accent, shake/auto-flip, pack+back pickers with
real art thumbnails, rarity-back rules, live reveal preview with Replay) is rich and well-organized;
its reveal **motion** lives in the `MintExperience` player and can only be judged live (static frames
can't show timing/easing) — flagged for owner review. Static pass: adopted Button `loading` on "Use
live art".
**Plus a cross-screen consistency fix:** the StageHeader kickers were a numbered ops series
(`STAGE 00 // INTAKE` … `04 // DISPATCH`) but three pipeline screens broke it — Experience
(`STAGE // MINT FX`), Site (`STAGE // MINT SITE`), Launch (`DEPLOY`). Renumbered them into the series:
**05 // REVEAL · 06 // STOREFRONT · 07 // DEPLOYMENT** (Site/Launch get their own deeper passes at
V1-10/V1-11; this just closes the kicker gap now). Verified: typecheck clean · 203/203 vitest ·
renderer build clean · screenshots 49/49. ◐ pending owner live-review (esp. the reveal motion).

### 2026-06-20 — V1-8: Publish screen pass
Publish was already well-structured (readiness badge strip = build/metadata/uploaded state,
provider/mode upload, chain-aware mint panel — EVM deploy+owner-mint vs Solana direct/candy —, CLI
console). Pass: adopted the Button `loading` prop **per-action** (Upload, Deploy, Owner mint, Mint,
Candy create/upload/mint) so the *running* action shows a spinner — previously all buttons just
greyed out together with no indication of which was executing. Real clarity win on a multi-action
panel. Verified: typecheck clean · 203/203 vitest · renderer build clean. ◐ pending owner live-review.

### 2026-06-20 — V1-7: Build screen pass
Build was already strong (progress bar with pause/resume/stop, output-edition gallery + lightbox,
rarity-report histogram, asset/output audit, idle/no-project/done states with badges). Light pass:
adopted the Button `loading` prop on **Build collection** and **Reload** (spinner + auto-disable),
dropping the ad-hoc "Building…/Loading…" text swaps. Verified: typecheck clean · 203/203 vitest ·
renderer build clean. ◐ pending owner live-review.

### 2026-06-20 — V1-6: Preview screen pass
Preview was already strong (skeleton loading, idle/no-project empty states, seed chip, inspection
lightbox, clean thumb grid in both themes), so a light, honest pass: adopted the new Button
`loading` prop on **Generate previews** (spinner + auto-disable) instead of the ad-hoc
`busy ? 'Generating…'` text swap — the first real adoption of the V1-2 loading primitive in a screen.
Noted ~20 other ad-hoc busy-text buttons across screens; rather than one cross-cutting commit, each
will adopt `loading` in context during its own V1 pass (keeping the informative label, e.g.
"Deploying…"). Verified: typecheck clean · 203/203 vitest · renderer build clean. ◐ pending owner
live-review.

### 2026-06-20 — V1-5: Design screen pass (start) — themed form controls
First pass on the densest screen. The 9-column Layers table is dense-but-functional and holds up
even at the compact viewport (checked via `compact-design`), so no structural overhaul — the
clearest, highest-leverage fix was a **system-wide consistency** one: the **REQ checkbox rendered as
the raw OS-default blue**, clashing with the amber instrument theme (and checkboxes recur in Rules /
Overrides / Effects). Added global themed `input[type=checkbox|radio]` styling (`accent-color:
var(--accent)` in both themes, instrument focus ring, disabled dimming) and a checkbox/radio row in
the **Components** catalog so the control is part of the source of truth. Verified: typecheck clean ·
203/203 vitest · renderer build clean · screenshots 49/49; confirmed the Layers checkboxes now read
amber. ◐ — Design may warrant further density passes later, but the jarring inconsistency is gone.

### 2026-06-20 — V1-4: Projects screen pass
First per-screen pass. Captured the previously-unseen **populated** recents state (seeded the
harness's `cnftz:recents` localStorage → new `projects-populated` shot) and refined both states:
- **Empty state is now the page hero** — on first run, the EmptyState renders directly ("Start your
  first collection") instead of being wrapped in a redundant "Recent dossiers / 0 ON FILE" panel.
- **Card paths truncate** to a single line with ellipsis (+ `title` tooltip) instead of `break-all`
  wrapping — cleaner card rhythm.
Verified: typecheck clean · 203/203 vitest · renderer build clean · screenshots 49/49. ◐ pending
owner live-review.

### 2026-06-20 — V1-3: app-shell polish (header + harness shell crops)
Shell was already solid (instrument-console grid, indexed pipeline nav with lamps, status-bar
readouts), so this is focused polish — no redesign:
- **Fixed the stale tagline:** header sub "Generative Art Foundry" → **"NFT Art Foundry"** (matches
  the VISION reframe; the only two refs were the header + its smoke test).
- **Active-project readout chip:** the loaded project now renders as a bordered instrument chip with
  a status lamp (`.header-project`) instead of dim body text — clearer top-of-window hierarchy.
- **Harness:** added legible shell-chrome close-ups (`shell-header` / `shell-nav` / `shell-statusbar`)
  so the chrome being polished is reviewable at real size (now 48 captures).
Verified: typecheck clean · 203/203 vitest · renderer build clean · screenshots 48/48. Confirmed via
the new close-ups that the loaded-state chip shows "● DEMO COLLECTION". ◐ pending owner live-review.

### 2026-06-20 — V1-2: component primitives — fill the missing states
Filled the real interaction-state gaps in the primitives and turned the **Components** playground
into a complete catalog (the owner's live review surface for the system). Additive, non-breaking:
- **Button** gains `loading` — spinner (inherits `currentColor`, so every variant is covered),
  `aria-busy`, auto-disable.
- **Badge** gains `danger` / `info` / `warn` tones (the TS type previously stopped at `ok`, though
  the doc already promised danger); now maps to the existing status tokens in both themes.
- **Field** gains `hint` / `error` captions; **Input/Select** gain `invalid` → `aria-invalid` with a
  danger border, plus proper `:disabled` dimming.
- **Playground** rewritten to show every primitive × every state (variants, small+icon, disabled,
  loading, focus note, badge tones, lamp off→alert, field hint/error/disabled, empty with action).
Verified locally: **typecheck clean · 203/203 vitest** (+4 new: button-busy, badge tone, field
error/hint) **· renderer build clean · screenshots 45/45** (catalog reads correctly in dark + light).
`docs/DESIGN_SYSTEM.md` component table updated. ◐ pending owner live-review.

### 2026-06-20 — V1 cadence locked (owner) + V1-1 token foundation
**Owner direction** (at the V1-0→V1-1 boundary): (1) **review surface = the live app**, not the
screenshot contact sheet (keep screenshots for the agent's own assessment; owner judges in the
running Electron app + Components playground); (2) **light + dark are both fully first-class**
(equal polish); (3) **cadence = proceed in order autonomously V1-1…V1-15, owner jumps in** (don't
pause for an OK each screen). Saved to `memory/v1-design-working-prefs.md`.

**V1-1 — design-system token foundation.** Reconciled + locked the token layer: `styles/tokens.css`
and `docs/DESIGN_SYSTEM.md` agree; token **names/scale unchanged** (stable contract for the
component/screen passes). Made the **light theme first-class** — it was washed (every surface tone
within ~6% lightness of `--bg`, so panels/buttons/hairlines flattened). Rebuilt light as a
paper-stack with real value separation (deeper manila desk `--bg`, brighter paper `--surface`,
widened `--surface-2/3` steps, recessed `--surface-inset`, stronger `--line`/`--line-strong` and a
more-legible `--text-dim`), using the **same rising-elevation model as dark** so components stay
theme-agnostic. Tokenized the only genuine app-chrome violations (`LaunchScreen`: off-palette
`#ff6b6b` → `var(--danger)`; a `rgba(255,255,255,0.08)` border that was **invisible in light** →
`var(--line)`). Verified locally: **typecheck clean · full build clean (renderer+site+console) ·
199/199 vitest incl. preload-contract drift · screenshots 45/45**. Dark left untouched (already
reads well). ◐ pending owner live-review.

### 2026-06-20 — V1-0: visual-assessment harness upgraded (gates the V1 design work)
Kicked off the **V1 program build** on branch `feat/v1-design`. First task **V1-0** — the
prerequisite tooling so the agent can *see* every screen, not just pass unit tests. Rebuilt
`packages/ui/scripts/screenshots.mjs` from a flat script into a declarative capture system:
- **Completeness:** added the **Launch** stage (previously skipped entirely) in both
  **not-deployed** and **deployed** states (mock now serves `launchStatus`/`launchEstimate`/launch
  ops); 45 total captures across every pipeline + utility stage and the key in-screen states.
- **Themes + density:** a full **light-theme** pass (the token layer must hold in both) and a
  **compact-viewport (1180px)** pass to expose density/overflow.
- **Reliability:** navigation now waits on the *active* nav state (not blind timeouts); each shot is
  isolated in try/catch and recorded pass/fail.
- **Reviewability:** emits `screenshots/manifest.json` + a browsable **`screenshots/index.html`**
  contact sheet — every shot grouped, with theme/viewport chips and a per-screen **critique note**.
Verified locally: harness runs **45/45, 0 failed**; UI **typecheck clean**; **199/199 vitest**.
Status ◐ — pending owner confirmation that the contact sheet is the review surface they want, then
on to **V1-1** (token foundation). (Screenshots dir is gitignored; only the script is committed.)

### 2026-06-20 — Scope: "NFT *Art* Foundry" (all art types) + living plan
Owner clarified the plan is **living** — features and the depth of existing features will keep
expanding; taken all the way, the platform has *many* more features than listed today. Key
reframe: **not "Generative Art Foundry" → "NFT Art Foundry."** The final vision serves **all art
types**, not just trait-based generative:
- **Today (deepening):** trait-based generative ("hashlips"-style) — depth/customizability to be
  massively expanded (ongoing track).
- **Vision II (committed):** broaden to **1/1s**, **code-based generative** (p5.js, fxHash-style),
  and more — so any artist can launch + sell via ConkerNFTZ; plus **more chains**.
Folded into VISION (identity + new "Art types" section), PLAN (V2-5 art types, V2-6 more chains,
ongoing-themes note), STATUS (core forward note).

### 2026-06-20 — Establish the `docs/plan/` planning system
Owner: "completely rewrite/rebase the planning and spec… a managed planning system… centralized
source of truth about where we are, what tasks, and what I'm requesting." Created `docs/plan/`
(README · VISION · STATUS · PLAN · LOG); consolidate-and-supersede the scattered docs (master plan,
known-gaps). Owner confirmed structure (lean, `docs/plan/`) and the consolidated spec as "basically
fully correct." Agent memory becomes a thin pointer to this directory.

### 2026-06-20 — Spec locked (interview)
- **Identity (1c):** ConkerNFTZ is co-equally an open-source platform for any creator **and** the
  owner's engine for their own collections.
- **Org:** Random Art Studio (company) → **ConkerCo** (NFT software group; ConkerNFTZ is its
  product) + **NASA** (fictional art universe). **NASA CRUST** = first collection shipped fully via
  ConkerNFTZ (flagship dogfood).
- **Audiences (full vision, locked):** creators · artists · **collectors/curators** (the last
  sequenced after CRUST launch + others using the platform — but committed).
- **Design:** **non-technical / no-code FIRST**, with support for technical users.
- **Business:** open-core; **self-host free core first** (fully fleshed out); **cloud/managed tier
  is locked-in & non-negotiable but set aside** until self-host is complete.
- **Chains:** Solana · Base · Ethereum L1 — **all equal, none secondary** (owner leans Solana).
- **Launch intent:** testnet-proven now; **real audited mainnet launch is the eventual goal**,
  gated on audit + owner's explicit go.
- **Next priority (by far #1):** build the **full V1 program** — complete **design system + all
  UI/UX across every surface**, refined to a shippable V1, driven by **concrete visual assessment**
  (upgrade the screenshot tooling), run as a **`/goal` loop**, gated on **owner+agent local
  confirmation**. Then on-chain parity + audit-ready → audit → **launch NASA CRUST** → **Vision II**.

### 2026-06-20 — Merge the on-chain track to `main`
Merged PR #96 (17 commits) into `main` (`4ad3029`): `ConkernftzLaunch` contract + adapter + CLI +
non-custodial mint widget + in-app Launch stage (deploy/manage, 3 signer modes).

### 2026-06-20 — No GitHub Actions budget
Owner is out of CI minutes and won't pay. A red ❌ on GitHub = billing, not code. **Verify locally
only** (typecheck/build/vitest/drift). New *contract* changes lose the forge/Slither gate (no local
forge either) — flag that they need an owner-run check. See `memory/no-github-actions-budget.md`.

### 2026-06-20 — Testnet A→Z proven + browser signing console
Owner minted **NASA CRUST token #1 on Base-Sepolia** through the real widget. Then, to retire the
CLI for creators: built the in-app **Launch** stage and three signer modes — **key file**,
**WalletConnect** (mobile), and a **browser signing console** (for the desktop MetaMask extension,
which an Electron app can't reach directly).
