# conkernftz — NFT Art Foundry (monorepo)

conkernftz is a modern, type-safe generative **NFT art foundry** (a HashLips replacement). It
composes layered artwork, enforces trait rules, places assets with pattern overlays, generates
deterministic editions, previews results, uploads to decentralized/permanent storage, and mints on
**Solana** (Metaplex Umi) or **EVM** chains (ERC-721 via viem).

The pnpm + Turborepo workspace lives in [`./conkernftz`](./conkernftz). See
[`conkernftz/README.md`](./conkernftz/README.md) for the full feature list, CLI reference,
configuration schema, and migration notes.

## Quick start

```bash
cd conkernftz
pnpm install
pnpm build

pnpm cli -- --help          # CLI (binary: conkernftz)
pnpm -C packages/ui start   # Electron GUI
```

## Highlights

- Deterministic generation (seeded RNG + SHA-256 DNA), rules engine, filename-based rarity.
- 60+ blend modes; pattern placement with jitter, rotation, collision, and anchors.
- Storage via **Irys** (Arweave), **Pinata** (IPFS), or **local** (offline testing).
- Minting on **Solana** (Umi/Token Metadata, optional pNFT) and **EVM** (OpenZeppelin ERC-721 +
  ERC-2981, deployed and minted with viem).
- TypeScript throughout, Zod-validated config, Vitest, ESLint (flat) + Prettier.

## Requirements

- Node.js >= 20.9
- pnpm 9.x

## License

MIT — see [`LICENSE`](./LICENSE).
