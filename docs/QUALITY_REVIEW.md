## Quality Review and Recommendations

Date: 2025-09-10

This document summarizes a repository-wide quality audit, highlights strengths, flags issues and redundancies, and proposes targeted improvements. It focuses on `packages/core`, `packages/cli`, and `packages/ui` as they changed since the last commit.

### Strengths
- Clear monorepo structure with well-defined package responsibilities (core/cli/storage/ui/ui-tauri).
- Strong type-safety using TypeScript and Zod schemas; validated project configuration.
- Deterministic pipeline (seeded RNG + SHA-256 DNA) with rules and rarity.
- Compositor supports per-layer blend/opacity and multiple visual effects, with presets and reasonable fallbacks.
- CLI previews/build are performant with batching and progress, and outputs rarity stats.

### High-priority findings
1) Compositor unsupported-mode detection
- Issue: `compositeLayers` decides its fast path via a check that considers only `layer.blend`, not `layer.effects?.blend`. If effects specify an advanced mode unsupported by Sharp, the fast path may still be taken and we degrade to `'over'` instead of falling back to the CPU compositor.
- Impact: Visually incorrect blends when advanced modes are requested in effects.
- Recommendation: Compute `needsCpu = layers.some(l => mapBlendModeToSharp(l.blend ?? l.effects?.blend ?? 'normal') === null)` and use the CPU path whenever any layer requests an unsupported mode. Do not coerce unsupported modes to `'over'` in the fast path.

2) Effects schema vs implementation gaps (rotate/scale)
- Issue: The schema and `resolveEffects` include `rotate` and `scale`, but the compositor does not apply them.
- Impact: Configuration fields are silently ignored.
- Recommendation: Either implement rotation/scale application in `renderLayerGroup` (e.g., via Sharp affine/rotate) or remove/deprecate fields from the schema until implemented. Document current limitations.

3) RNG returns values in [0,1] (inclusive)
- Issue: `createSeededRng` divides by `0xffffffff`, allowing `1.0` to occur. Some code accounts for this (e.g., `weightedPick` fallback), but it is unconventional and can bias boundaries.
- Recommendation: Divide by `4294967296` (`2**32`) to keep outputs in [0,1).

4) Test coverage gaps for compositor and effects
- Issue: There are unit tests for DNA, rules, rarity, but not for compositor blend/effects combinations.
- Recommendation: Add tests covering: native vs CPU fallback parity, opacity/offset correctness, and a small matrix of blend modes (multiply/screen/overlay/soft-light/difference/exclusion, etc.).

### Medium-priority findings
5) Preview/build option parity
- Observation: `preview` supports `--max-attempts` and `--allow-duplicates` fallbacks; `build` does not expose attempts/duplicates controls.
- Recommendation: Add `--max-attempts` for `build` and optionally a guarded `--allow-duplicates` (off by default) for parity and UX consistency.

6) UI Live Preview canvas fallback approximations
- Observation: Canvas 2D composite modes are mapped approximately (e.g., color-dodge -> lighter; color-burn -> source-over). Core IPC preview is attempted first, but fallback accuracy is limited.
- Recommendation: Note limitations in docs/tooltips. Optionally disable specific modes in fallback or add a warning banner when accuracy may be reduced.

7) Logging discipline in CLI
- Observation: `console.log/warn/error` are used for progress and errors. This is reasonable for a CLI, but a structured logger (with `--verbose`/`--quiet`) would improve control and CI consumption.
- Recommendation: Introduce a tiny logger helper and gate logs behind verbosity flags.

8) Input validation for weights
- Observation: Weights are parsed from filenames or defaulted. There’s no explicit guard against zero/negative weights in the catalog builder.
- Recommendation: Validate parsed weights (> 0) and warn/skip invalid entries; surface layer/filename on error.

### Low-priority findings
9) CPU compositor performance
- Observation: The CPU path does pixel-wise loops for large images; acceptable as a fallback, but costly.
- Recommendation: Document that advanced modes may be slower; consider tiled compositing if large canvases are common.

10) Preload duplication (CJS and TS)
- Observation: Both `preload.cjs` and `preload.ts` expose the same API for Electron. This is likely intentional for compatibility.
- Recommendation: Keep both, but document the rationale in the UI README to avoid confusion.

11) Repo hygiene
- Stray root file `tatus -s` removed.
- Untracked `packages/core/src/effects.ts` added; ensures source matches published `dist`.

### Suggested roadmap (actionable)
- Core
  - Fix unsupported-mode detection and CPU fallback trigger. [High]
  - Implement or temporarily remove `rotate/scale` from effects. [High]
  - Adjust RNG to [0,1). [High]
  - Add compositor/effects tests. [High]
  - Validate positive weights in catalog. [Medium]
- CLI
  - Add `--max-attempts` to `build`; consider guarded `--allow-duplicates`. [Medium]
  - Introduce simple logger with verbosity flags. [Medium]
- UI
  - Document Live Preview fallback limitations; optional warning banner when using canvas fallback. [Medium]
  - Document preload CJS/TS rationale. [Low]

These changes will improve visual correctness, developer ergonomics, and user trust in preview accuracy.


