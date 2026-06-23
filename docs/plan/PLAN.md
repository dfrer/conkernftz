# ConkerNFTZ — Plan (task board)

> *What's next.* Tasks have stable IDs so we can refer to them. Status: ☐ todo · ◐ in progress ·
> ☑ done. **Now** is the active focus; **Next/Later/Icebox** are ordered but not started. Updated
> as work lands; tied to [STATUS.md](STATUS.md) and [LOG.md](LOG.md).

---

## 📥 INBOX — un-triaged ideas (lands here first, then sorted)

*Raw ideas/direction drops go here immediately so nothing is lost, then get moved into
Now/Next/Later/Icebox with an ID. Empty = all caught up.*

- *(nothing pending)*

---

## ✅ DONE — V1 of the full ConkerNFTZ program *(owner-confirmed 2026-06-20; merged to `main`)*

**Goal:** a solid, shippable **V1** of the whole app — a **complete design system applied across
every surface and role**, refined until it looks great, works great, and functions exactly how the
owner wants. **Driven by concrete visual assessment** (the agent must *see* the pixels, not just
pass unit tests). **Gate:** owner + agent **confirm locally**, screen by screen. Executed as a
self-running goal/loop. *(Owner: "by far the most important.")*

> **✅ V1 COMPLETE.** Owner walked the build and signed off ("everything looks good to go for V1-16")
> on 2026-06-20; the `feat/v1-design` branch (17 commits — harness, token/light-theme foundation,
> primitive states + catalog, shell, all 12 screen passes, flow-coherence + Design-density deepen)
> merged to `main`. **▶ The active focus now moves to the NEXT board — on-chain infra to parity.**
> Carried follow-ups (not V1 blockers, owner-accepted): the **Site builder** widget/inspector UX
> deserves a focused live session, and the **Mint FX reveal motion** + **light-theme palette** are
> owner-taste items to revisit anytime.

| ID | Task | Status |
|----|------|--------|
| **V1-0** | **Upgrade the visual-assessment system** — make the screenshot harness capture every screen/state reliably and render them for concrete per-screen critique. **Prerequisite** for everything below. | ☑ |
| V1-1 | Design-system foundation: reconcile `DESIGN_SYSTEM.md`, lock the **token layer** (color, type scale, spacing, radius, elevation, **motion**, density) and the theming model. | ☑ |
| V1-2 | Component primitives pass: Button / Panel / Field·Input·Select / Badge / Dialog / Tabs / Toast / Lamp / EmptyState / Skeleton — consistency, all interaction **states**, accessibility. | ☑ |
| V1-3 | App shell polish: header, pipeline nav, status bar, instrument-console layout, transitions. | ☑ |
| V1-4 | Screen pass — **Projects** | ☑ |
| V1-5 | Screen pass — **Design** (densest; needs the most UX work) | ☑ |
| V1-6 | Screen pass — **Preview** | ☑ |
| V1-7 | Screen pass — **Build** | ☑ |
| V1-8 | Screen pass — **Publish** | ☑ |
| V1-9 | Screen pass — **Mint FX (Experience)** | ☑ |
| V1-10 | Screen pass — **Site builder** (widgets + inspector UX) | ☑ |
| V1-11 | Screen pass — **Launch** | ☑ |
| V1-12 | Screen pass — **Packs** | ☑ |
| V1-13 | Screen pass — **Fal AI** | ☑ |
| V1-14 | Screen pass — **Settings / Help** | ☑ |
| V1-15 | End-to-end **flow coherence**: the A→Z journey feels like one product (empty states, loading, errors, hand-offs between stages). | ☑ |
| V1-16 | **Owner ↔ agent local confirmation** gate: walk every surface, confirm look/feel/function. | ☑ |

> All ☑ = owner-confirmed (2026-06-20) and merged to `main`. Full per-task detail is in
> [LOG.md](LOG.md) (newest-first, V1-0 → V1-16). The visual-assessment harness
> (`pnpm -C packages/ui screenshots` → `screenshots/index.html`) stays the standing tool for any
> future design work.

---

## ▶ NOW — App-wide QA hardening sweep

**Goal:** drive every surface, control, and flow to completion; verify each did what it should + looks
right; FIX every problem. Nothing is "tested" until triggered, waited-out, and verified. Coverage is
tracked in [QA-COVERAGE.md](QA-COVERAGE.md); per-run evidence in `screenshots/qa-report.md` (gitignored).

| ID | Task | Status |
|----|------|--------|
| **QA-0** | **Interaction+verification driver** (`scripts/qa-driver.mjs`, `pnpm -C packages/ui qa`): drives controls, WAITS for completion, captures console/page/network errors per surface, asserts outcomes, injects mock failures, emits `qa-report.{md,json}`. Shared harness in `scripts/lib/harness.mjs`. | ☑ |
| QA-1 | Deep per-surface sweep — every control, both themes, focus + a11y. **Done for everything drivable headlessly**; drag-placement + visual = owner. | ◐ |
| QA-2 | Real-engine pass — `@conkernftz/core` build/dedupe/rarity + the `conkernftz` CLI on a temp project; verified ACTUAL outputs (8 editions). | ☑ |
| QA-3 | Fix every problem found; re-verify. **2 fixed** (validate wallet; Dialog focus trap); ongoing as any new surface. | ◐ |
| QA-FINAL | Real-environment checklist for the owner ([QA-REAL-ENV-CHECKLIST.md](QA-REAL-ENV-CHECKLIST.md)) — owner runs it. Consolidated report: [QA-SUMMARY.md](QA-SUMMARY.md). | ◐ |

> **Status:** driver run is **0 findings** across all stages + Design (tabs/row-controls/rules+invalid-JSON)
> + Projects/Preview/Build/Publish/Mint-FX + Site (template/canvas widgets) + Launch (deploy/sale/
> confirm-gated) + light + compact + keyboard-a11y + injected unhappy paths. Real engine/CLI verified
> (8-edition build, dupes, audit). **2 real bugs found + fixed:** `validate` wallet hard-error → WARN;
> `Dialog` missing focus-trap → added. Remaining QA-1 TODO (driver-untested, coming back clean as
> driven): EffectsEditor/Overrides/Spawn/Renamer controls, Site drag/inspector/undo-redo, Fal params.

---

## NEXT — On-chain infra to parity + audit-ready

| ID | Task | Status |
|----|------|--------|
| OC-1 | **Solana Launch-stage parity** — in-app Candy Machine status + create + insert (key-file), chain-equal to EVM. **Merged.** Owner verifies on devnet. | ◐ |
| OC-1b | **Phantom (browser) signing** for Solana Launch — non-custodial create/insert via the desktop extension (browser console) or WalletConnect/mobile. Deferred until OC-1 key-file is devnet-proven (Electron can't reach the extension; CM-create is multi-tx). | ☐ |
| OC-2 | **Reveal flow UX (EVM) — done + merged.** Auto-fills the baseURI from the upload manifest, a guided **upload → reveal → freeze stepper** with live state, and a **"Go to Publish"** action closing the no-code loop. On-chain reveal/freeze = owner's devnet check. | ☑ |
| OC-2b | **Solana reveal** (Candy Machine hidden-settings) — deferred (same devnet-unverifiable-by-agent constraint as OC-1b; sequence after Solana create/insert is devnet-proven). | ☐ |
| OC-3 | **Rarity → tier mapping — core done.** Pure `tierForRank` (rarest-first cumulative shares, default 5%, configurable per tier) + `buildTierMap`; Mint FX preview now showcases real tiers (not a one-off sim) + a no-code "Share %" input. | ◐ |
| OC-3b | **Live token-tier in the mint widget — merged.** Pure receipt parser (`mintedTokenIds`) + `tiersForTokens` (12 tests); edition→tier `tierMap` embedded in the exported site; `MintLive` waits for the receipt → tiers → the mint block replays the reveal with the minted rarity backs. Only the real on-chain mint receipt is the owner's devnet check. | ◐ |
| OC-4 | **Audit handoff package** — [`docs/AUDIT_HANDOFF.md`](../AUDIT_HANDOFF.md): scope, exact build/test/Slither repro commands, architecture + surface, trust model, invariants (+ which forge tests cover them), T1–T13, the 30+4 test suite, open decisions, assumptions. Finalize at the freeze commit (OC-5). | ◐ |
| OC-5 | Re-run the Foundry suite + Slither when CI/forge is available again (owner-run); freeze the contract for audit. | ☐ |

---

## LATER — Launch V1 with NASA CRUST

| ID | Task | Status |
|----|------|--------|
| LAUNCH-1 | External audit + economic review (HARD GATE before mainnet). | ☐ |
| LAUNCH-2 | Address audit findings; re-test; transfer ownership to multisig. | ☐ |
| LAUNCH-3 | Owner deploys NASA CRUST to mainnet from their own multisig; full real mint experience. | ☐ |
| LAUNCH-4 | Open the platform to other creators. | ☐ |

---

## ICEBOX — Vision II (committed, sequenced after CRUST launch)

| ID | Task | Status |
|----|------|--------|
| V2-1 | Collector/curator flows: import a wallet's NFTs (per-chain indexers), build display sites. | 🧊 |
| V2-2 | Single mint page → full **multi-page sites** (nav/routing on static hosts). | 🧊 |
| V2-3 | **Cloud/managed tier** (the open-core paid layer): hosted deploy, accounts, domains, phone-capable. *(Locked-in, non-negotiable — set aside until self-host is fully fleshed out.)* | 🧊 |
| V2-4 | Non-custodial **trading** between users (furthest-out, most security-sensitive; audit + regulatory posture). | 🧊 |
| V2-5 | **All art types** — generalize launch/contract/site so any artist can sell: **1/1s**, **code-based generative** (p5.js, fxHash-style long-form/on-chain), and more, beyond trait-based. (The "NFT *Art* Foundry" reframe — see VISION.) | 🧊 |
| V2-6 | **More chains** beyond Solana / Base / Ethereum L1. | 🧊 |

## Ongoing expansion themes (owner-driven, not date-gated)

- **Deepen the trait-based generative foundry** — massively expand depth, customizability, and
  breadth of the existing layers/rules/rarity/effects system. Runs alongside other tracks.
- **The feature set keeps growing** — expect this board to expand substantially as the owner adds
  features and deepens existing ones (logged in LOG, slotted into Now/Next/Later/Icebox).

---

## Backlog (small, unscheduled)

- Hit-counter / guestbook needing a backend store (out of scope for static sites).
- Curated first-party clipart/badge pack (owner art).
- `packsRead` server-side thumbnails for large pack libraries.
- Offer to switch `ci.yml` to `workflow_dispatch`-only (owner has no CI budget) — pending owner OK.
