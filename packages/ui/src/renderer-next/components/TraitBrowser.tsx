import { useEffect, useMemo, useState } from 'react';
import { Badge } from './Badge';
import { bridge } from '../lib/bridge';
import { isImage } from '../lib/rename';
import { computeTraitTable, formatPct } from '../lib/traits';
import type { LayerCfg } from '../state/project';

function join(dir: string, name: string): string {
  return `${dir.replace(/[\\/]+$/, '')}/${name}`;
}

/** Expanded view of a single layer: every asset as a thumbnail with its rarity weight + drop %. */
export function TraitBrowser({
  layer,
  delimiter,
  defaultWeight,
}: {
  layer: LayerCfg;
  delimiter: string;
  defaultWeight: number;
}) {
  const [files, setFiles] = useState<string[]>([]);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fb = bridge();
    if (!fb) {
      setFiles([]);
      setThumbs({});
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      let names: string[] = [];
      try {
        const dir = await fb.listDir(layer.path);
        names = dir.ok && Array.isArray(dir.items) ? dir.items.filter(isImage) : [];
      } catch {
        names = [];
      }
      if (cancelled) return;
      setFiles(names);
      const entries: Record<string, string> = {};
      await Promise.all(
        names.map(async (name) => {
          try {
            const r = await fb.readFileBase64(join(layer.path, name));
            if (r.ok && r.base64) entries[name] = `data:${r.mime || 'image/png'};base64,${r.base64}`;
          } catch {
            /* skip unreadable asset */
          }
        }),
      );
      if (!cancelled) {
        setThumbs(entries);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [layer.path]);

  const table = useMemo(
    () => computeTraitTable(files, { delimiter, defaultWeight, uniform: layer.rarity === 'uniform' }),
    [files, delimiter, defaultWeight, layer.rarity],
  );
  // Rarest first — the view artists actually scan for when balancing a drop.
  const rows = useMemo(() => [...table.rows].sort((a, b) => a.probability - b.probability), [table.rows]);

  if (loading) return <span className="label muted">Loading assets…</span>;
  if (files.length === 0) return <span className="label muted">No image files in this layer (or bridge offline).</span>;

  return (
    <div className="stack">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span className="label">{table.rows.length} ASSETS · rarest first</span>
        <span className="label muted">{layer.rarity === 'uniform' ? 'uniform weights' : `Σ weight ${table.total}`}</span>
      </div>
      <div className="trait-grid">
        {rows.map((r) => (
          <div className="trait-card" key={r.file}>
            {thumbs[r.file] ? (
              <img className="trait-card__art" src={thumbs[r.file]} alt={r.value} />
            ) : (
              <span className="trait-card__art trait-card__art--ph" aria-hidden />
            )}
            <div className="trait-card__meta">
              <span className="trait-card__name" title={r.file}>
                {r.value}
              </span>
              <span className="row" style={{ justifyContent: 'space-between' }}>
                <Badge tone="accent">{formatPct(r.probability)}</Badge>
                <span className="mono muted">w{r.weight}</span>
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
