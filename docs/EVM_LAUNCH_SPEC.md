# Phase L — EVM Launch Contract: Specification & Threat Model

> **Status: DRAFT FOR REVIEW.** This is a design + threat-model document, written *before*
> any contract code, for the owner and an external auditor / experienced web3 dev to review
> and sign off. **No mainnet deploy may happen until a professional audit + economic review
> of the implemented contract is complete.** This document is the contract; the code follows
> it. Sections marked **[OPEN]** are decisions that should be settled before implementation.

## 1. Scope

Produce the production sale contract `ConkernftzLaunch.sol` and its tooling: a phased mint
(**allowlist → fixed-price public → reveal**) for **Base + Ethereum L1**, with a Foundry
test suite (unit + fuzz + invariant), Slither in CI, deploy/verify tooling with mainnet
safeguards, and non-custodial WalletConnect v2 UI actions.

**Non-goals:** on-chain randomness, upgradeable proxy, on-chain metadata/SVG, marketplace
logic, ERC-1155, cross-chain bridging, secondary-sale enforcement beyond ERC-2981 signaling.

The existing `ConkernftzCollection.sol` (owner-mint only, settable baseURI, ERC-2981) stays
as the "simple" option; `ConkernftzLaunch.sol` is the new launch-grade contract.

## 2. Actors & trust model

| Actor | Trust | Capabilities |
|-------|-------|--------------|
| **Owner** (deployer → treasury multisig) | Trusted, but minimized | advance phase, set prices/caps, set allowlist root, reveal, freeze, withdraw, ownerMint, pause |
| **Allowlisted minter** | Untrusted | `allowlistMint(qty, proof)` while in Allowlist phase, within their cap |
| **Public minter** | Untrusted | `publicMint(qty)` while in Public phase, within per-wallet cap |
| **Attacker** | Hostile | any external call, reentrancy, front-running, proof forgery, overpay/underpay, griefing |
| **Secondary marketplace** | N/A | reads ERC-2981 royalty info (honored voluntarily) |

**Owner-key assumption:** owner should be a **multisig** (e.g. Safe) on mainnet, never an EOA
holding launch proceeds. The contract uses **Ownable2Step** so ownership transfer to the
multisig is a deliberate two-step handoff. This is an operational requirement, documented for
the audit and the launch runbook.

## 3. Contract design — `ConkernftzLaunch.sol`

**Base primitives (all audited, no custom crypto):**
- **ERC-721A** (Chiru Labs) — gas-efficient batch mint (materially cheaper on Ethereum L1).
- **ERC-2981** — secondary royalty signaling.
- **Ownable2Step** — safer ownership handoff.
- **ReentrancyGuard** — on every state-changing external mint/withdraw.
- **Pausable** — emergency stop for mint functions.
- Solidity `^0.8.20+` (checked arithmetic; no custom unchecked except ERC721A internals).
- **Immutable, non-upgradeable.** Rationale: a fixed-supply art mint does not justify a proxy's
  added risk surface; immutability is a feature buyers can verify. **[OPEN: confirm no proxy.]**

**State:**
- `enum Phase { Closed, Allowlist, Public }` — starts `Closed`.
- `uint256 public immutable maxSupply`
- `uint256 public allowlistPrice; uint256 public publicPrice` (wei)
- `uint256 public allowlistWalletCap; uint256 public publicWalletCap`
- `uint96 public maxPerTx` — anti-griefing batch ceiling
- `bytes32 public allowlistRoot`
- `mapping(address => uint256) public allowlistMinted; mapping(address => uint256) public publicMinted`
- `string placeholderURI; string revealedBaseURI; bool public revealed; bool public metadataFrozen`
- `bytes32 public immutable provenanceHash` — set at construction (concatenated asset/DNA hash) for fair-mint proof
- `address public treasury`

**Functions (access · effects · checks):**

*Minting (external, `whenNotPaused`, `nonReentrant`):*
- `allowlistMint(uint256 qty, bytes32[] proof)` — phase==Allowlist; verify `MerkleProof.verify(proof, root, leaf)`; `allowlistMinted[msg.sender] + qty <= cap`; `totalMinted + qty <= maxSupply`; `msg.value == allowlistPrice * qty`; effects before `_mint` (CEI); `_mint(msg.sender, qty)`.
- `publicMint(uint256 qty)` — phase==Public; `qty <= maxPerTx`; per-wallet cap; supply cap; exact payment; CEI; mint.
- `ownerMint(address to, uint256 qty)` — onlyOwner; supply cap; no payment; for team/treasury. **[OPEN: should ownerMint be callable any phase, including before reveal? Default: yes, any phase.]**

*Admin (onlyOwner):*
- `setPhase(Phase)`, `setPrices(allowlist, public)`, `setCaps(allowlistCap, publicCap, maxPerTx)`, `setAllowlistRoot(bytes32)`, `setTreasury(address)` — all only meaningful pre/at-launch; consider locking some after Public opens. **[OPEN: which admin setters lock after launch?]**
- `reveal(string baseURI)` — requires `!metadataFrozen`; sets `revealedBaseURI`, `revealed=true`.
- `freezeMetadata()` — one-way; blocks further `reveal`/`setBaseURI`.
- `withdraw()` — **pull to `treasury`** via `call` with success check; `nonReentrant`; reverts on zero balance. **[OPEN: single treasury vs OZ `PaymentSplitter` for multiple creators — needs the creator-split list if split.]**
- `pause()`/`unpause()`.

*Views:*
- `tokenURI(id)` — `revealed ? string.concat(revealedBaseURI, id, ".json") : placeholderURI`.
- `totalMinted()` (ERC721A), `totalSupply()`.

**Merkle leaf format (security-critical — pin this exactly):**
- Use OpenZeppelin **`@openzeppelin/merkle-tree` `StandardMerkleTree`** on the JS side, which
  **double-hashes** leaves and sorts sibling pairs — matching `MerkleProof.verify` and
  resistant to second-preimage / forged-proof attacks.
- Leaf encoding: **`StandardMerkleTree.of(entries, ['address','uint256'])`** where the uint256
  is the per-address `maxQty`. The contract recomputes `leaf = keccak256(bytes.concat(keccak256(abi.encode(msg.sender, allowedQty))))`.
- **[OPEN]** Allowlist allocation model:
  - **(A) Per-address `maxQty` in the leaf** (recommended) — flexible, but the cap travels in the proof and must be passed to `allowlistMint(qty, allowedQty, proof)`.
  - **(B) Uniform `allowlistWalletCap`** — leaf is just the address; simpler, every allowlisted wallet gets the same cap.
  - Pick one. (A) is more powerful; (B) is a smaller attack surface. This choice drives the function signature.

## 4. Invariants (targets for `forge` invariant tests)

1. `totalMinted() <= maxSupply` always.
2. `Σ allowlistMinted + Σ publicMinted + ownerMinted == totalMinted()`.
3. Contract ETH balance == Σ(paid mints) − Σ(withdrawn) (funds conservation; no ETH stuck or extractable beyond proceeds).
4. No mint succeeds while `phase == Closed` or `paused`.
5. `allowlistMinted[a] <= a`'s cap; `publicMinted[a] <= publicWalletCap` for all `a`.
6. Payment exactness: a successful mint transferred exactly `price * qty`.
7. Once `metadataFrozen`, `revealedBaseURI` and `revealed` never change.
8. Only `treasury` ever receives withdrawn proceeds.

## 5. Threat model

| # | Threat | Vector | Mitigation | Verified by |
|---|--------|--------|-----------|-------------|
| T1 | Reentrancy on mint/withdraw | malicious `onERC721Received` / receive() | `nonReentrant` + CEI ordering; pull-payment withdraw | unit + invariant (funds conservation) |
| T2 | Allowlist over-mint / replay | reuse proof across txs | per-wallet `allowlistMinted` accounting checked before mint | unit + fuzz(qty, repeated) |
| T3 | Forged Merkle proof | craft leaf/proof | OZ StandardMerkleTree double-hash + `MerkleProof.verify`; leaf binds `msg.sender` | unit (bad proof reverts) |
| T4 | Wrong/under/over payment | send wrong `msg.value` | `require(msg.value == price*qty)`; no refunds path (exact only) | unit + fuzz(msg.value) |
| T5 | Supply overrun | concurrent/batched mints near cap | single `totalMinted` check pre-mint; ERC721A atomic batch | invariant (supply ≤ max) |
| T6 | Phase/price misconfiguration | owner sets wrong price/phase | explicit setters + events + testnet runbook; **[OPEN]** lock critical setters post-launch | runbook + unit |
| T7 | Withdraw access / theft | non-owner withdraw, wrong recipient | `onlyOwner`, fixed `treasury`, success-checked `call` | unit (unauthorized reverts) |
| T8 | Metadata rug / unfair reveal | owner swaps art post-mint | `provenanceHash` committed at construction; `freezeMetadata()` for finality | unit + docs |
| T9 | Griefing via huge `qty` | gas/DoS, supply hog | `maxPerTx` ceiling; per-wallet caps | unit + fuzz |
| T10 | Front-running phase open | bots mint first | accepted (fair-launch reality); allowlist phase favors curated list; **[OPEN]** any anti-bot needs? | docs |
| T11 | Owner key compromise | stolen EOA key | **multisig treasury + Ownable2Step**; pause; minimized owner powers | operational (runbook) |
| T12 | Integer overflow | arithmetic | Solidity 0.8 checked math; audited ERC721A | compiler + Slither |
| T13 | Signature/leaf format drift JS↔Sol | mismatched encoding | single shared `merkle.ts` using OZ lib; round-trip test JS→Sol | unit (proof generated in JS verifies in Sol) |

## 6. Test plan (Foundry)

- **Unit:** every function happy-path + every revert (wrong phase, bad proof, over cap, wrong value, unauthorized, paused, frozen).
- **Fuzz:** `allowlistMint`/`publicMint` over random `qty`, `msg.value`, address sets, proof validity.
- **Invariant:** the 8 invariants in §4 (handler-based, randomized actor calls).
- **Gas:** `forge snapshot` on mint(1), mint(5), mint(maxPerTx) for L1 cost visibility.
- **Coverage:** `forge coverage` reported; aim 100% lines/branches on the contract.
- **Static:** **Slither** clean (or every finding triaged & justified) in CI.
- **Cross-impl:** a test that builds a tree + proof in JS (`merkle.ts`) and asserts the Sol contract accepts it (catches T13).

## 7. Off-chain surface (built after the contract is settled & audited)

- **Toolchain:** add Foundry (`forge`); `.sol` is the single source — a script extracts ABI +
  bytecode from `out/` into `src/artifact.ts` (replacing solc-js), with `erc721a` import
  resolution. viem deploys from the committed `artifact.ts` (runtime needs no forge).
- **Adapter (`chain-evm/src/`):** `deploy.ts` (`deployLaunch` w/ new ctor args), new `sale.ts`
  (`setAllowlistRoot`/`setPhase`/`setPrices`/`reveal`/`freezeMetadata`/`withdraw`/test mints),
  new `merkle.ts` (tree + proofs, shared), chain presets (Base/Base-Sepolia/Ethereum/Sepolia),
  gas-estimate + balance preflight helpers.
- **CLI:** `deploy` (launch), `allowlist` (root + proofs from CSV/JSON), `phase`, `reveal`,
  `withdraw`, `verify` (Etherscan/Sourcify). **Mainnet safeguards:** testnet by default;
  `--mainnet` **and** explicit typed `--confirm`; print gas + balance preflight; `--dry-run`
  everywhere; block on insufficient balance.
- **Config:** extend `ChainEvmSchema` with an optional `sale` block `{ phase, allowlistRoot,
  allowlistPrice, publicPrice, allowlistCap, publicCap, maxPerTx, placeholderUri,
  provenanceHash, treasury }`.
- **UI (WalletConnect v2, non-custodial):** deploy / set-root / advance-phase / reveal /
  withdraw / mint actions in the renderer wallet module — **each with explicit mainnet
  confirmation + gas display**; the app never holds keys (external wallet signs every tx).

## 8. Deployment & launch gating

1. `forge test` (unit+fuzz+invariant) + `forge coverage` + Slither all green in CI.
2. **Testnet end-to-end** on Base-Sepolia + Sepolia: deploy → set root → allowlist-mint w/ proof
   → public-mint → reveal → withdraw → verify on explorer; UI actions exercised via WalletConnect.
3. **Freeze the contract** → **external professional audit + economic review** (HARD GATE).
4. Address audit findings; re-test; re-freeze.
5. Transfer ownership to the **multisig**; mainnet deploy **by the owner's own wallet** (the
   agent never deploys to mainnet or touches keys/funds).

## 9. Open decisions (need owner / auditor input before coding)

1. **Allowlist model:** per-address `maxQty` in the leaf (A) vs uniform cap (B)? (§3)
2. **Treasury:** single address vs `PaymentSplitter` (and the split list) for multiple creators?
3. **Which admin setters lock** once the Public phase opens (price/caps/root immutability)?
4. **`maxPerTx`** value and per-wallet caps (economic/anti-bot tuning).
5. **Refund policy:** exact-payment-only (recommended) vs accept-overpay-and-refund?
6. **Confirm immutability** (no upgrade proxy).
7. **ERC-721A** acceptable as a dependency (audited but third-party) vs vanilla OZ ERC-721?
8. **Chains at launch:** Base only first, or Base + Ethereum L1 simultaneously?
9. **Multisig** provider/threshold for the owner/treasury role.

---

*Prepared as the pre-implementation artifact for Phase L. Once the **[OPEN]** items are
resolved and this is signed off, implementation proceeds testnet-first, contract code frozen
for external audit before any mainnet deploy.*
