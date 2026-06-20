import { useState } from 'react';
import { Panel } from '../components/Panel';
import { StageHeader } from '../components/StageHeader';
import { Button } from '../components/Button';
import { Badge } from '../components/Badge';
import { Dialog } from '../components/Dialog';
import { Field, Input, Select } from '../components/Field';
import { EmptyState } from '../components/EmptyState';
import { useToast } from '../components/Toast';
import { isBridged } from '../lib/bridge';
import { deriveSymbol } from '../lib/newProject';
import { useProject, type ProjectRef } from '../state/project';

export function ProjectsScreen({ onOpened }: { onOpened: () => void }) {
  const { recents, openViaDialog, openDir, createProject, error } = useProject();
  const toast = useToast();
  const [newOpen, setNewOpen] = useState(false);
  const [name, setName] = useState('');
  const [symbol, setSymbol] = useState('');
  const [editionSize, setEditionSize] = useState(100);
  const [chain, setChain] = useState<'evm' | 'solana'>('evm');
  const [creating, setCreating] = useState(false);

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

  const create = async () => {
    if (!isBridged()) {
      toast.push('Bridge offline — create from the desktop app', 'danger');
      return;
    }
    if (!name.trim()) return;
    setCreating(true);
    try {
      const ok = await createProject({ name, symbol, chain, editionSize });
      if (ok) {
        toast.push('Project created', 'ok');
        setNewOpen(false);
        onOpened();
      }
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="stack stagger">
      <StageHeader
        kicker="STAGE 00 // INTAKE"
        title="Projects"
        actions={
          <div className="row">
            <Badge tone={isBridged() ? 'ok' : 'default'}>{isBridged() ? 'BRIDGE ONLINE' : 'BRIDGE OFFLINE'}</Badge>
            <Button onClick={open}>Open project…</Button>
            <Button variant="primary" onClick={() => setNewOpen(true)} disabled={!isBridged()}>
              New project
            </Button>
          </div>
        }
      />

      {error && !newOpen ? <div className="banner-error">{error}</div> : null}

      {recents.length === 0 ? (
        // First run: let the empty state be the hero, not a "0 ON FILE" table.
        <EmptyState
          code="NO RECENTS"
          title="Start your first collection"
          hint="Scaffold a fresh collection with New project, or open an existing conkernftz project folder."
          action={
            <div className="row">
              <Button variant="primary" onClick={() => setNewOpen(true)} disabled={!isBridged()}>
                New project
              </Button>
              <Button onClick={open}>Open project…</Button>
            </div>
          }
        />
      ) : (
        <Panel title="Recent dossiers" actions={<span className="label">{recents.length} ON FILE</span>}>
          <div className="proj-grid">
            {recents.map((p) => (
              <button key={p.dir} type="button" className="proj-card" onClick={() => openRecent(p)}>
                <span className="label">DOSSIER</span>
                <span className="proj-name">{p.name}</span>
                <span className="proj-path" title={p.dir}>{p.dir}</span>
              </button>
            ))}
            <button type="button" className="proj-card proj-card--new" onClick={() => setNewOpen(true)}>
              <span style={{ fontSize: 28, lineHeight: 1 }}>+</span>
              <span className="label">NEW PROJECT</span>
            </button>
          </div>
        </Panel>
      )}

      <Dialog open={newOpen} title="New collection" onClose={() => setNewOpen(false)}>
        <div className="stack">
          <p className="muted">
            Scaffolds a starter <span className="mono">foundry.config.json</span> and empty layer folders in a folder you
            choose, then opens it. Drop your art into the layer folders next.
          </p>
          <div className="grid cols-auto">
            <Field label="Collection name">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Specimens"
                aria-label="Collection name"
              />
            </Field>
            <Field label="Symbol">
              <Input
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                placeholder={name.trim() ? deriveSymbol(name) : 'auto'}
                aria-label="Symbol"
              />
            </Field>
            <Field label="Edition size">
              <Input
                type="number"
                min="1"
                value={editionSize}
                onChange={(e) => setEditionSize(Number(e.target.value) || 1)}
                aria-label="Edition size"
              />
            </Field>
            <Field label="Chain">
              <Select value={chain} onChange={(e) => setChain(e.target.value as 'evm' | 'solana')} aria-label="Chain">
                <option value="evm">EVM (Base / Ethereum)</option>
                <option value="solana">Solana</option>
              </Select>
            </Field>
          </div>
          {error ? <div className="banner-error">{error}</div> : null}
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <Button variant="ghost" onClick={() => setNewOpen(false)} disabled={creating}>
              Cancel
            </Button>
            <Button variant="primary" onClick={create} disabled={creating || !name.trim()}>
              {creating ? 'Creating…' : 'Choose folder & create'}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
