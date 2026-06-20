# ConkerNFTZ — Platform Master Plan (A → Z creator platform)

> **⚠ SUPERSEDED (2026-06-20) by [`docs/plan/`](plan/README.md)** — the planning/source-of-truth is
> now `docs/plan/` (VISION · STATUS · PLAN · LOG). This file is kept as history and for the §9
> Vision II detail referenced by `plan/VISION.md`. Don't plan from here.

> **Status: APPROVED DIRECTION (2026-06-18).** Expands ConkerNFTZ from a generative-art
> foundry into a complete, artist-controlled NFT platform: create → deploy → build a mint
> site → host it → run a designed minting experience, all from one tool, no dev skills or
> external services required. This is the long-term plan; individual phases ship green via PR,
> and all fund-handling contract work stays **audit-gated** (see `EVM_LAUNCH_SPEC.md`).

## 1. Vision

An artist goes A → Z without leaving ConkerNFTZ:

1. **Create** the collection (generative foundry — *built*).
2. **Store & deploy** assets + metadata to chain (IPFS/Arweave + multi-chain contracts — *partly built*).
3. **Design the mint experience** — interactive reveals, card-pack "rip-open," custom animations.
4. **Build the mint site** — a no-code, block-based, "Geocities-rich" page builder *inside the app*, with deep defaults + deep customization.
5. **Host it** — one-click deploy of a static mint site to the artist's own host (Vercel/Netlify/IPFS/Pages).
6. **Operate** the live mint — phases, reveal, withdraw, monitoring — non-custodially, fully artist-owned.

## 2. Locked decisions

| # | Decision | Choice |
|---|----------|--------|
| D1 | Product / hosting model | **Open-core**: free/OSS self-host core now; optional managed tier later |
| D2 | Mint mechanics | **Configurable per project**: delayed-reveal *theater* (front-end) **or** *on-chain packs* (VRF) |
| D3 | Mint-site runtime | **Static, host-anywhere** (client React/Vite + wallet + public RPC + IPFS gateway; no backend) |
| D4 | Wallets | Non-custodial **WalletConnect v2**, multi-chain (EVM + Solana); app/site never hold keys |
| D5 | Chains | Base + Ethereum L1 (EVM contracts) **+** Solana (existing Candy Machine) |
| D6 | App shell | The builder lives in the existing **Electron + React** app; generated sites are a separate static build |
| D7 | Contracts | Immutable, audited; standard launch contract first, on-chain packs as a separate heavier module |
| D8 | Builder layout | **Free-form GeoCities canvas** (drag-anywhere absolute placement, z-index, tiled/animated backgrounds, widget zoo) **+ a dedicated mobile editor** with per-element mobile overrides |
| D9 | Builder freedom | Curated widget set **+ a raw-HTML/CSS escape-hatch block** |
| D10 | Packs | Realistic Pokémon/MTG-style booster packs **generated via fal.ai** (preset packs + blank foil base templates); custom packs = **local sharp composite by default + optional fal img2img "enhance"** |
| D11 | Card backs | NFTs gain a **flip side**; **completely configurable** — single shared back, or per-rarity/tier, or arbitrary rules |

### Re-scope (2026-06-18) — "make it really GeoCities, make the packs real"
P1 and P2 are deliberately deepened beyond their foundations:
- **P2 → a true GeoCities builder.** Not stacked sections — a **free-form absolute canvas** (the
  current block model evolves: blocks gain per-breakpoint `layout {x,y,w,h,z}` with a `mobile`
  override; pages gain a canvas size + tiled/animated background). A **widget zoo** (marquee,
  blink, hit counter, guestbook, web ring, "Under Construction"/clipart GIFs, award badges,
  MIDI autoplay, custom comet/star cursors, WordArt-style headings) + a **raw-HTML/CSS block**.
  A **desktop/mobile viewport toggle** in the editor so the artist tunes both. Presets become
  starting points, not the ceiling. Nostalgia-first.
- **P1 → real packs + card backs.** Replace the SVG card mockups with **fal-generated booster
  packs** (foil/holo texture, logo, character art, tear strip): a set of **preset packs** we
  design, plus **blank base packs** (foil + layout + empty art region) the user drops their own
  art onto (local composite default; optional fal enhance). Introduce a **card back** to the
  collection (the flip side), fully configurable (shared / per-rarity / rules). I drive the fal
  generation; owner supervises (needs the owner's fal key, so pack-art generation is a
  collaborative session, while the pack/card-back *infrastructure* is built/tested headlessly).

### UX & Pack overhaul (current priority, 2026-06-18 — before Track A / P5)
The creator-side A→Z loop is verified end-to-end (build → experience → site → preview/host).
Before the on-chain work (P5 wallet + Phase L contract, **deferred**), a focused quality pass:
- **Identity:** *refine* the existing "Field Instrument" look (polish — spacing, density, motion,
  states, consistency), not a new identity.
- **Order:** **U1 Collection-building UI** (Design/Layers/Rules/Preview/Build) → **U2 global
  design-system pass** (tokens/components/motion/states everywhere) → **U3 in-depth Pack &
  reveal experience**.
- **Pack art:** fal-generated printed pack/foil artwork is wanted **first** for U3 — so U3 opens
  with a supervised fal session (owner's key); the procedural shine/structure/motion layers
  around it. U1+U2 are solo-buildable now.
- UI/UX can't be verified headlessly, so each increment ships green and the owner validates the
  look; the in-app **Components** playground is the review surface.

## 3. Architecture & principles

- **Two independent tracks.** The **Platform track** (experience + site builder + host) handles
  no funds and carries no smart-contract risk, so it ships in parallel with the **Contract
  track** (audit-gated). Mint sites can target testnet contracts during development.
- **Everything is data.** The collection, the mint experience, and the site are all serializable
  config (JSON). The in-app preview and the generated static site render from the *same* config
  and the *same* component library — no drift between "what you design" and "what mints."
- **Static + portable.** Generated sites are pure client bundles: wallet connect + public RPC +
  IPFS/Arweave gateway + the contract address/ABI baked in. No server, so any host works and the
  artist owns it outright.
- **Non-custodial everywhere.** Every on-chain action (deploy, set-root, reveal, withdraw, mint)
  is signed by the user's own wallet via WalletConnect v2.
- **Audit is a hard gate.** No fund-handling contract reaches mainnet without an external audit.
- **Open-core.** The whole self-host pipeline is free/OSS; a managed tier (hosted deploy,
  accounts, domains) is an optional later layer, never a requirement.

## 4. Current state (done / in-flight)

- **Foundry** (create): generative engine, layers/rules/rarity/effects, constraint targets,
  palette recolor, SVG layers, preview/build, worker-pool + incremental builds. ✅
- **Storage**: IPFS (Pinata)/Arweave (Irys)/local providers, dir-CID upload. ✅
- **Solana**: Core Candy Machine deploy/mint (allowlist + payment guards). ✅
- **EVM**: simple `ConkernftzCollection.sol` + `ConkernftzLaunch.sol` **spec'd** (audit-gated). 🟡
- **UI**: full React app (Projects→Design→Preview→Build→Publish→AI→Settings→Help), responsive
  (off-process engine), legacy renderer retired. ✅

## 5. Tracks & phases

### Track A — Launch contracts *(audit-gated; see EVM_LAUNCH_SPEC.md)*

- **L1 — Standard launch contract.** `ConkernftzLaunch.sol`: allowlist (per-address maxQty leaf)
  → fixed-price public → delayed reveal; ERC-721A + ERC-2981 + Ownable2Step + ReentrancyGuard +
  Pausable; single multisig treasury. Foundry unit/fuzz/invariant + Slither; testnet-first →
  **external audit** → mainnet. *This is the front contract for the "theater" mint mode (D2).*
- **L2 — On-chain pack & redemption module** *(advanced, later, separately audited).* Sealed
  "pack" tokens that are opened/burned on-chain to redeem underlying NFTs, with **verifiable
  randomness** (Chainlink VRF on EVM / equivalent) and commit-reveal. Powers the *on-chain pack*
  mint mode (D2). Materially larger contract + audit surface — intentionally decoupled from L1 so
  a first launch never waits on it.
- **L-Sol — Solana packs** *(future).* On-chain pack parity on Solana (Metaplex primitives).

### Track B — Platform: experience, site builder, host *(parallel, no fund-risk)*

- **P1 — Mint-experience engine.** A declarative, data-driven system for the minting moment: a
  sequence of stages (pack appears → shake → rip → cards fan → flip → reveal), card-flip reveals,
  confetti, sound, etc. Front-end-first ("theater" over a standard reveal); exposes hooks the
  on-chain pack mode (L2) plugs into later. A library of presets + a no-code editor + in-app
  preview. Shared component library reused by the generated site.
- **P2 — Site builder (no-code).** A block-based visual editor in the app: sections/blocks
  (hero, gallery, roadmap, team, FAQ, mint widget, embeds), a theme system, and a "Geocities-rich"
  expressive component set — strong opinionated defaults *and* deep customization. Output is a
  portable **site config (JSON)**.
- **P3 — Static site generator.** Render (site config + collection + experience + contract
  address/ABI/chain) → a self-contained static React/Vite bundle, including the mint widget
  (phase-aware, wallet-connected) and the P1 experience. Deterministic, previewable, no backend.
- **P4 — Deploy & host.** One-click deploy of the generated bundle to the artist's own host via
  their token/CLI: **Vercel** (default), Netlify, IPFS/Arweave, GitHub Pages. Domain wiring +
  redeploy-on-change. The artist owns the deployment.
- **P5 — Wallet layer (WalletConnect v2).** Shared non-custodial multi-chain connection used by
  *both* the app (contract admin) and the generated site (minting). Underpins P3 minting and the
  Phase L admin UI.
- **P6 — Live ops.** From the app: advance phase, set root, reveal, withdraw, and read-only
  monitoring (mint progress, holders) — all non-custodial. Client-side chain reads only (honors
  the static/no-backend constraint).

### Track C — Managed tier *(deferred; the open-core paid layer)*

- **M1 — Managed hosting & accounts.** Optional hosted deploy, accounts, custom domains, and
  conveniences (e.g. gasless/relayer, analytics). Never required; the self-host path always works.

## 6. Sequencing & dependencies

```
  Foundry/Storage (done) ─► Publish/deploy (L1 testnet) ─► live mint
                                   │
  Track A (contracts, audit-gated):  L1 ──────► (audit) ──────► mainnet
                                       └► L2 on-chain packs (later, separate audit) ──► L-Sol
  Track B (platform, parallel):
        P5 wallet ─┐
        P1 experience ─┬─► P3 site generator ─► P4 deploy/host ─► P6 live ops
        P2 site builder ┘
  Track C: M1 managed tier (last)
```

Recommended order: **P1 → P5 → P2 → P3 → P4 → P6**, with **L1** proceeding in parallel and
gating only the *mainnet* mint (testnet unblocks the whole site/experience flow). **L2** and
**M1** come last. Each phase ships green via PR; the platform track never blocks on the audit.

## 7. Cross-cutting

- **Security/audit:** every fund-handling contract is testnet-first → external audit → mainnet;
  the app/sites are non-custodial; no secrets in generated bundles; deploy tokens stay on the
  artist's machine.
- **Testing:** pure-logic + config round-trip tests (experience/site configs), component tests
  (RTL), generated-site smoke build, contract Foundry suites, deterministic-where-possible.
- **Determinism & portability:** generated sites are reproducible from config; host-agnostic.
- **No drift:** one component library + one config schema power both the in-app preview and the
  shipped site.

## 8. Open questions (resolve as each phase begins)

- Mint-experience schema shape + how far the no-code editor goes vs. preset-only (P1).
- Block/theme catalog scope for v1 of the builder; templates included (P2).
- Deploy auth UX per host (Vercel token vs CLI vs OAuth) (P4).
- L2 randomness source per chain + economic design of packs (VRF cost, pack odds) (L2).
- Managed-tier business model + infra (M1).
- Solana on-chain pack feasibility/primitives (L-Sol).

## 9. Vision II — a more complete NFT internet (endgame · far-future)

> **Status: NORTH STAR / NOT SCHEDULED.** Everything here is the long-term endgame, pursued only
> AFTER the original A→Z vision (Tracks A–C) is complete, owner-verified end-to-end (site + mints
> + chain), and — for anything touching funds or trading — externally audited and verified safe.
> Captured now to steer architecture; none of it is built yet.

**Thesis.** Social media flattened NFTs into profile pictures and timeline posts. They can be far
more if the *internet infrastructure around them* is richer and user-owned. ConkerNFTZ's endgame
is to facilitate that whole "more complete NFT internet" from one A→Z program.

1. **Audience expands: creators *and* collectors.** Beyond artists shipping drops, the
   purchasers/collectors use ConkerNFTZ to build their own spaces — **personal collection-display
   sites** (import the NFTs a wallet owns, arrange them GeoCities-style, host them) and more. The
   same builder + experience engine serves both sides.
2. **Single mint page → full multi-page sites.** The site builder grows from one mint page into
   **complete multi-page sites** (navigation/routing, shared theme, linked pages) so artists can
   fully express a project's world and collectors can build real showcases, not one-pagers.
3. **Flexible deployment: local ↔ cloud ↔ hybrid, phone-capable.** The Electron desktop app is
   *one* way to run ConkerNFTZ, not the only one. The endgame supports running the **whole
   workflow in the cloud**, usable from **just a phone/browser** — the user chooses local, cloud,
   or a mix. Provider integrations (Vercel + storage/RPC/AI/etc.) carry the heavy lifting so the
   customizability and versatility hold regardless of where it runs. *This generalizes D1:*
   "self-host first" stays the open-source core; "fully cloud / phone-only" becomes a first-class
   endgame target, not merely an optional managed tier.
4. **Trading.** Eventually ConkerNFTZ facilitates **NFT trading** between users — non-custodial
   (the user's own wallet signs; ConkerNFTZ never custodies). This is the **furthest-out and most
   security-sensitive** capability: it handles real assets/value and is gated behind the entire
   original vision being complete, audited, and verified safe. Treat it like Phase L, with even
   more diligence.

**Principles that still hold:** no-code but deeply custom; GeoCities-deep expressivity;
non-custodial (wallets sign, keys never custodied); open-core. **Relaxed:** "runs on the user's
machine" becomes "runs wherever the user wants — local, cloud, or hybrid."

**Open questions (for when this track begins):**
- Cloud runtime: managed multi-tenant service vs. a deployable self-host server vs. both;
  accounts/auth; how non-custodial signing works from a phone (WalletConnect on mobile).
- Collector flow: NFT-ownership import per chain (indexers/APIs), multi-wallet, privacy.
- Multi-page builder: routing/nav model and how it maps onto static hosting.
- Trading: mechanism (P2P swap, on-chain order book, marketplace/aggregator integration),
  chains, settlement/escrow, and the audit + regulatory posture — all TBD, far future.
- Identity / social / discovery layer — if any.

---

*This master plan supersedes the renderer-overhaul roadmap (O0–O6, complete) as the forward
plan. `OVERHAUL_PLAN.md` remains the record of the completed overhaul; `EVM_LAUNCH_SPEC.md` is
the detailed spec for L1.*
