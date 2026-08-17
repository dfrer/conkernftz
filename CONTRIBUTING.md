### Contributing to conkernftz

Thanks for your interest in contributing! This project uses a pnpm + Turbo monorepo.

#### Prereqs

- Node.js >= 22.14 and < 25 (Node 22 or 24 recommended)
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
2. Keep code readable and type-safe; avoid unnecessary complexity.
3. Add or update tests where meaningful (`packages/*/src/__tests__`).
4. Ensure `pnpm build`, `pnpm test`, and `pnpm lint` are green.
5. Follow the existing code style and naming guidelines; avoid deep nesting and prefer early returns.

#### UI guidelines (packages/ui)

- Design tokens: use variables from `packages/ui/src/design-system/tokens.css` for colors, borders, radii, and shadows. Do not hardcode hex colors in components.
- Utilities: prefer the shared utility classes in `styles.css` (e.g., `row`, `wrap`, `gap-*`, `mt-*`, `column`, `layout-2col`, `auto-fit-*`) instead of inline `style` attributes. Add small utilities if truly reusable.
- Panels/forms: reuse `panel`/`panel-soft` and `form-grid`/`form-row` for layout consistency. Avoid one-off card styles.
- Accessibility: tabs and subtabs should use ARIA roles. Maintain `aria-selected`, `tabindex`, and `aria-hidden` in code, and support keyboard navigation (Left/Right/Home/End) as shown in `renderer/app.ts`.
- Motion: respect `prefers-reduced-motion`; avoid adding animations that don’t degrade gracefully.
- Icons: inject small SVGs via the icon helper in `renderer/app.ts` (keeps HTML clean). Avoid baking SVGs directly into markup unless necessary.
- Text: use UTF‑8 or HTML entities (e.g., `&hellip;`, `&ndash;`) for punctuation to prevent encoding issues.

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
