## UI Guide (Electron)

The optional Electron GUI provides a visual workflow to configure projects, preview generations, and run commands.

### Start

```
pnpm -C packages/ui build
pnpm -C packages/ui start
```

If dependencies or the CLI are missing, the app displays an actionable message (run `corepack enable`, then `pnpm install` and `pnpm build` at the repo root).

### Key Features

- Live Preview overlay: drag, reroll, fit modes (contain/cover/actual), background (checker/dark/light).
- Fal AI page: connect to `fal.ai`, choose models, size, and count; save to your project folder.
- Project Config editor: edit and save `foundry.config.json` from within the app.
- Options: light/dark theme, accent color, UI tokens (radius/blur/noise), reduced motion.

Accessibility
- Keyboard-friendly tabs with ARIA roles; Arrow Left/Right and Home/End support.
- Respects `prefers-reduced-motion`.

### Accuracy notes

The UI attempts to render previews via the core compositor over IPC when available. If unavailable, it falls back to a Canvas 2D approximation:
- Some blend modes may map approximately.
- When accuracy is reduced, prefer running a CLI preview with IPC/core rendering enabled for final checks.

### Troubleshooting

- If `packages/cli/dist/bin.js` is missing, build from repo root.
- On Windows, prefer a non-OneDrive path and consider enabling Win32 long paths.



