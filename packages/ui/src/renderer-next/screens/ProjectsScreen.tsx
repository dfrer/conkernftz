import { useEffect, useState } from 'react';
import { Panel } from '../components/Panel';
import { Button } from '../components/Button';
import { Badge } from '../components/Badge';
import { EmptyState } from '../components/EmptyState';
import { useToast } from '../components/Toast';
import { bridge, isBridged } from '../lib/bridge';

export interface Project {
  dir: string;
  name: string;
}

const RECENTS_KEY = 'cnftz:recents';

function basename(p: string): string {
  const parts = p.replace(/[\\/]+$/, '').split(/[\\/]/);
  return parts[parts.length - 1] || p;
}
function loadRecents(): Project[] {
  try {
    const arr = JSON.parse(localStorage.getItem(RECENTS_KEY) ?? '[]');
    return Array.isArray(arr) ? (arr as Project[]) : [];
  } catch {
    return [];
  }
}
function saveRecents(list: Project[]): void {
  try {
    localStorage.setItem(RECENTS_KEY, JSON.stringify(list.slice(0, 12)));
  } catch {
    /* ignore */
  }
}
function nameFromConfig(json: unknown, fallback: string): string {
  if (json && typeof json === 'object' && 'name' in json) {
    const n = (json as { name?: unknown }).name;
    if (typeof n === 'string' && n.trim()) return n;
  }
  return fallback;
}

export function ProjectsScreen({ onOpen }: { onOpen: (p: Project) => void }) {
  const [recents, setRecents] = useState<Project[]>([]);
  const toast = useToast();

  useEffect(() => setRecents(loadRecents()), []);

  const remember = (p: Project) => {
    const next = [p, ...loadRecents().filter((r) => r.dir !== p.dir)];
    saveRecents(next);
    setRecents(next);
  };

  const open = async () => {
    const fb = bridge();
    if (!fb) {
      toast.push('Bridge offline — open from the desktop app', 'danger');
      return;
    }
    try {
      const res = await fb.chooseProjectDir();
      if (!res.ok || !res.projectDir) return;
      const cfg = await fb.readConfig();
      const name = cfg.ok ? nameFromConfig(cfg.json, basename(res.projectDir)) : basename(res.projectDir);
      const p = { dir: res.projectDir, name };
      remember(p);
      onOpen(p);
      toast.push(`Loaded ${name}`, 'ok');
    } catch (e) {
      toast.push(String((e as Error)?.message ?? e), 'danger');
    }
  };

  const openRecent = async (p: Project) => {
    const fb = bridge();
    if (fb) {
      try {
        await fb.setProjectDir(p.dir);
      } catch {
        /* ignore */
      }
    }
    remember(p);
    onOpen(p);
  };

  return (
    <div className="stack stagger">
      <div className="main-head">
        <div>
          <div className="label main-kicker">STAGE 00 // INTAKE</div>
          <h1 className="main-title">Projects</h1>
        </div>
        <div className="row">
          <Badge tone={isBridged() ? 'ok' : 'default'}>{isBridged() ? 'BRIDGE ONLINE' : 'BRIDGE OFFLINE'}</Badge>
          <Button variant="primary" onClick={open}>
            Open project…
          </Button>
        </div>
      </div>

      <Panel title="Recent dossiers" actions={<span className="label">{recents.length} ON FILE</span>}>
        {recents.length === 0 ? (
          <EmptyState
            code="NO RECENTS"
            title="No projects on file"
            hint="Open an existing conkernftz project folder to begin. Templates for fresh Solana and EVM collections arrive in the next phase."
            action={
              <Button variant="primary" onClick={open}>
                Open project…
              </Button>
            }
          />
        ) : (
          <div className="proj-grid">
            {recents.map((p) => (
              <button key={p.dir} type="button" className="proj-card" onClick={() => openRecent(p)}>
                <span className="label">DOSSIER</span>
                <span className="proj-name">{p.name}</span>
                <span className="proj-path">{p.dir}</span>
              </button>
            ))}
            <button type="button" className="proj-card proj-card--new" onClick={open}>
              <span style={{ fontSize: 28, lineHeight: 1 }}>+</span>
              <span className="label">ADD / OPEN</span>
            </button>
          </div>
        )}
      </Panel>
    </div>
  );
}
