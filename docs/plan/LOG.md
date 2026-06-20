# ConkerNFTZ — Decision & Request Log

> Append-only record of owner directives + key decisions. **Newest first.** Each entry: date,
> what was decided/requested, and the effect. The "what the owner said, and when" source of truth.

---

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
