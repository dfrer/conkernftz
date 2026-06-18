# Known gaps — intentionally-incomplete features

A running ledger of features that shipped **deliberately partial** during the vision-first
build phase. These are *fine for now* (per the agreed process: build the full A→Z vision →
owner verifies the whole workflow → then a dedicated polish pass). This list keeps that polish
pass complete and honest. When a feature ships partial, add a row here in the same PR.

Legend: **Stub** = placeholder/decorative · **Partial** = works but limited · **Pending** = not built yet.

| Area | Feature | State | What's missing / to finish |
|------|---------|-------|----------------------------|
| Site builder | **Web ring** widget | Stub | Decorative text only (prev / random / next are not links). Needs configurable ring URLs + a real prev/next/random target set. |
| Site builder | **88×31 button** | Partial | Single text label + href. No badge image/upload, no preset badge gallery. |
| Site builder | **Hit counter** | Stub | Static number. A real visit counter needs a backend/service (the site is static) — wire to a counter service or omit at deploy. |
| Site builder | **Image / GIF** widget | Partial | URL field only — no in-app asset upload/picker or clipart library. |
| Site builder | Clipart / nostalgia zoo | Pending | Guestbook, comet/star cursor trails, MIDI autoplay, "best viewed in…" badges, animated clipart library — not built yet. |
| Site builder | Canvas ergonomics | Partial | Drag-move + corner-resize only. No multi-select, snapping/guides, group, undo/redo, or rotation. |
| Mint experience | Pack art | Stub | Packs are CSS/SVG mockups, not the realistic fal-generated Pokémon/MTG booster packs (P1 re-scope). Needs the supervised fal session + blank-base-pack compositing. |
| Mint experience | Card backs | Pending | The configurable NFT "flip side" (shared / per-rarity / rules) is designed but not built. |
| Mint site (generated) | Static site template | Partial | P3.0 — the standalone template builds (`dist/site-template`) and renders a `site-data` bundle (shared `SiteRenderer`/`MintExperience`). The in-app "Generate site → folder" export (main-process file write + button) and one-click host are the next step (P3.1 / P4). |
| Mint site (generated) | Live minting | Pending | The mint widget in the generated site is preview-only. Live on-chain minting needs P5 (WalletConnect) + the Phase L contract (audit-gated). |

> Tracker memory: [[build-process-and-gaps]]. See also `PLATFORM_MASTER_PLAN.md` for the planned
> phases that close several of these (P1 packs, P3 site export, P4 deploy, P5 wallet).
