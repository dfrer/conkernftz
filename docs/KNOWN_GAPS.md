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
| Mint experience | Rip animation | Done (U3.6) | Four-phase deterministic reveal: **grab-and-pull** the sealed pack (click/Enter also work) → a short **tear beat** (sealed pack shakes/pops as the torn-open art fades in) → cards sit **stacked inside** the open pack → **click the pack** and the cards **spill out, fan on top**, while the pack recedes + blurs into the background. Uses an optional `<packId>-open` library variant (bundled for CONKERCO); packs without one fall back to a direct reveal. Feel/timing (tear 420ms, spill stagger 80ms, fan 6°/card, pull 120px) is owner-tunable. |
| Mint experience | Pack art | Done (U3.2) | App-level pack **library** (built-in CONKERCO default + user-imported packs in Electron userData; **Packs** stage). Mint FX picks a pack **by id**; the project config stores only the small `packId`; the image is resolved to a data URL for the preview and embedded at site export. (Lean config — the earlier data-URL-in-config bloat is gone. Owner makes the art — [[owner-makes-the-art]].) Minor: `packsRead` ships the full image over IPC for thumbnails — fine for a handful, could add server-side thumbnails for a large library. |
| Mint experience | Card backs | Partial | Default back selectable from the library by id (`backId`); **per-rarity backs** now supported (`rarityBacks`: tier→back id, Mint FX ▸ Pack & card art ▸ Rarity backs). Gap: the **live** mapping of a minted card → its tier (from rarity rank / token metadata) waits on mint data — the preview simulates one rare card. |
| Mint site (generated) | Static site template + export | Done (P3.0/P3.1) | Template builds (`dist/site-template`); the Site stage "Generate site" button writes a self-contained deployable folder (`<project>/site-export`). |
| Mint site (generated) | Host / deploy | Partial | P4 — **Vercel only** (via `npx vercel deploy --prod` + the user's token; needs Node/npx). Netlify, IPFS (could reuse the storage providers), GitHub Pages, and custom-domain wiring are not built yet. First `npx vercel` run is slow (fetches the CLI). |
| Mint site (generated) | Live minting | Pending | The mint widget in the generated site is preview-only. Live on-chain minting needs P5 (WalletConnect) + the Phase L contract (audit-gated). |

> Tracker memory: [[build-process-and-gaps]]. See also `PLATFORM_MASTER_PLAN.md` for the planned
> phases that close several of these (P1 packs, P3 site export, P4 deploy, P5 wallet).
