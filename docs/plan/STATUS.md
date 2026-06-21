# ConkerNFTZ — Status

> *Where we are, component by component.* Updated as work lands. Legend: ✅ done · 🟡 partial ·
> ⏳ planned · 🧊 icebox. Supersedes `KNOWN_GAPS.md`. Last full pass: **2026-06-20**.

## You are here

The **thin A→Z slice is proven end-to-end**: generate → site → deploy contract → mint, with the
owner having minted **NASA CRUST token #1 on Base-Sepolia** through the real widget. The on-chain
track (contract + adapter + CLI + in-app Launch with 3 signer modes) is functionally complete and
merged to `main`. **No CI budget** → everything is verified **locally** (typecheck / build / vitest /
preload drift); a red ❌ on GitHub is billing, not code.

**✅ V1 design build COMPLETE — owner-confirmed (2026-06-20) and merged to `main`.** V1-0…V1-16 done
(17 commits via `feat/v1-design`): visual-assessment harness rebuilt; token layer locked + **light
theme made first-class**; primitive interaction states filled + full Components catalog; app-shell
polish; **per-screen passes for all stages**; a flow-coherence pass (one consistent loading language,
numbered stage-kickers, "NFT Art Foundry" naming); and a Design Layers-table density deepen. The owner
walked the build and signed off; V1-16 (the explicit gate) is passed.

**✅ App-wide QA sweep complete + merged to `main`** (2026-06-20, owner-authorized). Built a standing
**interaction+verification driver** (`pnpm -C packages/ui qa`) and drove **every drivable surface ×
function to 0 findings** (all stages + all Design editors + Site canvas + Launch flows + light/compact
+ keyboard-a11y + reduced-motion + unhappy paths); verified the **real engine/CLI** end-to-end (8-edition
build + metadata + DNA + rarity, dupes, audit). **2 real bugs fixed:** `validate` wallet hard-error →
WARN; `Dialog` missing focus-trap → added. Reports: [QA-SUMMARY.md](QA-SUMMARY.md) ·
[QA-COVERAGE.md](QA-COVERAGE.md) · owner real-env checklist [QA-REAL-ENV-CHECKLIST.md](QA-REAL-ENV-CHECKLIST.md).

**▶ Active focus now: the NEXT board — on-chain infra to parity (OC-1 Solana Launch parity first).**
Owner-side QA remainder (not blockers): run the real-env checklist; drag/visual + Mint-FX motion +
light-theme palette are owner-judged. Owner-accepted V1 follow-up: the **Site builder** widget/inspector
UX live session.

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
| Projects | ✅ open/scaffold/select a project | ◐ V1-4: empty-state hero + card-path truncation |
| Design | ✅ layers, rules, rarity, image, patterns | ◐ V1-5: themed form controls; **deeper table-density work still open** |
| Preview | ✅ live random previews | ◐ V1-6: loading affordance (already strong) |
| Build | ✅ images + local JSON, progress | ◐ V1-7: loading affordance (already strong) |
| Publish | ✅ upload assets, rewrite URIs | ◐ V1-8: per-action loading |
| Mint FX (Experience) | ✅ pack-rip reveal (4-phase, layered pocket art, per-rarity backs); auto-loads card faces | ◐ V1-9: loading + kicker; **reveal motion needs live review** |
| Site | ✅ GeoCities canvas builder (drag/resize/rotate/multi-select, undo/redo, snap, widget zoo, per-block text style + scale, 5-host deploy, local preview, **`Mint contract` panel**) | ◐ V1-10: loading + kicker; **widget/inspector UX deferred to a live session** |
| Launch | ✅ deploy + sale mgmt (status/caps/prices/phase/reveal/freeze/withdraw/allowlist); **3 signer modes** (key file · WalletConnect · browser console) | ◐ V1-11: kicker + tokenized danger + per-action loading |
| Packs | ✅ app-level pack/card-back library (built-in CONKERCO + imported) | ◐ V1-12: per-section loading (already clean) |
| Fal AI | 🟡 fal catalog/generation (owner's key) | ◐ V1-13: loading affordance |
| Settings / Help | ✅ | ◐ V1-14: Help manual reorder + Launch/Packs added + "NFT Art Foundry" copy; Settings clean |
| Components | ✅ in-app design-system playground (review surface) | ✅ V1-2: full primitive×state catalog (the review surface) |

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
