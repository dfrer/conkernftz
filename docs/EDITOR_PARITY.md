# Project-authoring editor parity

This matrix covers the project-authoring capabilities seeded in
`docs/OVERHAUL_PLAN.md` lines 142–155. Evidence comes from the committed legacy
renderer immediately before its deletion (`e96f1ab^`, principally
`packages/ui/src/renderer/app.ts`, `live-preview.ts`, and `studio.ts`) and the
maintained React `renderer-next` application.

There is one maintained editor implementation: React `renderer-next`. The deleted
legacy renderer remains Git history/evidence only; none of its DOM application is
restored or run alongside React.

| Legacy capability seed | Status | Maintained implementation or explicit decision |
| --- | --- | --- |
| Launcher: recents, create, add/open | Present | `ProjectsScreen.tsx` and project state support recent projects, new projects, ordinary open, and safe existing-folder import. |
| Main → Overview: previews gallery and lightbox | Present / reorganized | `PreviewScreen.tsx` owns live rendered previews and inspection; `BuildScreen.tsx` owns built-output gallery and inspection. |
| Main → Overview: stats and console | Safe equivalent | Build progress/result, rarity report, and audits are visible in `BuildScreen.tsx`. The legacy general command console is not needed for visual config authoring and is not added to Design. |
| Main → Files: up, refresh, open, new folder, upload, rename, delete | Deliberately limited | Project-bounded trait browsing/opening and collision-safe single-file rarity rename remain in `TraitBrowser.tsx` and `RenamerPanel.tsx`. General upload, arbitrary rename/new-folder, and destructive deletion are intentionally excluded: restoring them would widen filesystem mutation beyond this local authoring packet. |
| Configure: basics | Present | `DesignScreen.tsx` Basics includes collection, image, output, uniqueness, and consumed engine settings. |
| Configure: layers table (blend, opacity, rarity, required, assets) | Present | `DesignScreen.tsx`, `TraitBrowser.tsx`, effects and overrides editors. |
| Configure: Spawn Editor and Image Renamer | Present | `SpawnEditor.tsx`, `RenamerPanel.tsx`, and direct trait rarity editing. |
| Configure utility: rarity, uniqueness, export | Present | Filename rarity and drop odds, uniqueness ignore list, `export.outDir`, schema-backed `export.previewOutDir`, format, and contact-sheet settings are editable. |
| Configure experimental: compositor and generation | Present where consumed | Supersampling, forced CPU composition, and layer shuffle are exposed because core consumes them. `experimental.generation.seedJitter` remains accepted for old configs but is not exposed: core does not consume it, so a UI control would be misleading. |
| Configure experimental: conditional layer spawn and per-option rules | Present | `LayerRulesEditor.tsx` provides structured spawn/when/unless and option match/exclude/positive-weight controls. Advanced recursive JSON is core-shape validated, applies only conditional fields, and blocks stale drafts until Reload. |
| Rules & Export: common rules JSON | Present | `RulesEditor.tsx` has structured common rules plus an explicit whole-object JSON escape hatch. JSON arrays are rejected; dirty JSON is blocked when structured Rules change until Reload; unknown object keys remain lossless. Core schema validation rejects invalid values before disk writes. |
| Rules & Export: transforms editor | Present | `TransformRulesEditor.tsx` supports add/duplicate/delete; targets; translate/rotate/scale actions and modes; recursive conditions; and a deep-NOT JSON fallback. Edits stay in a private draft until Apply, invalid/stale drafts cannot propagate, Cancel/Reload are explicit, and Apply merges transforms into the latest Rules object. Stable editor row keys keep fallback state attached to its transform; duplicate creates a new persisted ID. |
| Reports: rarity and asset/output audit | Present | `BuildScreen.tsx` loads `rarity.json` and invokes the maintained audit bridge. |
| Studio: layer reorder and trait weights | Present / reorganized | `DesignScreen.tsx` owns ordering; `TraitBrowser.tsx` owns collision-safe filename weights and probability feedback. |
| Studio: rarity histogram and regenerating gallery | Present / reorganized | `BuildScreen.tsx` renders rarity distribution; `PreviewScreen.tsx` regenerates seeded or fresh live galleries. |
| Studio: animation preview | Present with a tighter boundary | `BuildScreen.tsx` discovers at most 24 GIF/WebP/MP4/WebM outputs and loads only one selected file on demand. The project-scoped IPC enforces a 16 MiB base64 cap and returns a visible oversize error; there is no concurrent media preload. |
| Studio: asset manager / delete | Deliberately limited | Existing trait browsing and exact rarity rename are maintained. General destructive asset deletion is intentionally excluded for the same filesystem-safety reason as Main → Files. |
| Mint: upload provider/concurrency and mint range/count | Outside this packet | These are provider, credential, wallet, chain, billing, or deployment surfaces, not local editor restoration. Existing separate screens are unchanged; no authority or capability was added. |
| Options: theme/accent/radius/blur/noise/glow/reset | Partially present / scoped decision | Maintained Settings owns the shell-level dark/light theme and accent. The legacy radius, blur, noise, glow, and reset controls changed only the deleted editor shell's cosmetics; they were not project config or engine authoring and are intentionally not restored. |
| Fal AI: key, generation/catalog/queue/webhook/output actions | Outside this packet | External provider/credential/cost surfaces are intentionally excluded. No Fal calls, keys, uploads, or output mutations were added. |
| Help and About | Existing maintained screens | React Help/Settings/About surfaces remain the maintained implementation. No second legacy help system is restored. |
| Live Preview overlay: drag, reroll, fit, background | Present as a safer inline inspector | `PreviewScreen.tsx` adds an anchored inspection stage with Contain/Cover/Actual fit, Checker/Dark/Light backdrops, fresh-seed Reroll, frame selection, and drag plus keyboard crop positioning. The old freely movable/resizable overlay window is intentionally replaced by this inline control so it cannot obscure or escape the maintained layout while preserving the inspection behavior. |
| Build pause/resume/stop | Present | `BuildScreen.tsx` retains live progress and Pause/Resume/Stop. |
| Preview pause/resume/stop | Safe bounded equivalent | Maintained live preview is an in-memory request capped at 12 frames, not the legacy long-running disk preview job; seed/reroll and busy-state controls replace job pause/resume. No second batch-preview implementation is restored. |

## Data and safety invariants

- Structured edits spread the current object and preserve fields they do not own.
- Transform Apply replaces only `rules.transforms` on the latest Rules value.
- Invalid transform drafts, invalid/nonpositive option weights, malformed conditional
  JSON, stale advanced JSON, stale whole-Rules JSON, and array-valued Rules JSON never
  overwrite newer project state. Recursive conditions are bounded by depth and node count.
- Every config write is validated by core before disk mutation. The original object is
  serialized after validation so forward-compatible unknown keys remain lossless.
- Animation discovery is count-bounded; media loading is single-file, on-demand, and
  byte-bounded in the main-process IPC before base64 encoding. Both the project root and
  requested media file are canonicalized, so in-project symlinks cannot escape the root.
- This restoration adds no provider, wallet, credential, paid-call, deployment,
  arbitrary upload, or destructive general-file capability.

Core config validation is authoritative on every save and generation. Renderer validation
mirrors the relevant core transform, trait-condition, layer-option-rule, and finite /
positive-number constraints so artists get immediate feedback without losing imported
unknown keys.
