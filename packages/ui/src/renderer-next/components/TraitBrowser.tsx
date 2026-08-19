import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Badge } from './Badge';
import { Button } from './Button';
import { Input } from './Field';
import { useToast } from './Toast';
import { bridge } from '../lib/bridge';
import { isCatalogImage, setWeight as setFilenameWeight } from '../lib/rename';
import { computeTraitTable, formatPct, type TraitRow } from '../lib/traits';
import type { LayerCfg } from '../state/project';

function join(dir: string, name: string): string {
  return `${dir.replace(/[\\/]+$/, '')}/${name}`;
}

function normalizedWeight(value: number): string {
  // String() removes input-only formatting (such as trailing zeroes) from validated integers.
  return String(value);
}

function editorId(file: string): string {
  // Percent-encoding is injective and valid in an HTML id. Do not substitute characters here:
  // substitution can make distinct filenames such as "%5F" and "_5F" collide.
  return `trait-rarity-${encodeURIComponent(file)}`;
}

function dirname(path: string): string {
  const index = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
  return index < 0 ? '' : path.slice(0, index);
}

/** Expanded view of a single layer: every asset as a thumbnail with its rarity weight + drop %. */
export function TraitBrowser({
  layer,
  delimiter,
  defaultWeight,
  scopeKey,
  onFilesChange,
}: {
  layer: LayerCfg;
  delimiter: string;
  defaultWeight: number;
  /** Project identity; invalidates work even when a replacement project reuses this path. */
  scopeKey: string;
  /** Reports the directory listing after a successful refresh; it never changes foundry config. */
  onFilesChange?: (files: string[]) => void;
}) {
  const toast = useToast();
  const [files, setFiles] = useState<string[]>([]);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [editingFile, setEditingFile] = useState<string | null>(null);
  const [draftWeight, setDraftWeight] = useState('');
  const loadId = useRef(0);
  const mountedRef = useRef(false);
  const operationVersion = useRef(0);
  const focusFileRef = useRef<string | null>(null);
  const onFilesChangeRef = useRef(onFilesChange);

  useEffect(() => {
    onFilesChangeRef.current = onFilesChange;
  }, [onFilesChange]);

  const isCurrent = useCallback(
    (version: number) => mountedRef.current && operationVersion.current === version,
    [],
  );

  /** Reload disk truth; stale/unmounted operations leave the current layer untouched. */
  const load = useCallback(
    async (version = operationVersion.current): Promise<string[] | null> => {
      const fb = bridge();
      const id = ++loadId.current;
      if (!fb) {
        if (isCurrent(version)) {
          setFiles([]);
          setThumbs({});
          setLoading(false);
        }
        return null;
      }
      if (!isCurrent(version)) return null;
      setLoading(true);
      let names: string[];
      try {
        const dir = await fb.listDir(layer.path);
        if (!dir.ok || !Array.isArray(dir.items))
          throw new Error(dir.error ?? 'Unable to read layer directory');
        names = dir.items.filter(isCatalogImage);
      } catch {
        if (id === loadId.current && isCurrent(version)) setLoading(false);
        return null;
      }

      const entries: Record<string, string> = {};
      await Promise.all(
        names.map(async (name) => {
          try {
            const r = await fb.readFileBase64(join(layer.path, name));
            if (r.ok && r.base64)
              entries[name] = `data:${r.mime || 'image/png'};base64,${r.base64}`;
          } catch {
            /* skip unreadable asset */
          }
        }),
      );
      if (id !== loadId.current || !isCurrent(version)) return null;
      setFiles(names);
      setThumbs(entries);
      setLoading(false);
      onFilesChangeRef.current?.(names);
      return names;
    },
    [isCurrent, layer.path, scopeKey],
  );

  useEffect(() => {
    mountedRef.current = true;
    const version = ++operationVersion.current;
    setBusy(false);
    setEditingFile(null);
    void load(version);
    return () => {
      operationVersion.current++;
      loadId.current++;
      mountedRef.current = false;
    };
  }, [load]);

  useEffect(() => {
    const file = focusFileRef.current;
    if (!file || editingFile || !files.includes(file)) return;
    const button = document.getElementById(`${editorId(file)}-edit`);
    if (button instanceof HTMLButtonElement) {
      button.focus();
      focusFileRef.current = null;
    }
  }, [editingFile, files]);

  const table = useMemo(
    () =>
      computeTraitTable(files, { delimiter, defaultWeight, uniform: layer.rarity === 'uniform' }),
    [files, delimiter, defaultWeight, layer.rarity],
  );
  // Rarest first — the view artists actually scan for when balancing a drop.
  const rows = useMemo(
    () => [...table.rows].sort((a, b) => a.probability - b.probability),
    [table.rows],
  );

  const openEditor = (row: TraitRow) => {
    if (busy) return;
    if (editingFile === row.file) {
      setEditingFile(null);
      return;
    }
    setEditingFile(row.file);
    setDraftWeight(normalizedWeight(row.weight));
  };

  const apply = async (row: TraitRow) => {
    const version = operationVersion.current;
    const weight = Number(draftWeight);
    if (!Number.isInteger(weight) || weight <= 0 || !isCurrent(version)) return;
    const target = setFilenameWeight(row.file, weight, delimiter);
    const from = join(layer.path, row.file);
    const to = join(layer.path, target);
    const unsafeTarget = !delimiter || /[\0\\/]/.test(delimiter) || dirname(from) !== dirname(to);
    if (target === row.file || layer.rarity === 'uniform' || busy || unsafeTarget) return;
    if (
      files.some(
        (file) => file !== row.file && file.toLocaleLowerCase() === target.toLocaleLowerCase(),
      )
    )
      return;

    const fb = bridge();
    if (!fb) {
      toast.push('Bridge offline — rarity was not changed', 'danger');
      return;
    }
    setBusy(true);
    try {
      // These are bridge arguments, never a shell command: quotes/spaces in filenames remain literal.
      const result = await fb.renameFileExact(from, to);
      if (!isCurrent(version)) return;
      if (!result.ok) {
        await load(version);
        if (!isCurrent(version)) return;
        toast.push(result.error ?? 'Rename failed — rarity was not changed', 'danger');
        return;
      }
      if (result.renamed === 0) {
        toast.push('No file was renamed. Refresh the layer and try again.', 'danger');
        return;
      }
      if (result.renamed !== 1) {
        toast.push(
          'Rename returned an unexpected count. Refresh the layer before trying again.',
          'danger',
        );
        return;
      }
      const refreshed = await load(version);
      if (!isCurrent(version)) return;
      if (!refreshed) {
        toast.push(
          'Rarity changed, but the layer could not be refreshed. Reopen traits to verify it.',
          'danger',
        );
        return;
      }
      if (!refreshed.includes(target) || refreshed.includes(row.file)) {
        toast.push(
          `Rename did not produce ${target}. The layer was refreshed; check the asset name before trying again.`,
          'danger',
        );
        return;
      }
      focusFileRef.current = target;
      setEditingFile(null);
      toast.push(`Rarity updated: ${normalizedWeight(weight)}`, 'ok');
    } catch (error) {
      if (isCurrent(version)) toast.push(String((error as Error)?.message ?? error), 'danger');
    } finally {
      if (isCurrent(version)) setBusy(false);
    }
  };

  if (loading) return <span className="label muted">Loading assets…</span>;
  if (files.length === 0)
    return <span className="label muted">No image files in this layer (or bridge offline).</span>;

  return (
    <div className="stack">
      <div className="row spread trait-browser__summary">
        <span className="label">{table.rows.length} ASSETS · rarest first</span>
        <span className="label muted">
          {layer.rarity === 'uniform' ? 'uniform weights' : `Σ weight ${table.total}`}
        </span>
      </div>
      {layer.rarity === 'uniform' ? (
        <p className="trait-browser__notice" role="status">
          Uniform rarity ignores filename weights. Switch this layer’s rarity menu to{' '}
          <span className="mono">filename</span> to edit per-trait odds.
        </p>
      ) : (
        <p className="trait-browser__notice">
          Rarity edits rename the asset immediately; they do not change foundry config.
        </p>
      )}
      <div className="trait-grid">
        {rows.map((row) => {
          const isEditing = editingFile === row.file;
          const weight = Number(draftWeight);
          const validWeight = Number.isInteger(weight) && weight > 0;
          const target = validWeight ? setFilenameWeight(row.file, weight, delimiter) : row.file;
          const from = join(layer.path, row.file);
          const to = join(layer.path, target);
          const unsafeTarget =
            !delimiter || /[\0\\/]/.test(delimiter) || dirname(from) !== dirname(to);
          const unchanged = validWeight && target === row.file;
          const collision =
            validWeight &&
            files.some(
              (file) =>
                file !== row.file && file.toLocaleLowerCase() === target.toLocaleLowerCase(),
            );
          const id = editorId(row.file);
          const error = !validWeight
            ? 'Enter a positive whole-number weight.'
            : unsafeTarget
              ? 'Choose a filename delimiter without slashes or control characters in the layer settings.'
              : collision
                ? `Another asset already uses ${target}.`
                : null;
          return (
            <div className="trait-card" key={row.file}>
              {thumbs[row.file] ? (
                <img className="trait-card__art" src={thumbs[row.file]} alt={row.value} />
              ) : (
                <span className="trait-card__art trait-card__art--ph" aria-hidden />
              )}
              <div className="trait-card__meta">
                <span className="trait-card__name" title={row.file}>
                  {row.value}
                </span>
                <span className="row spread">
                  <Badge tone="accent">{formatPct(row.probability)}</Badge>
                  <span className="mono muted">w{normalizedWeight(row.weight)}</span>
                </span>
                <Button
                  size="sm"
                  className="trait-card__edit"
                  id={`${id}-edit`}
                  aria-expanded={isEditing}
                  aria-controls={id}
                  aria-label={`Edit rarity for ${row.file}`}
                  disabled={busy}
                  onClick={() => openEditor(row)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      openEditor(row);
                    }
                  }}
                >
                  Edit rarity
                </Button>
                {isEditing ? (
                  <div
                    className="trait-card__editor"
                    id={id}
                    aria-label={`Rarity editor for ${row.file}`}
                  >
                    <label className="trait-card__weight-label" htmlFor={`${id}-weight`}>
                      Weight
                    </label>
                    <Input
                      id={`${id}-weight`}
                      type="number"
                      min="1"
                      step="1"
                      inputMode="numeric"
                      value={draftWeight}
                      disabled={layer.rarity === 'uniform' || busy || unsafeTarget}
                      invalid={!validWeight || unsafeTarget}
                      aria-label={`Rarity weight for ${row.file}`}
                      onChange={(event) => setDraftWeight(event.target.value)}
                    />
                    <span className="trait-card__editor-meta">
                      {layer.rarity === 'uniform'
                        ? 'Filename weights are ignored in uniform mode.'
                        : `New file: ${target}`}
                    </span>
                    {unchanged ? (
                      <span className="trait-card__editor-hint">
                        Enter a new weight to change rarity.
                      </span>
                    ) : null}
                    {error ? (
                      <span className="trait-card__editor-error" role="alert">
                        {error}
                      </span>
                    ) : null}
                    <Button
                      size="sm"
                      variant="primary"
                      loading={busy}
                      disabled={
                        layer.rarity === 'uniform' ||
                        !validWeight ||
                        unchanged ||
                        collision ||
                        unsafeTarget
                      }
                      aria-label={`Apply rarity for ${row.file}`}
                      onClick={() => void apply(row)}
                    >
                      Apply
                    </Button>
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
