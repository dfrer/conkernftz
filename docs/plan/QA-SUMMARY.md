# ConkerNFTZ — QA sweep report

> Consolidated result of the app-wide A→Z functional + visual QA sweep (branch `fix/app-wide-qa`).
> Sources: per-surface inventory in [QA-COVERAGE.md](QA-COVERAGE.md); per-run evidence in
> `screenshots/qa-report.md` (regenerate with `pnpm -C packages/ui qa`); owner items in
> [QA-REAL-ENV-CHECKLIST.md](QA-REAL-ENV-CHECKLIST.md); full history in [LOG.md](LOG.md).

## The method

A real **interaction+verification driver** (`scripts/qa-driver.mjs`) drives the built renderer in
headless Chrome with a mocked `window.foundry`. For each surface it **triggers** controls, **waits**
for the op to complete, **asserts** the resulting DOM/state, and captures every **console
error/warning, pageerror, and failed request** — attributed to the surface. It injects mock failures
for unhappy paths and **exits non-zero on any FAIL**, so it's a standing regression gate.

## What was tested (driver = 0 findings)

- **Every stage** (13) — nav + title assertions.
- **Design** — all tabs; +Add layer; trait browser; layer-row edits (name/rarity/req/opacity);
  Save dirty-enable; **RulesEditor** (+ invalid-JSON error path); **EffectsEditor** (transforms +
  group toggle reveals/hides body + fills); **OverridesEditor** (add/set/remove); **Renamer** +
  **Spawn** selects + save.
- **Projects** (new-project dialog), **Preview** (generate + lightbox), **Build** (run + output),
  **Publish** (upload + per-action loading), **Mint FX** (replay + rip player), **Site** (template +
  canvas widget add/select), **Launch** (signer toggle, preflight, deploy, sale setup, confirm-gated
  phase/reveal/freeze/withdraw), **Packs**, **Fal AI** (form), **Settings** (theme/accent),
  **Help**, **Components** (dialog + toasts).
- **Cross-cutting** — light theme, compact viewport (1180px), **keyboard a11y** (tablist arrows,
  dialog focus trap, Escape), **reduced-motion** (transitions collapse), and injected
  **unhappy paths** (build/upload/preview failures → error handling).
- **Real engine/CLI** (not mocked) — `init → validate → build --count 8 → dupes → audit` on a
  throwaway project: 8 correct editions (images + metadata + sha256 DNA + rarity), no dupes, audit
  correct. Full workspace suite: **368 tests green**.

## What was fixed

1. **`conkernftz validate` hard-errored (exit 1) on a missing Solana wallet keypair** — a
   mint-time credential — blocking a no-code creator from validating their art. → Downgraded the
   wallet checks to **WARN**; a fresh `init` now validates to `Config OK` (exit 0).
   *(`packages/cli/src/commands/validate.ts`)*
2. **`Dialog` had no focus trap (a11y)** — `aria-modal` but keyboard Tab escaped to the background.
   → Added focus management: move focus in on open, trap Tab/Shift+Tab, restore to the trigger on
   close. Affects every dialog; the driver asserts it each run. *(`components/Dialog.tsx`)*

(Plus several **driver-selector artifacts** found and fixed — ambiguous `getByLabel` matches, a
toggle left open by a prior step. Not app bugs; tooling accuracy.)

## Residual — needs the owner's real environment

Drag-placement (spawn dots, canvas move/resize/rotate) is pointer+visual and owner-verified. All
real-credential / live-network / money paths are in
[QA-REAL-ENV-CHECKLIST.md](QA-REAL-ENV-CHECKLIST.md): real uploads (Pinata/Irys), testnet deploys +
sale ops, WalletConnect + MetaMask-console signing, host deploys, fal generation, native pickers.
Each was driven as far as the UI allows (no runtime errors); only the owner can run the live versions.

## Verdict

Across a comprehensive headless sweep + a real engine/CLI run, the app is **functionally clean** —
2 real bugs fixed, 0 driver findings, all local gates green. Visual "looks-right" judgment and the
real-environment paths remain the owner's to confirm.
