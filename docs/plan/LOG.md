# ConkerNFTZ — Decision & Request Log

> Append-only record of owner directives + key decisions. **Newest first.** Each entry: date,
> what was decided/requested, and the effect. The "what the owner said, and when" source of truth.

---

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
