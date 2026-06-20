# ConkerNFTZ — Plan (task board)

> *What's next.* Tasks have stable IDs so we can refer to them. Status: ☐ todo · ◐ in progress ·
> ☑ done. **Now** is the active focus; **Next/Later/Icebox** are ordered but not started. Updated
> as work lands; tied to [STATUS.md](STATUS.md) and [LOG.md](LOG.md).

---

## ▶ NOW — V1 of the full ConkerNFTZ program

**Goal:** a solid, shippable **V1** of the whole app — a **complete design system applied across
every surface and role**, refined until it looks great, works great, and functions exactly how the
owner wants. **Driven by concrete visual assessment** (the agent must *see* the pixels, not just
pass unit tests). **Gate:** owner + agent **confirm locally**, screen by screen. Executed as a
self-running goal/loop. *(Owner: "by far the most important.")*

| ID | Task | Status |
|----|------|--------|
| **V1-0** | **Upgrade the visual-assessment system** — make the screenshot harness capture every screen/state reliably and render them for concrete per-screen critique. **Prerequisite** for everything below. | ☐ |
| V1-1 | Design-system foundation: reconcile `DESIGN_SYSTEM.md`, lock the **token layer** (color, type scale, spacing, radius, elevation, **motion**, density) and the theming model. | ☐ |
| V1-2 | Component primitives pass: Button / Panel / Field·Input·Select / Badge / Dialog / Tabs / Toast / Lamp / EmptyState / Skeleton — consistency, all interaction **states**, accessibility. | ☐ |
| V1-3 | App shell polish: header, pipeline nav, status bar, instrument-console layout, transitions. | ☐ |
| V1-4 | Screen pass — **Projects** | ☐ |
| V1-5 | Screen pass — **Design** (densest; needs the most UX work) | ☐ |
| V1-6 | Screen pass — **Preview** | ☐ |
| V1-7 | Screen pass — **Build** | ☐ |
| V1-8 | Screen pass — **Publish** | ☐ |
| V1-9 | Screen pass — **Mint FX (Experience)** | ☐ |
| V1-10 | Screen pass — **Site builder** (widgets + inspector UX) | ☐ |
| V1-11 | Screen pass — **Launch** | ☐ |
| V1-12 | Screen pass — **Packs** | ☐ |
| V1-13 | Screen pass — **Fal AI** | ☐ |
| V1-14 | Screen pass — **Settings / Help** | ☐ |
| V1-15 | End-to-end **flow coherence**: the A→Z journey feels like one product (empty states, loading, errors, hand-offs between stages). | ☐ |
| V1-16 | **Owner ↔ agent local confirmation** gate: walk every surface, confirm look/feel/function. | ☐ |

---

## NEXT — On-chain infra to parity + audit-ready

| ID | Task | Status |
|----|------|--------|
| OC-1 | **Solana Launch-stage parity** — bring Solana to the same in-app deploy/manage experience as EVM (chains all equal). | ☐ |
| OC-2 | Reveal flow UX — full upload-metadata → reveal → freeze path, in-app. | ☐ |
| OC-3 | Rarity → live token-tier mapping in the mint widget (real mint data). | ☐ |
| OC-4 | **Audit handoff package** — assemble the contract + spec + threat model + test suite + gas notes + assumptions for an external auditor to start cold. | ☐ |
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

---

## Backlog (small, unscheduled)

- Hit-counter / guestbook needing a backend store (out of scope for static sites).
- Curated first-party clipart/badge pack (owner art).
- `packsRead` server-side thumbnails for large pack libraries.
- Offer to switch `ci.yml` to `workflow_dispatch`-only (owner has no CI budget) — pending owner OK.
