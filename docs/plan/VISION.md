# ConkerNFTZ — Vision

> *What we're building and why.* Authoritative. Changes only on a real scope shift (and gets
> logged). Last reconciled with the owner: **2026-06-20** (interview, see [LOG.md](LOG.md)).

## 1. Identity & ownership

- **Random Art Studio** — the owner's company. Two groups sit under it:
  - **ConkerCo** — the group for **NFT programs / software**. **ConkerNFTZ is ConkerCo's product.**
  - **NASA** — a **fictional universe** the owner creates NFT art within.
- **NASA CRUST** — the **first collection released end-to-end with ConkerNFTZ**: the flagship that
  proves the platform (dogfood). The owner makes the art + lore; the software is the engine.

**What ConkerNFTZ is (co-equal, not one or the other):**
1. An **open-source platform** any creator can use to build, launch, and operate an NFT collection.
2. The **engine the owner uses** to launch their own collections (NASA CRUST first).

## 2. Audiences — the full, locked vision

Three roles. All three are part of the *complete* vision (the third arrives last — see roadmap):

1. **Creators** — set up a collection program: generate art, configure mint mechanics, deploy.
2. **Artists** — craft the *experience* and the *site*: the pack-rip reveal, the GeoCities mint page.
3. **Collectors / Curators** — *(committed; sequenced last)* import the NFTs a wallet owns, build
   personal **display / showcase sites**, curate, and eventually **trade** (non-custodial). The
   same builder + experience engine serves them. This is the "Vision II" surface — **definitely
   happening**, after NASA CRUST is launched, verified, and others are using the platform.

## 3. The A→Z lifecycle (one tool, no dev skills required)

A creator goes end-to-end without leaving ConkerNFTZ:

1. **Create** — generative foundry: layers, rules, rarity, effects, palettes, dedupe, build.
2. **Store & deploy** — assets + metadata to IPFS/Arweave; contract to chain (multi-chain).
3. **Design the mint experience** — interactive reveal "theater": pack appears → rip → cards fan
   → flip → reveal. Declarative, previewable, reusable by the shipped site.
4. **Build the mint site** — a no-code, block-based, **free-form GeoCities canvas** page builder
   *inside the app*: drag-anywhere widgets, themes, a nostalgia widget zoo, a raw-HTML escape
   hatch, and a desktop/mobile editor. Output = portable site config (JSON).
5. **Host it** — one-click static deploy to the creator's **own** host (Vercel / Netlify / GitHub
   Pages / IPFS / Arweave) + custom domain. The creator owns the deployment.
6. **Operate the live mint** — deploy, set allowlist root, advance phase, reveal, freeze, withdraw,
   monitor — all **non-custodial**, from inside the app (key file, WalletConnect, or browser
   extension console), or the bundled CLI.

## 4. Design philosophy

- **Non-technical, no-code FIRST.** Every step must be doable with **zero terminal/code**. Support
  for technical users is layered on top, never the baseline. (The recent in-app Launch stage +
  browser signing console exist to remove the CLI from the critical path.)
- **No drift.** The collection, the experience, and the site are all serializable **config (JSON)**.
  The in-app preview and the generated static site render from the **same config + same component
  library** — "what you design" is exactly "what mints."
- **GeoCities-deep expressivity** — strong opinionated defaults *and* deep customization; presets
  are starting points, not ceilings.

## 5. Chains — all equal, none secondary

**Solana · Base · Ethereum L1.** The owner leans Solana, but the rule is firm: **any chain we
support is front-and-center and equally maintained.** No chain is a second-class citizen.
- Today: EVM is furthest along (the `ConkernftzLaunch` contract + the in-app Launch flow). Solana
  has the Candy Machine deploy/mint path but **not yet** the in-app Launch-stage parity — closing
  that is on-chain-infra work for a later phase.

## 6. Business model — open-core

- The **self-hosted, free OSS core** is the focus and must be **fully fleshed out first**.
- A **cloud / managed / hosted tier is locked-in and non-negotiable** (it *will* happen — hosted
  deploy, accounts, custom domains, conveniences) but is **deliberately set aside** until the
  self-host experience is complete. The self-host path must always work without it.

## 7. Principles & guardrails (locked)

- **Static + portable.** Generated sites are pure client bundles (wallet + public RPC + IPFS/Arweave
  gateway + contract address/ABI baked in). No backend; any host works; the creator owns it.
- **Non-custodial everywhere.** Every on-chain action is signed by the user's own wallet; the
  app/sites never hold keys.
- **Audit is a hard gate.** No fund-handling contract reaches mainnet without an external audit +
  economic review. The agent never touches mainnet, keys, or funds — the owner deploys mainnet
  from their own multisig.
- **Owner makes the hero creative** (pack/card art, lore); the agent builds the software that
  consumes it. The fal.ai key stays the owner's (pasted explicitly, rotated after supervised use).
- **Open-core; no secrets in generated bundles; deploy tokens stay on the creator's machine.**
- **Vision-first → owner verifies → polish.** UI/UX can't be fully verified headlessly, so the
  owner validates the look; the agent invests in concrete visual assessment (screenshots).

## 8. Roadmap (sequence — detail in [PLAN.md](PLAN.md))

The thin A→Z slice is proven (owner minted NASA CRUST token #1 on Base-Sepolia). Forward order:

1. **▶ NOW — Full V1 of the ConkerNFTZ program.** Build out the **complete design system + all
   UI/UX across every surface and role**, refine the whole app to a solid, shippable V1. Driven by
   concrete visual assessment (upgraded screenshot tooling). Gate: **owner + agent confirm locally**
   it looks/works/functions exactly right.
2. **On-chain infra to parity + audit-ready** — all chains to first-class Launch parity; harden.
3. **External audit** + final hardening.
4. **Launch V1 with NASA CRUST** — real, mainnet, owner's multisig.
5. **Vision II** — collectors/curators, multi-page sites, non-custodial trading — after CRUST is
   launched, verified good, and others have started using the platform.

> Vision II detail (collector flows, multi-page routing on static hosts, cloud/phone runtime,
> trading mechanism + regulatory posture) is captured in
> [`PLATFORM_MASTER_PLAN.md` §9](../PLATFORM_MASTER_PLAN.md) as the far-future record.
