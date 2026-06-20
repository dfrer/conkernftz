# Quality Review

**Date:** 2026-06-19 (supersedes the 2025-09-10 review, which predated the renderer overhaul and
referenced the since-removed `ui-tauri` package).

A repository-wide health audit: structure, hygiene, type-safety, tests, security, UI/UX, and
feature completeness vs. the [PLATFORM_MASTER_PLAN](PLATFORM_MASTER_PLAN.md). Live feature gaps
are tracked in [KNOWN_GAPS](KNOWN_GAPS.md); this is the engineering-health snapshot.

## Scorecard

| Area | Grade | Notes |
|------|-------|-------|
| Monorepo structure | A− | Clean 6-package split (core/storage/cli/chain-evm/chain-solana/ui); ubuntu+windows CI matrix |
| Code quality / type-safety | A | ~16.7k src LOC; 1 TODO, 0 `@ts-ignore`/`@ts-expect-error`, 0 `eval`, no raw-HTML injection; Zod + a typed-IPC drift test |
| Test suite | A− | ~398 cases (strong on core/ui); latent parallel-timeout flakiness fixed (serialized `-w test` + raised timeouts) |
| Security | A | `nodeIntegration:false`, `contextIsolation:true`, `contextBridge`; raw-HTML widget in a sandboxed iframe; deploy creds via env/header only; contracts audit-gated |
| UI/UX | A− | One consistent identity across 11 stages; screenshot harness drives every stage; interaction feel is owner-QA'd |
| Docs | A− | Comprehensive + an honest KNOWN_GAPS ledger |
| Feature completeness | B+ | Creator A→Z (create→experience→site→export→deploy×5) is 100%; live on-chain minting (P5+L1) is the deferred keystone |

## Strengths
- **Architecture.** Pure-core / thin-shell: decision logic lives in tested `lib/*` modules; React
  components and the Electron main process are thin. The renderer↔main boundary is a single typed
  IPC contract (`shared/ipc.ts`) with a compile-time keys-match guard **and** a runtime drift test
  against `preload.cjs`.
- **Determinism.** Seeded RNG + SHA-256 DNA; rules/rarity; the mint experience, site config, and
  generated static site all render from the same serializable config + component library (no drift
  between in-app preview and shipped site).
- **Security.** Locked-down Electron; the raw-HTML site block runs in a sandboxed iframe rather than
  React's raw-HTML injection API; deploy tokens go via env / Authorization header (never argv);
  storage and deploy credentials stay on the user's machine; fund-handling contracts are audit-gated.
- **Verification discipline.** A playwright screenshot harness renders the built UI headlessly and
  captures every stage with the real bundled assets — UI changes can be SEEN, not just trusted.

## Findings & status
- **[FIXED] Latent test flakiness.** `pnpm -w test` ran every package's vitest in parallel; on
  many-core machines that oversubscribed the CPU and tripped vitest's 5s default timeout on heavy
  suites (cli e2e-build, chain-solana merkle) — a different package failed each run while all passed
  solo. Fixed by serializing the workspace test run (`--concurrency=1`) and raising per-test timeouts.
- **[FIXED] Spurious turbo warning.** The `test` task declared `coverage/**` outputs it never
  produced; removed.
- **[PARTIAL] Coverage not gated.** Breadth is good by file count but coverage % isn't measured/enforced.
- **[OPEN] `SiteScreen.tsx` ~1028 LOC.** Grew to hold state, undo/redo, snap, multi-select, 5-host
  deploy, upload, templates, the inspector, and the canvas — a decomposition candidate.
- **[OPEN] `chain-evm` under-tested** (~3 cases / 875 LOC). Tied to the audit-gated on-chain track,
  so it naturally grows with the L1 launch contract.
- **[OPEN] Stale nested duplicate.** A leftover second checkout at `<root>/conkernftz/` (~623 MB incl.
  its own `node_modules`, never tracked) — now gitignored; safe to delete on disk (`rm -rf conkernftz`).

## The strategic gap
The entire creator side is complete and polished. The one remaining capability is **live minting**:
the generated site's mint widget is preview-only until **P5 (WalletConnect)** + the **L1 launch
contract** (testnet-first, externally audited before mainnet). Everything short of that is built.
