## v3.0.0 — 2025-08-16

### Highlights
- Documentation refresh for a more professional and effective developer experience
- CLI version reporting now reflects the package version at runtime (no hard‑coding)
- Minor quality‑of‑life improvements to command output and defaults

### Changes
- CLI
  - Reads version from `packages/cli/package.json`
  - Help descriptions clarified; consistent option names and defaults
- Docs
  - Updated `README.md` with clearer quick start, command usage, and configuration notes
  - Expanded notes on `previewOutDir` and RPC handling in `mint`
- Monorepo
  - Version bump to 3.0.0 across packages

### Upgrade notes
- Update your workspace and rebuild:
  ```bash
  cd conkernftz
  pnpm install
  pnpm build
  ```
- Existing flows continue to work. If you rely on `mint` with a custom RPC, you can set it via `chain.solana.rpcUrl` in `foundry.config.json` or `SOLANA_RPC_URL` env var.


