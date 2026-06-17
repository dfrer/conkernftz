## @conkernftz/core

Core engine for the conkernftz NFT art foundry.

Features
- Catalog builder (layers, rarity via filename weights)
- Rules engine (mutuallyExclusive, requires, maxOccurrences)
- Seeded generation with uniqueness (SHA-256 DNA)
- Compositor with blend/opacity/effects and CPU fallback for advanced modes
- Preview contact sheet, rarity report

Docs
- See `docs/CONFIG_REFERENCE.md` for full config schema.
- See `docs/CLI_REFERENCE.md` for the CLI that calls into the core runtime.

Dev
```
pnpm build
pnpm test
```



