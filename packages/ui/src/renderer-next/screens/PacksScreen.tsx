import { useEffect, useState } from 'react';
import { Panel } from '../components/Panel';
import { StageHeader } from '../components/StageHeader';
import { Button } from '../components/Button';
import { Badge } from '../components/Badge';
import { EmptyState } from '../components/EmptyState';
import { useToast } from '../components/Toast';
import { isBridged } from '../lib/bridge';
import { listPacks, readPackDataUrl, importPack, deletePack, type PackEntry, type PackKind } from '../lib/packLibrary';

export function PacksScreen() {
  const toast = useToast();
  const [packs, setPacks] = useState<PackEntry[]>([]);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<PackKind | null>(null);

  const refresh = async (): Promise<void> => {
    setLoading(true);
    const list = await listPacks();
    setPacks(list);
    setLoading(false);
    const next: Record<string, string> = {};
    await Promise.all(
      list.map(async (p) => {
        const url = await readPackDataUrl(p.id);
        if (url) next[p.id] = url;
      }),
    );
    setThumbs(next);
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const add = async (kind: PackKind): Promise<void> => {
    if (!isBridged()) {
      toast.push('Pack library runs in the desktop app', 'danger');
      return;
    }
    setBusy(kind);
    try {
      const p = await importPack(kind);
      if (p) {
        toast.push(`Added “${p.name}” to the library`, 'ok');
        await refresh();
      }
    } finally {
      setBusy(null);
    }
  };

  const remove = async (p: PackEntry): Promise<void> => {
    if (await deletePack(p.id)) {
      toast.push(`Removed “${p.name}”`, 'ok');
      await refresh();
    } else {
      toast.push('Could not remove that pack', 'danger');
    }
  };

  const section = (kind: PackKind, title: string, addLabel: string) => {
    const items = packs.filter((p) => p.kind === kind);
    return (
      <Panel
        title={title}
        actions={
          <Button size="sm" onClick={() => add(kind)} loading={busy === kind} disabled={!!busy || !isBridged()}>
            + {addLabel}
          </Button>
        }
      >
        {items.length === 0 ? (
          <EmptyState code="EMPTY" title={`No ${addLabel.toLowerCase()}s yet`} hint={`Add ${addLabel.toLowerCase()} art to make it available to every project.`} />
        ) : (
          <div className="pack-grid">
            {items.map((p) => (
              <div className="pack-card" key={p.id}>
                {thumbs[p.id] ? (
                  <img className="pack-card__art" src={thumbs[p.id]} alt={p.name} />
                ) : (
                  <span className="pack-card__art pack-card__art--ph" aria-hidden />
                )}
                <div className="pack-card__meta">
                  <span className="pack-card__name" title={`${p.name} · ${p.id}`}>
                    {p.name}
                  </span>
                  <span className="row spread">
                    <Badge tone={p.builtin ? 'accent' : 'default'}>{p.builtin ? 'BUILT-IN' : 'CUSTOM'}</Badge>
                    {!p.builtin ? (
                      <Button size="sm" variant="danger" icon onClick={() => remove(p)} aria-label={`Delete ${p.name}`}>
                        ✕
                      </Button>
                    ) : null}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>
    );
  };

  return (
    <div className="stack stagger">
      <StageHeader
        kicker="SYSTEM // LIBRARY"
        title="Packs"
        actions={
          <Button size="sm" onClick={refresh} disabled={!isBridged()}>
            Refresh
          </Button>
        }
      />
      <span className="label muted">
        App-level pack &amp; card-back library — shared across every project. Add finished art once and reference it from
        any collection's Mint FX. Stored on this machine, so it persists across projects and updates.
      </span>

      {!isBridged() ? (
        <EmptyState code="DESKTOP ONLY" title="Pack library runs in the desktop app" hint="Launch the ConkerNFTZ app to manage the pack library." />
      ) : loading ? (
        <span className="label muted">Loading library…</span>
      ) : (
        <>
          {section('pack', 'Packs', 'Pack')}
          {section('back', 'Card backs', 'Card back')}
        </>
      )}
    </div>
  );
}
