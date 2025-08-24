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
5. Follow the existing code style and naming guidelines; avoid deep nesting and prefer early returns.

#### Commit style

Conventional Commits are preferred (e.g., `feat: ...`, `fix: ...`, `chore: ...`).

Examples:

- `feat(core): add linear-light blend mode to CPU compositor`
- `fix(cli): handle missing upload manifest with actionable message`
- `docs(readme): clarify mint RPC configuration`
- `docs(changelog): add v4.0.0`

#### Pull requests

- Open PRs against `main`.
- Keep PRs focused and include a brief rationale in the description.
- Link related issues if applicable.
- CI must be green before merge.

#### Release process

- Bump versions across packages and root `package.json`.
- Update `CHANGELOG.md` and add `RELEASE_NOTES_vX.Y.Z.md`.
- Build and run tests.
- Commit with `chore(release): vX.Y.Z` and tag the commit (`git tag -a vX.Y.Z -m "vX.Y.Z"`).


