# Design System — "Field Instrument / Classified Dossier"

The renderer (`packages/ui/src/renderer-next`) is built on a small, strict design system:
a precision surveillance-console look — instrument amber on warm ink (dark) or ink on
manila dossier-paper (light), monospace readouts, hairline grids. **Everything is a CSS
variable**, so the whole identity retunes from one file.

This is the contributor reference. The user-facing tour is in [UI_GUIDE.md](UI_GUIDE.md);
the visual-review workflow is in [TESTING.md](TESTING.md) §5 (screenshot harness).

## Source of truth

- `styles/tokens.css` — all design tokens (`:root` + `[data-theme]`). Change the look here.
- `styles/ui.css` — base element styles, utility classes, and component CSS.
- `theme/ThemeProvider.tsx` — toggles `data-theme` (dark/light) and the accent; persists choice.

> Rule of thumb: **never hardcode a color, size, or spacing value in a component.** Reach for a
> token (`var(--…)`) or a utility class. If neither fits, add a token — don't inline a magic number.

## Tokens

| Group | Tokens |
| --- | --- |
| Type family | `--font-display` (Archivo), `--font-sans` (IBM Plex Sans), `--font-mono` (IBM Plex Mono) |
| Type scale | `--text-2xs` 10 · `--text-xs` 11 · `--text-sm` 12.5 · `--text-base` 14 · `--text-md` 16 · `--text-lg` 19 · `--text-xl` 24 · `--text-2xl` 31 · `--text-3xl` 40 (px) |
| Tracking | `--tracking-label` 0.14em · `--tracking-wide` 0.04em |
| Spacing (4px base) | `--sp-1` 4 → `--sp-8` 64 |
| Radii | `--r-xs` 2 · `--r-sm` 3 · `--r-md` 5 · `--r-lg` 8 |
| Lines | `--hair` 1px · `--line` · `--line-strong` · `--line-amber` |
| Motion | `--ease-out` · `--ease-snap` · `--dur-1` 90ms · `--dur-2` 160ms · `--dur-3` 280ms |
| Surfaces | `--bg` · `--surface` · `--surface-2` · `--surface-3` · `--surface-inset` |
| Text | `--text` · `--text-muted` · `--text-dim` · `--text-invert` |
| Accent | `--accent` · `--accent-2` · `--accent-ink` · `--accent-soft` · `--accent-glow` |
| Status | `--danger`/`-soft` · `--ok`/`-soft` · `--info`/`-soft` · `--warn` |
| Elevation | `--shadow-1` · `--shadow-2` |
| Layout | `--header-h` 56 · `--statusbar-h` 30 · `--nav-w` 256 |

Both themes define the same names, so components are theme-agnostic. `prefers-reduced-motion`
is honored globally (animations/transitions collapse to ~0ms).

## Base classes & utilities (`ui.css`)

- **Text:** `.label` (mono uppercase caption), `.mono`, `.muted`.
- **Layout:** `.stack` (vertical flow + gap), `.row` (horizontal flex + gap + center), `.grid.cols-auto`,
  `.spread` (with `.row` → `justify-content: space-between`).
- **Truncation:** `.truncate` (ellipsis + `min-width:0`), `.break-all`.
- **Captions:** `.hint` (block helper text under a control; pair with `.label muted`).
- **Motion:** `.stagger` (page-load reveal on direct children).

Prefer these over re-hand-rolling inline styles — that consistency *is* the system (see U2.2).

## Components (`components/`)

| Component | Role |
| --- | --- |
| `StageHeader` | The one page header for every stage: kicker + title + optional actions. Use it, don't hand-roll `.main-head`. |
| `Panel` | Titled surface with optional header `actions`. The primary content container. |
| `Button` | `variant` primary/ghost/danger/(default), `size` sm, `icon`. |
| `Field` / `Input` / `Select` | Labeled form controls. |
| `Badge` | Status pill (`tone` accent/ok/danger/default). |
| `Lamp` | Indicator LED (on/off/ok/danger, `pulse`). |
| `Tabs` / `TabPanel` | Accessible tablist (roving tabindex + Arrow/Home/End); `TabPanel` renders only the active section. |
| `Dialog` | Modal (Escape + click-outside to close). |
| `Lightbox` | Full-size image inspector over a base64 set (arrow-key paging); used by Preview + Build. |
| `EmptyState` | `code` + `title` + `hint` + optional `action`. Every empty/idle view uses it. |
| `Skeleton` | Loading placeholder. |
| `RarityBar` | Compact stacked trait-weight distribution bar. |
| `Toast` (`useToast`) | Transient notifications. |

New shared UI goes in `components/`, is exported from `components/index.ts`, and gets a panel
in the **Components** playground (the in-app living catalog) plus a focused unit test.

## Screen pattern

Every screen is:

```tsx
<div className="stack stagger">
  <StageHeader kicker="STAGE NN // PHASE" title="…" actions={…} />
  {/* Panels, or an EmptyState when there's no project/data */}
</div>
```

Decision-bearing logic lives in pure, tested `lib/*` modules; screens stay thin renderers over
them (e.g. `computeTraitTable`, `resolvePreviewSeed`, `makeStarterConfig`, `siteTemplates`).

## Theming & accessibility

- Theme + accent live in **Settings ▸ Appearance**, applied via `data-theme` + accent tokens, persisted.
- Interactive elements use real roles, labels, and `:focus-visible` rings; tablists use roving tabindex.
- Motion respects `prefers-reduced-motion`.
