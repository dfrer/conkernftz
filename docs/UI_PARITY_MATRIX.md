# conkernftz — UI Feature-Parity Matrix

> **Purpose.** This is the cutover contract for the ground-up renderer rewrite (see
> `OVERHAUL_PLAN.md`). The overhaul is **feature-preserving**: nothing here may lose
> capability. The new React app may not become the default (Phase O6 cutover) until
> every row marked **must-keep** has `Migrated = ✅` and the green gate passes.
>
> Status legend — **Verdict:** Keep (carry forward as-is) · Improve (keep capability,
> upgrade UX) · Replace (rebuild for a materially better result) · Fix (latent bug).
> **Migrated:** ✅ done · ⬜ not yet · n/a (engine/CLI, not a renderer concern).
>
> _Authored in Phase O0 (2026-06-17). Update the Migrated column as O1–O6 land._

---

## 1. Screens, tabs & flows (renderer)

| Area | Sub-area / control | Verdict | Acceptance criteria (new app) | Migrated |
|------|--------------------|---------|-------------------------------|----------|
| **Launcher** | Recent-projects grid; "Create or add project" tile; Browse… | Improve | Lands on **Projects** stage; recents persist; create/add + open existing; add project **templates** (Solana + EVM). | ⬜ |
| **Header** | Brand (CONKERNFTZ logo, home); "More" popout; NASA easter-egg button; current-project label; Switch Project; Theme toggle | Keep (reimagined visuals) | Brand + easter egg retained; project context always visible; theme toggle. | ⬜ |
| **Main ▸ Overview** | Previews gallery; **lightbox** (prev/next/close); collection stat cards (collection/edition size/image size/layers); **Console** (toggle, log levels) | Improve | Previews stage with gallery + lightbox + stats; console becomes a structured log panel. | ⬜ |
| **Main ▸ Files** | Project file browser: up/refresh/open-in-explorer/new-folder/upload/rename/delete; path crumb | Improve | Lives under Settings/Assets; same CRUD; path-contained. | ⬜ |
| **Main ▸ Configure ▸ Basics** | Name, Symbol, Edition Size, Image background/width/height | Keep | Design stage → project basics form; validates via zod. | ⬜ |
| **Main ▸ Configure ▸ Layers** | Layers table (order, name, path, rarity, required, blend, opacity, asset counts, actions); **Add Layer**; Refresh Counts; Create Folders; Save | Improve | Drag-reorder + inline edit; live asset counts; per-layer blend/opacity/rarity/required preserved. | ⬜ |
| **Main ▸ Configure ▸ Layers ▸ Spawn Editor** | Embedded placement/spawn-dot editor (`spawn-editor.ts`) | Improve | Full spawn-map authoring (dots, mappings, jitter, collision, fit) preserved. | ⬜ |
| **Main ▸ Configure ▸ Layers ▸ Image Renamer** | Bulk rename (preset+seq / random-list / keep); base name/start/pad; layer-name prefix; rarity (delimiter, uniform/random-range, weight, min–max); **Bulk Rename**; **Step-through Renamer** modal | Improve | Bulk + step-through rename with rarity weighting preserved (Studio Asset manager already covers part). | ⬜ |
| **Main ▸ Configure ▸ Utility** | Rarity (delimiter, default weight); Uniqueness/DNA (hash, ignore traits); Export (out dir, preview out dir, image format png/webp/gif, contact sheet) | Keep | Same fields; format selector incl. animation. | ⬜ |
| **Main ▸ Configure ▸ Experimental** | Compositor (super-sample 1–4×, force CPU); Generation (shuffle layers); **Conditional Layer Spawn** (per-layer anyOf list + form editor + advanced JSON `anyOf/allOf/noneOf/not`); **Per-option rules** (exclude/reweight) | Improve | Structured editors for conditional spawn + option rules; **JSON escape hatch retained** so no expressiveness is lost. | ⬜ |
| **Main ▸ Rules & Export** | Rules JSON textarea (mutuallyExclusive/requires/maxOccurrences/transforms); Validate Rules; Save Rules; **Transforms modal editor** (cards, targets, translate/rotate/scale, when-conditions, badges) | Improve | Structured rules + transforms editors **plus** raw-JSON escape hatch; validation preserved. | ⬜ |
| **Main ▸ Reports** | Rarity report (open rarity.json + inline view); **Audit Assets**; **Audit Outputs** (dupes) | Improve | Rarity **histograms** (Studio already has) + audit/dupes integrated into Build/Reports. | ⬜ |
| **Studio tab** | Layer reorder; trait weight sliders + predicted distribution; rarity histogram (build/rarity.json); regenerating preview gallery; animation preview; asset manager (delete/renumber) | Keep/Improve | Folds into Design + Preview stages; pure logic (`studio/pure.ts`) already unit-tested. | ⬜ |
| **Mint tab** | Upload Provider dropdown; Concurrency; Upload; Mint From / Count; Mint | **Replace + Fix** | **Bug:** dropdown lists Arweave/IPFS but engine uses irys/pinata/local. New **Publish** stage: provider list matches real providers, dir-CID upload, CM/Umi + EVM owner-mint, progress/logs. | ⬜ |
| **Options tab** | Theme (dark/light); Accent (6 swatches); Corner radius; Glass blur; Background noise; Glow intensity; Reset UI | Keep (rebuilt on new tokens) | Settings stage; theme + accent + the radius/blur/noise/glow customization preserved. | ⬜ |
| **Fal AI tab** | API key; Quick Image (model, prompt, W/H, count, generate); **Explore Models** (search, category filter, catalog URL fetch, import/export/reset, favorites); **Model & Parameters** (dynamic param grid, queue mode, logs, webhook, body shape, reset, show-JSON, add field, save model, dry run); Output (save all/open folder/clear) | Keep/Improve | AI stage; full catalog + dynamic param editor + queue/webhook/dry-run + output management preserved. | ⬜ |
| **Help tab** | Built help page (`buildHelpPage`); contextual `data-help` popovers across the UI | Improve | Help stage + contextual help retained (re-attach to new components). | ⬜ |
| **About tab** | Product blurb; "Built by Conker"; @conkernasa + NASA site links (open external) | Keep | About panel; brand + links retained. | ⬜ |
| **Live Preview overlay** | Floating draggable overlay; show/hide; reroll/seed; fit (contain/cover/actual); background (checker/dark/light); export/save | Improve | Becomes the Preview stage's live panel; drag/fit/background/reroll/export preserved. | ⬜ |
| **Build/Preview controls** | Pause / Resume / Stop for both build and preview; top progress bar + %; status text | Keep | Progress + pause/resume/stop preserved (now cooperative & functional via engine-service). | ⬜ |

---

## 2. IPC surface (`window.foundry` → `foundry:*` channels)

All 33 channels are preserved by name + return shape in O0 (the engine boundary changed
*underneath* them). The new app re-consumes them through the typed `FoundryApi`
(`src/shared/ipc.ts`). **Fix:** `readFileBase64` + `saveJson` were missing from the
runtime `preload.cjs` before O0 — added + guarded by `preload-contract.test.ts`.

| Channel(s) | Purpose | O0 backing | Verdict |
|------------|---------|------------|---------|
| `chooseProjectDir`, `getProjectDir`, `setProjectDir` | Project selection/state | ipc-project | Keep |
| `readConfig`, `readConfigAt`, `writeConfig`, `saveJson` | Config + JSON IO (path-contained) | ipc-project | Keep/Fix |
| `chooseDirInsideProject`, `readFile`, `readFileBase64`, `listDir`, `listImages`, `ensureDirs`, `deletePath`, `renameFiles`, `openInExplorer`, `openExternal` | Filesystem + shell (write/delete now project-contained) | ipc-project | Keep/Improve |
| `buildWithProgress`, `pauseBuild`, `resumeBuild`, `stopBuild`, `onBuildProgress` | Build collection w/ progress | **engine-service** | Keep |
| `previewWithProgress`, `pausePreview`, `resumePreview`, `stopPreview`, `onPreviewProgress` | Render previews to disk | **engine-service** | Keep |
| `previewLive` | Live base64 previews | **engine-service** | Keep |
| `previewEffects` | Single CPU effects composite | **engine-service** | Keep |
| `fsSave`/`saveBase64`, `fsList`/`listFiles`, `fsDelete`/`deleteFile` | FileManager CRUD | ipc-storage | Keep |
| `run` | Generic CLI shell (upload/mint/deploy/candy) | cli-runner | Keep (until Publish rework) |
| `auditAssets`, `auditOutputs` | CLI audit/dupes | cli-runner | Improve (move to engine later) |

---

## 3. CLI commands (`conkernftz`)

The CLI is a first-class, preserved surface (packaged-app-first, but CLI healthy for
devs/CI). No command is removed by the overhaul.

| Command | Verdict | Notes |
|---------|---------|-------|
| `init` | Improve | Add an EVM template (currently Solana-only). |
| `validate`, `preview`, `build`, `dupes`, `audit` | Keep | — |
| `upload` | Keep | irys/pinata/local + dir-CID (Phase 1). |
| `mint`, `deploy`, `candy` | Keep | Solana Umi/CM + EVM owner-mint; launch contract deferred (Phase L). |
| `e2e` | Keep | — |
| _help banner_ | **Fixed in O0** | Said "foundry"; now "conkernftz". |

---

## 4. Config surface (`foundry.config.json` / `ProjectConfigSchema`)

Every schema section is preserved; the new editors must round-trip them losslessly.

`name · symbol · description · editionSize · image{width,height,background} · layers[]
(name,path,rarity,required,animation,spawnWhen/Unless/WhenAnyOf,optionRules,blend,opacity,
effects,overrides) · rules{mutuallyExclusive,requires,maxOccurrences,transforms} · rarity ·
uniqueness · spawn{mapPath,fitMode} · export{outDir,previewOutDir,imageFormat,contactSheet,
animation{enabled,fps,durationMs,format[],loop}} · storage{provider:irys|pinata|local|+legacy}
· chain{solana{...,candyMachine{guards}} | evm{...}} · experimental{compositor,generation}`

**Acceptance:** a config edited in the new UI and saved must validate against
`ProjectConfigSchema` and preserve any fields the UI doesn't surface (no lossy writes).

---

## 5. Capability gaps / bugs found during O0

| Issue | Status |
|-------|--------|
| `preload.cjs` missing `readFileBase64` + `saveJson` → Studio image/animation previews silently degraded | **Fixed** (O0) + guarded by test |
| Mint tab Upload Provider lists Arweave/IPFS (engine uses irys/pinata/local) | Tracked → Publish rebuild (O4) |
| Mint tab is a stub ("expand later") | Tracked → Publish rebuild (O4) |
| Render pipeline re-implemented in main process (drift from core) | **Fixed** (O0): routed through `renderEdition`/`buildCollection` via engine-service |
| Runtime `pnpm build` self-heal (packaging blocker) | **Removed** (O0) |
| `saveJson` accepted absolute paths (arbitrary write) | **Fixed** (O0): project-contained |
| Docs stale (README "foundry"/ui-tauri; CONFIG_REFERENCE arweave/ipfs) | Tracked → docs track (O4/O6) |
