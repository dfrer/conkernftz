### Contributing to conkernftz

Thanks for your interest in contributing! This project uses a pnpm + Turbo monorepo.

#### Prereqs

- Node.js >= 18.18
- pnpm 9.x

#### Setup

```bash
cd conkernftz
pnpm install
pnpm build
```

#### Scripts

- `pnpm dev` — run dev tasks (where supported)
- `pnpm test` — run all package tests
- `pnpm lint` — lint all packages
- `pnpm typecheck` — TypeScript typecheck
- `pnpm clean` — remove build outputs

#### Making changes

1. Prefer small, focused edits with clear descriptions.
2. Keep code readable and type‑safe; avoid unnecessary complexity.
3. Add or update tests where meaningful (`packages/*/src/__tests__`).
4. Ensure `pnpm build`, `pnpm test`, and `pnpm lint` are green.

#### Commit style

Conventional Commits are preferred (e.g., `feat: ...`, `fix: ...`, `chore: ...`).


