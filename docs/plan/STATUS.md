# ConkerNFTZ — Status

> *Where we are, component by component.* Updated as work lands. Legend: ✅ done · 🟡 partial ·
> ⏳ planned · 🧊 icebox. Supersedes `KNOWN_GAPS.md`. Last full pass: **2026-06-20**.

## You are here

The **thin A→Z slice is proven end-to-end**: generate → site → deploy contract → mint, with the
owner having minted **NASA CRUST token #1 on Base-Sepolia** through the real widget. The on-chain
track (contract + adapter + CLI + in-app Launch with 3 signer modes) is functionally complete and
merged to `main`. **The next phase is the full V1 program build — design system + all UI/UX** (see
[PLAN.md](PLAN.md)). **No CI budget** → everything below is verified **locally** (typecheck / build
/ vitest / preload drift); a red ❌ on GitHub is billing, not code.

## Packages (engine & libraries)

| Package | State | Notes |
|---------|-------|-------|
| `core` | ✅ | **Trait-based generative** engine: layers, rules, rarity, effects, palette recolor, SVG layers, constraint targets, worker-pool + incremental builds, dedupe. Project-config schema (`ProjectConfigSchema`, incl. `chain.evm.launch`). ~12 test files. *(Forward: depth to be massively expanded; broadening to all art types — 1/1s, code-based generative — is Vision II, V2-5.)* |
| `storage` | ✅ | Providers: Pinata (IPFS), Irys (Arweave), local; `uploadDirectory → {baseUri,cid,files}`. ~3 test files. |
| `cli` | ✅ | `conkernftz` commands: init/validate/preview/build/dupes/audit/upload/mint/deploy/candy + **`launch <deploy\|allowlist\|status\|prices\|caps\|phase\|reveal\|withdraw\|freeze>`** with the mainnet safeguard. ~3 test files. |
| `chain-evm` | ✅ | viem-based. `ConkernftzCollection.sol` + **`ConkernftzLaunch.sol`** (ERC-721A phased mint, CI-verified earlier: 34/34 forge + Slither). `merkle.ts`, `mintPlan.ts`, `deploy/sale/chains`, `allowlistFile.ts`. 81 tests. |
| `chain-solana` | 🟡 | Candy Machine deploy/mint (allowlist + payment guards) works. **No in-app Launch-stage parity yet** (EVM-only so far). ~2 test files. |
| `ui` | ✅/🟡 | Electron + React app (the platform). Functionally complete for the A→Z loop; **design/UX polish is the V1 priority.** 43 test files (199 tests). |

## UI surfaces (Electron app) — functional state + V1-design readiness

Pipeline stages: **Projects → Design → Preview → Build → Publish → Mint FX → Site → Launch**.
Utility: **Packs · Fal AI · Settings · Help · Components (playground)**. Shell = "Field Instrument"
look (instrument-console layout, pipeline nav, status bar).

| Screen | Function | V1 design polish |
|--------|----------|------------------|
| Projects | ✅ open/scaffold/select a project | ⏳ design pass |
| Design | ✅ layers, rules, rarity, image, patterns | ⏳ (dense; needs the most UX love) |
| Preview | ✅ live random previews | ⏳ design pass |
| Build | ✅ images + local JSON, progress | ⏳ design pass |
| Publish | ✅ upload assets, rewrite URIs | ⏳ design pass |
| Mint FX (Experience) | ✅ pack-rip reveal (4-phase, layered pocket art, per-rarity backs); auto-loads card faces | 🟡 strong; refine states/motion |
| Site | ✅ GeoCities canvas builder (drag/resize/rotate/multi-select, undo/redo, snap, widget zoo, per-block text style + scale, 5-host deploy, local preview, **`Mint contract` panel**) | 🟡 deep; tighten widgets + inspector UX |
| Launch | ✅ deploy + sale mgmt (status/caps/prices/phase/reveal/freeze/withdraw/allowlist); **3 signer modes** (key file · WalletConnect · browser console) | ⏳ functional, needs design pass |
| Packs | ✅ app-level pack/card-back library (built-in CONKERCO + imported) | ⏳ design pass |
| Fal AI | 🟡 fal catalog/generation (owner's key) | ⏳ |
| Settings / Help | ✅ | ⏳ |
| Components | ✅ in-app design-system playground (review surface) | — (this is the tool we use) |

## On-chain (Phase L)

| Item | State | Notes |
|------|-------|-------|
| Launch contract `ConkernftzLaunch` | ✅ CI-verified | ERC-721A allowlist→public→reveal; Ownable2Step + ReentrancyGuard + Pausable + ERC-2981. **Audit-gated before mainnet.** |
| Merkle allowlist (`merkle.ts`) | ✅ | OZ StandardMerkleTree; JS↔Sol leaf cross-check (threat T13). |
| Off-chain adapter + CLI | ✅ | deploy/estimate/sale ops + chain presets + mainnet safeguard. |
| Mint widget (exported site) | ✅ testnet-proven | Injected wallet; `planMint`/`buildMintCall`; builds clean into the buyer bundle (no `node:fs`). |
| In-app Launch (EVM) | ✅ | key-file IPC + WalletConnect + browser console; all reuse `launchSign`/the adapter. |
| **Solana Launch parity** | ⏳ | Candy Machine exists; needs in-app Launch-stage parity (chains-all-equal). |
| Reveal metadata flow | 🟡 | `reveal`/`freeze` wired; the full upload→reveal UX is thin. |
| Rarity → live tier mapping in the widget | 🟡 | preview simulates one rare; live token→tier mapping waits on mint data. |

## Verification posture

- ✅ Local gates green: typecheck, full build (renderer + site + console bundles), vitest (199 UI +
  chain-evm 81 + cli 12 + core/…), preload drift test.
- ✅ The contract was CI-verified (34/34 forge + Slither) while quota existed — that result stands.
- ✅/🟡 **Visual assessment upgraded (V1-0, ◐ pending owner nod)** — `packages/ui/scripts/screenshots.mjs`
  (playwright-core → system Chrome/Edge headless, mocked `window.foundry`) now captures **45** shots:
  every stage incl. **Launch** (not-deployed + deployed), key in-screen states, a full **light-theme**
  pass, and a **compact-viewport** pass — and emits `screenshots/manifest.json` + a browsable
  **`screenshots/index.html`** contact sheet with a per-shot critique note. Run:
  `pnpm -C packages/ui build:renderer-next && pnpm -C packages/ui screenshots`. This is the review
  surface for the screen-by-screen V1 passes (V1-1…V1-15).
- 🟡 **No CI budget** (owner) → never rely on CI; local is the signal.

## Outstanding owner-verification items

- ⏳ Live **WalletConnect** connect+sign (needs the owner's wallet on testnet — projectId added).
- ⏳ Live **browser signing console** with the MetaMask extension.
- (Both are runtime paths the agent built + bundle-verified but cannot drive itself.)

## Known smaller gaps (carried)

- Hit-counter / guestbook widgets that need a backend store (out of scope for static sites).
- A curated first-party clipart/badge pack (owner art).
- `packsRead` ships full images over IPC for thumbnails (fine for a few; could add server thumbnails).
