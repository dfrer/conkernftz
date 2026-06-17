import { Panel } from '../components/Panel';
import { Button } from '../components/Button';
import { Badge } from '../components/Badge';
import { EmptyState } from '../components/EmptyState';
import { useToast } from '../components/Toast';
import { isBridged } from '../lib/bridge';
import { useProject, type ProjectRef } from '../state/project';

export function ProjectsScreen({ onOpened }: { onOpened: () => void }) {
  const { recents, openViaDialog, openDir, error } = useProject();
  const toast = useToast();

  const open = async () => {
    if (!isBridged()) {
      toast.push('Bridge offline — open from the desktop app', 'danger');
      return;
    }
    if (await openViaDialog()) {
      toast.push('Project loaded', 'ok');
      onOpened();
    }
  };

  const openRecent = async (p: ProjectRef) => {
    if (await openDir(p)) onOpened();
    else toast.push('Could not open project', 'danger');
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

      {error ? <div className="banner-error">{error}</div> : null}

      <Panel title="Recent dossiers" actions={<span className="label">{recents.length} ON FILE</span>}>
        {recents.length === 0 ? (
          <EmptyState
            code="NO RECENTS"
            title="No projects on file"
            hint="Open an existing conkernftz project folder to begin. Templates for fresh Solana and EVM collections arrive in a later phase."
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
