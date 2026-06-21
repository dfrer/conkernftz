# ConkerNFTZ — Audit Handoff Package (`ConkernftzLaunch`)

> **Purpose:** everything an external auditor needs to start cold on the EVM launch contract —
> scope, exact build/repro commands, architecture, trust model, invariants, threat model, the test
> suite, and the open decisions to settle. This is the auditor's front door; the full specification
> + threat model is [`docs/EVM_LAUNCH_SPEC.md`](EVM_LAUNCH_SPEC.md) (source of truth — the code
> follows it).
>
> **Status:** testnet-first, **audit-gated** — *no mainnet deploy until this contract is frozen and a
> professional audit + economic review is complete* (`EVM_LAUNCH_SPEC.md` §8). This package is
> assembled now so the audit can start as soon as the owner freezes the contract (PLAN **OC-5**).

---

## 1. Scope

| | |
|---|---|
| **In scope (audit this)** | `packages/chain-evm/contracts/ConkernftzLaunch.sol` (232 lines) — the phased-mint launch contract. |
| **Adjacent (review for the JS↔Sol boundary)** | `packages/chain-evm/src/merkle.ts` (allowlist Merkle tree/proofs) — the off-chain side of threat **T13**; a Foundry test feeds a JS-generated proof to the on-chain verifier. |
| **Context only (not the audit target)** | `ConkernftzCollection.sol` (the simpler owner-mint collection, already shipped); the viem off-chain adapter (`src/sale.ts`, `deploy.ts`); the in-app Launch UI. |
| **Out of scope / non-goals** | on-chain randomness, upgradeable proxy, on-chain metadata/SVG, marketplace logic, ERC-1155, cross-chain bridging, secondary-sale enforcement beyond ERC-2981 signaling, the Solana Candy Machine path. |
| **Chains** | Base + Ethereum L1 (testnet on Base-Sepolia + Sepolia first). |
| **Audit target commit** | the commit the owner **freezes** for audit (OC-5). The contract is unchanged since the Phase-L implementation; verify `git log -- packages/chain-evm/contracts/ConkernftzLaunch.sol` shows no edits after the freeze tag. This package was assembled at `main` ≈ `4864018`. |

## 2. Build, test & reproduce (exact commands)

The repo is a pnpm monorepo; the contract's deps (ERC721A, OpenZeppelin) resolve from
`node_modules` via `remappings.txt`. **Foundry is the test/audit toolchain only** — the runtime
deploys from committed TS artifacts (`src/launch-artifact.ts`), so the app never needs forge.

```bash
# from packages/chain-evm/
pnpm install                              # resolve erc721a + @openzeppelin into node_modules
forge install foundry-rs/forge-std        # forge-std into lib/ (CI does this)

forge build                               # solc 0.8.31, optimizer runs=200 (see foundry.toml)
forge test -vvv                           # 30 unit/fuzz + 4 invariant tests
forge coverage                            # aim 100% lines/branches on the contract
forge snapshot                            # gas: mint(1) / mint(5) / mint(maxPerTx)

# static analysis (CI uses build-info so Slither needs no recompile)
slither . --config-file slither.config.json
```

**Toolchain versions (pin these):** `solc 0.8.31` (pragma `^0.8.20`); optimizer **on, 200 runs**;
fuzz **256 runs**; invariant **256 runs × depth 32**, `fail_on_revert = false` (the handler asserts
reverts explicitly). Slither config excludes deps/tests/lib and does **not** exclude
informational/low (`slither.config.json`).

> **Note on prior verification:** the suite (**34/34 forge** + **Slither clean**) was green in CI
> when contract-CI quota existed. The owner's machine has **no local forge and no CI budget**, so
> these are **not re-run on every change** — **the auditor's own `forge test` + Slither run is the
> authoritative on-chain gate.** OC-5 re-runs them on a clean environment immediately before freeze.

## 3. Architecture

`ConkernftzLaunch` is a fixed-supply, **immutable (non-upgradeable)** ERC-721A art mint with a
three-phase sale. Base primitives are all audited libraries; there is **no custom cryptography**.

```
contract ConkernftzLaunch is ERC721A, ERC2981, Ownable2Step, ReentrancyGuard, Pausable
  pragma ^0.8.20 (built with solc 0.8.31) · 1-indexed token ids · ~11.9 KB (within EIP-170)
```

| Imports | |
|---|---|
| `erc721a/contracts/ERC721A.sol` | gas-efficient batch mint |
| `@openzeppelin/.../ERC2981.sol` | secondary-royalty signaling |
| `@openzeppelin/.../Ownable2Step.sol` | two-step ownership handoff to the multisig |
| `@openzeppelin/.../ReentrancyGuard.sol` | on every state-changing mint/withdraw |
| `@openzeppelin/.../Pausable.sol` | emergency stop for mints |
| `@openzeppelin/.../cryptography/MerkleProof.sol` | allowlist proof verification |

**Phases:** `enum Phase { Closed, Allowlist, Public }` (starts `Closed`).

**External surface:**

- **Mint** (`whenNotPaused`, `nonReentrant`, CEI ordering):
  `allowlistMint(qty, allowedQty, proof)`, `publicMint(qty)`, `ownerMint(to, qty)` (onlyOwner, no payment).
- **Admin** (`onlyOwner`): `setPhase`, `setPrices`, `setCaps`, `setAllowlistRoot`, `setTreasury`,
  `setDefaultRoyalty`, `reveal(baseURI)`, `freezeMetadata()` (one-way), `withdraw()` (pull to
  treasury, success-checked `call`), `pause()`/`unpause()`. Prices/caps/root **lock when the phase
  advances to Public** (`test_ConfigLocksOnPublic`).
- **Views:** `tokenURI` (placeholder until `revealed`, then `<revealedBaseURI><id>.json`),
  `totalMinted()`, `supportsInterface`.
- **Events:** `PhaseChanged`, `PricesSet`, `CapsSet`, `AllowlistRootSet`, `TreasurySet`,
  `Revealed`, `MetadataFrozen`, `Withdrawn`.
- **Fair-mint:** `bytes32 immutable provenanceHash` set at construction.

**Allowlist leaf (security-critical — §3 / §9 of the spec):** OpenZeppelin
`StandardMerkleTree.of(entries, ['address','uint256'])` where the uint256 is the per-address
`maxQty`; the contract recomputes `leaf = keccak256(bytes.concat(keccak256(abi.encode(msg.sender,
allowedQty))))` and enforces `allowlistMinted[msg.sender] + qty <= allowedQty` (the cap travels in
the proof). Double-hashed, sorted-pair — resistant to second-preimage / forged proofs.

## 4. Trust model

| Actor | Trust | Capabilities |
|---|---|---|
| **Owner** (deployer → **multisig** treasury) | trusted, minimized | phase, prices/caps, allowlist root, reveal, freeze, withdraw, ownerMint, pause |
| Allowlisted minter | untrusted | `allowlistMint` within their proof cap, Allowlist phase |
| Public minter | untrusted | `publicMint` within per-wallet cap, Public phase |
| Attacker | hostile | any external call, reentrancy, front-running, proof forgery, mis-payment, griefing |

**Operational requirement (documented for the runbook):** on mainnet the owner **must** be a
multisig (e.g. Safe), never an EOA holding proceeds. `Ownable2Step` makes the handoff deliberate.

## 5. Invariants

The spec (`EVM_LAUNCH_SPEC.md` §4) lists **8** target invariants. Four are enforced as handler-based
forge invariants (`test/ConkernftzLaunch.invariant.t.sol`, 256 runs × depth 32, `fail_on_revert=false`):

| Forge invariant fn | Covers spec invariant |
|---|---|
| `invariant_SupplyWithinMax` | #1 `totalMinted() <= maxSupply` |
| `invariant_AccountingSum` | #2 `Σ allowlistMinted + Σ publicMinted + ownerMinted == totalMinted()` |
| `invariant_OwnerMintedTracks` | #2 (owner-minted component) |
| `invariant_FundsConservation` | #3 balance == Σ(paid) − Σ(withdrawn); nothing stuck/extractable |

The remaining spec invariants are covered by the **unit/fuzz** suite (§7), not as standalone forge
invariants — **confirm this coverage during the audit**: #4 no mint while `Closed`/`paused`
(`…RevertWrongPhase`, `test_Pause_BlocksMint`), #5 per-wallet caps (`…EnforcesPerAddressCap`,
`…RevertOverWalletCap`, fuzz), #6 payment exactness (`testFuzz_*_ExactValue*`), #7 frozen-metadata
immutability (`test_FreezeMetadata_BlocksReveal`), #8 only `treasury` receives proceeds
(`test_Withdraw_PullsToTreasury`). *Promoting #4–#8 to explicit forge invariants is a reasonable
auditor recommendation.*

## 6. Threat model (full table in `EVM_LAUNCH_SPEC.md` §5)

T1 reentrancy · T2 allowlist over-mint/replay · T3 forged Merkle proof · T4 wrong payment ·
T5 supply overrun · T6 phase/price misconfig · T7 withdraw access/theft · T8 metadata rug/unfair
reveal · T9 griefing via huge qty · T10 front-running phase open (accepted, fair-launch) ·
T11 owner-key compromise (multisig + Ownable2Step + pause) · T12 integer overflow (0.8 checked +
Slither) · **T13 JS↔Sol leaf-format drift** (single shared `merkle.ts`; a Foundry test builds the
proof in JS and asserts the contract accepts it). Each row lists its mitigation + how it's verified.

## 7. Test suite (`test/ConkernftzLaunch.t.sol` — 30 + invariants — 4)

Happy-path + every revert, fuzz, and the cross-impl proof. Notable cases:

- **Allowlist:** `…AcceptsJsGeneratedProof` (T13 cross-impl), `…EnforcesPerAddressCap`,
  `…RevertWrongPhase`, `…RevertForgedAllowedQty`, `…RevertProofReuseByOther`, `…RevertWrongValue`,
  `…RevertBadQty`; `testFuzz_AllowlistMint_WithinCap`.
- **Public:** `…Happy`, `…RevertWrongPhase`, `…RevertOverWalletCap`, `…RevertWrongValue`;
  `testFuzz_PublicMint_ExactValueOnly`.
- **Owner mint / supply:** `test_OwnerMint*`, `testFuzz_OwnerMint_NeverExceedsSupply`.
- **Config lock:** `test_ConfigLocksOnPublic`. **Reveal/freeze:** `test_RevealAndTokenURI`,
  `test_TokenURI_RevertNonexistent`, `test_FreezeMetadata_BlocksReveal`.
- **Withdraw/pause/ownership/royalty/interfaces:** `test_Withdraw_PullsToTreasury`,
  `…RevertNonOwner`, `test_Pause_BlocksMint`, `test_TwoStepOwnership`, `test_RoyaltyInfo`,
  `test_SupportsInterfaces`. **Constructor guards:** zero-supply / zero-treasury reverts.

`forge coverage` (aim 100% lines/branches) and `forge snapshot` (gas) are part of the run.

## 8. Open decisions for the auditor (defaults shipped; `EVM_LAUNCH_SPEC.md` §9)

1. **Which admin setters lock at Public** — *default: prices, caps, and allowlist root freeze when the phase advances to Public* (implemented + tested).
2. **`maxPerTx` + per-wallet caps** — actual numbers are an economic/anti-bot tuning decision.
3. **Refund policy** — *default: exact-payment-only, no refund path.*
4. **Immutability** — *default: immutable, no upgrade proxy* (confirm acceptable).
5. **Multisig provider/threshold** for owner/treasury (e.g. Safe 2-of-3).
6. **`ownerMint` callable any phase incl. pre-reveal** — *default: yes.*
7. **Anti-bot needs at public open** (T10) — currently accepted as fair-launch reality.

## 9. Assumptions & gating

- **Immutable, fixed-supply** art mint; no proxy, no on-chain randomness/metadata.
- **Owner = multisig** on mainnet; ownership transferred via `Ownable2Step` before launch.
- **No mainnet without:** frozen contract → external audit + economic review → findings addressed →
  re-test → re-freeze → owner-wallet deploy (`EVM_LAUNCH_SPEC.md` §8). The agent never deploys to
  mainnet or touches keys/funds.

## 10. Artifacts & contacts

- **Contract:** `packages/chain-evm/contracts/ConkernftzLaunch.sol`. **Tests:** `…/test/`.
  **Build config:** `foundry.toml`, `remappings.txt`, `slither.config.json`.
- **Runtime artifact** (ABI + bytecode for viem): `packages/chain-evm/src/launch-artifact.ts`;
  regenerate with `pnpm --filter @conkernftz/chain-evm compile-contract`.
- **Spec + threat model (full):** `docs/EVM_LAUNCH_SPEC.md`. **Off-chain Merkle (T13):**
  `packages/chain-evm/src/merkle.ts`.
- `@conkernftz/chain-evm` v4.0.0.
