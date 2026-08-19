import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { bridge, type ImportProjectResult } from '../lib/bridge';
import { makeStarterConfig, type NewProjectOpts } from '../lib/newProject';
import type { ExperienceConfig } from '../lib/mintExperience';
import type { SiteConfig } from '../lib/site';

// Editable view of foundry.config.json. Known fields are typed; an index signature
// preserves everything the new UI does not yet surface so saves round-trip losslessly.
export interface LayerEffects {
  blend?: string;
  opacity?: number;
  offsetX?: number;
  offsetY?: number;
  rotate?: number;
  scale?: number;
  glow?: { color?: string; radius?: number; opacity?: number; inner?: boolean; preset?: string };
  stroke?: { color?: string; width?: number; opacity?: number; position?: 'outside' | 'inside' | 'center'; preset?: string };
  shadow?: { color?: string; blur?: number; offsetX?: number; offsetY?: number; opacity?: number; inner?: boolean; preset?: string };
  extrude?: { color?: string; depth?: number; angle?: number; opacity?: number; preset?: string };
  blur?: number;
  modulate?: { hue?: number; saturation?: number; brightness?: number };
  colorOverlay?: { color?: string; opacity?: number; blend?: string; preset?: string };
  recolor?: { low?: string; high?: string; preset?: string };
  [k: string]: unknown;
}
export interface AssetOverrideCfg {
  target?: 'filename' | 'value';
  match?: string;
  effects?: LayerEffects;
  [k: string]: unknown;
}
export interface LayerCfg {
  name: string;
  path: string;
  rarity?: 'filename' | 'uniform';
  required?: boolean;
  blend?: string;
  opacity?: number;
  effects?: LayerEffects;
  overrides?: AssetOverrideCfg[];
  [k: string]: unknown;
}
export interface ProjectConfig {
  name?: string;
  symbol?: string;
  description?: string;
  editionSize?: number;
  image?: { width?: number; height?: number; background?: string; [k: string]: unknown };
  layers?: LayerCfg[];
  export?: { imageFormat?: string; outDir?: string; [k: string]: unknown };
  mintExperience?: ExperienceConfig;
  site?: SiteConfig;
  [k: string]: unknown;
}
export interface ProjectRef {
  dir: string;
  name: string;
}

interface ProjectApi {
  project: ProjectRef | null;
  config: ProjectConfig | null;
  loading: boolean;
  error: string | null;
  dirty: boolean;
  recents: ProjectRef[];
  openViaDialog(): Promise<boolean>;
  openDir(ref: ProjectRef): Promise<boolean>;
  createProject(opts: NewProjectOpts): Promise<boolean>;
  importProject(): Promise<ImportProjectResult>;
  reload(): Promise<void>;
  updateConfig(mut: (draft: ProjectConfig) => void): void;
  save(): Promise<boolean>;
}

const Ctx = createContext<ProjectApi | null>(null);
const RECENTS_KEY = 'cnftz:recents';

function basename(p: string): string {
  const parts = p.replace(/[\\/]+$/, '').split(/[\\/]/);
  return parts[parts.length - 1] || p;
}
function nameFromConfig(json: unknown, fallback: string): string {
  if (json && typeof json === 'object' && 'name' in json) {
    const n = (json as { name?: unknown }).name;
    if (typeof n === 'string' && n.trim()) return n;
  }
  return fallback;
}
function loadRecents(): ProjectRef[] {
  try {
    const arr = JSON.parse(localStorage.getItem(RECENTS_KEY) ?? '[]');
    return Array.isArray(arr) ? (arr as ProjectRef[]) : [];
  } catch {
    return [];
  }
}
function saveRecents(list: ProjectRef[]): void {
  try {
    localStorage.setItem(RECENTS_KEY, JSON.stringify(list.slice(0, 12)));
  } catch {
    /* ignore */
  }
}

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [project, setProject] = useState<ProjectRef | null>(null);
  const [config, setConfig] = useState<ProjectConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [recents, setRecents] = useState<ProjectRef[]>([]);

  useEffect(() => setRecents(loadRecents()), []);

  const loadFor = useCallback(async (ref: ProjectRef, remember: boolean): Promise<boolean> => {
    const fb = bridge();
    setLoading(true);
    setError(null);
    try {
      let cfg: ProjectConfig | null = null;
      let name = ref.name;
      if (fb) {
        const c = await fb.readConfig();
        if (!c.ok) {
          setError(c.error ?? 'Could not read foundry.config.json');
          return false;
        }
        if (!c.json || typeof c.json !== 'object' || Array.isArray(c.json)) {
          setError('foundry.config.json did not contain a project object');
          return false;
        }
        cfg = c.json as ProjectConfig;
        name = nameFromConfig(cfg, ref.name);
      }
      const finalRef = { dir: ref.dir, name };
      setProject(finalRef);
      setConfig(cfg);
      setDirty(false);
      if (remember) {
        const next = [finalRef, ...loadRecents().filter((r) => r.dir !== finalRef.dir)];
        saveRecents(next);
        setRecents(next);
      }
      return true;
    } catch (e) {
      setError(String((e as Error)?.message ?? e));
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  // Restore the active project from the bridge on boot (no-op off-bridge).
  useEffect(() => {
    const fb = bridge();
    if (!fb) return;
    let cancelled = false;
    (async () => {
      try {
        const r = await fb.getProjectDir();
        if (cancelled || !r.ok || !r.projectDir) return;
        await loadFor({ dir: r.projectDir, name: basename(r.projectDir) }, false);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadFor]);

  const openDir = useCallback(
    async (ref: ProjectRef): Promise<boolean> => {
      const fb = bridge();
      if (fb) {
        try {
          await fb.setProjectDir(ref.dir);
        } catch {
          /* ignore */
        }
      }
      return loadFor(ref, true);
    },
    [loadFor],
  );

  const openViaDialog = useCallback(async (): Promise<boolean> => {
    const fb = bridge();
    if (!fb) {
      setError('Bridge offline — open from the desktop app');
      return false;
    }
    const res = await fb.chooseProjectDir();
    if (!res.ok || !res.projectDir) return false;
    return loadFor({ dir: res.projectDir, name: basename(res.projectDir) }, true);
  }, [loadFor]);

  // Scaffold a fresh collection: pick/create a folder, refuse to clobber an existing
  // project, write a starter config + empty layer folders, then open it. Orchestrates
  // existing (path-guarded) bridge calls — no new file-writing surface.
  const createProject = useCallback(
    async (opts: NewProjectOpts): Promise<boolean> => {
      const fb = bridge();
      if (!fb) {
        setError('Bridge offline — create a project from the desktop app');
        return false;
      }
      setError(null);
      const res = await fb.chooseProjectDir(); // also sets the active project dir on the main side
      if (!res.ok || !res.projectDir) return false;
      const dir = res.projectDir;
      try {
        const existing = await fb.readConfigAt(dir);
        if (existing.ok && existing.json) {
          setError('That folder already contains a project — use “Open project” instead.');
          return false;
        }
        const starter = makeStarterConfig(opts);
        const w = await fb.writeConfig(starter);
        if (!w.ok) {
          setError(w.error ?? 'Could not write the starter config');
          return false;
        }
        await fb.ensureDirs((starter.layers ?? []).map((l) => l.path));
        return loadFor({ dir, name: starter.name ?? basename(dir) }, true);
      } catch (e) {
        setError(String((e as Error)?.message ?? e));
        return false;
      }
    },
    [loadFor],
  );

  // The main process validates or creates the config and commits its active project
  // exactly once. Adopt that same returned snapshot atomically so renderer and main
  // cannot diverge through a second filesystem read.
  const importProject = useCallback(async (): Promise<ImportProjectResult> => {
    const fb = bridge();
    if (!fb) {
      const error = 'Bridge offline — import from the desktop app';
      setError(error);
      return { ok: false, error };
    }
    setLoading(true);
    setError(null);
    try {
      const result = await fb.importProjectFolder();
      if (result.cancelled) return result;
      if (
        !result.ok ||
        !result.projectDir ||
        !result.config ||
        typeof result.config !== 'object' ||
        Array.isArray(result.config)
      ) {
        const error = result.error ?? 'Could not import layer folder';
        setError(error);
        return { ...result, ok: false, error };
      }
      const importedConfig = result.config as ProjectConfig;
      const importedProject = {
        dir: result.projectDir,
        name: nameFromConfig(importedConfig, basename(result.projectDir)),
      };
      setProject(importedProject);
      setConfig(importedConfig);
      setDirty(false);
      const next = [importedProject, ...loadRecents().filter((recent) => recent.dir !== importedProject.dir)];
      saveRecents(next);
      setRecents(next);
      return result;
    } catch (e) {
      const error = String((e as Error)?.message ?? e);
      setError(error);
      return { ok: false, error };
    } finally {
      setLoading(false);
    }
  }, []);

  const reload = useCallback(async () => {
    if (project) await loadFor(project, false);
  }, [project, loadFor]);

  const updateConfig = useCallback((mut: (draft: ProjectConfig) => void) => {
    setConfig((c) => {
      if (!c) return c;
      const draft = structuredClone(c);
      mut(draft);
      return draft;
    });
    setDirty(true);
  }, []);

  const save = useCallback(async (): Promise<boolean> => {
    const fb = bridge();
    if (!fb || !config) {
      setError('Cannot save (bridge offline or no project)');
      return false;
    }
    const r = await fb.writeConfig(config);
    if (r.ok) {
      setDirty(false);
      return true;
    }
    setError(r.error ?? 'Save failed');
    return false;
  }, [config]);

  return (
    <Ctx.Provider
      value={{
        project,
        config,
        loading,
        error,
        dirty,
        recents,
        openViaDialog,
        openDir,
        createProject,
        importProject,
        reload,
        updateConfig,
        save,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useProject(): ProjectApi {
  const c = useContext(Ctx);
  if (!c) throw new Error('useProject must be used within ProjectProvider');
  return c;
}
