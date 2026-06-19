import { useMemo, useState } from 'react';
import { Panel } from '../components/Panel';
import { StageHeader } from '../components/StageHeader';
import { Button } from '../components/Button';
import { Field, Input, Select } from '../components/Field';
import { EmptyState } from '../components/EmptyState';
import { Skeleton } from '../components/Skeleton';
import { useToast } from '../components/Toast';
import { bridge } from '../lib/bridge';
import { useProject } from '../state/project';
import {
  FAL_CATALOG,
  buildPayload,
  defaultsFor,
  findModel,
  mergeCatalog,
  parseModels,
  type FalModel,
  type FalParam,
} from '../lib/falCatalog';

const KEY_STORE = 'cnftz:falKey';
const MODELS_STORE = 'cnftz:falModels';

interface GenResult {
  kind: 'image' | 'video';
  src: string;
}

function endpointFor(id: string): string {
  if (/^https?:\/\//i.test(id)) return id;
  if (/^fal-ai\//i.test(id)) return `https://fal.run/${id}`;
  return `https://fal.run/fal-ai/${id}`;
}

function collectResults(data: unknown): GenResult[] {
  const out: GenResult[] = [];
  const visit = (obj: unknown) => {
    if (!obj || typeof obj !== 'object') return;
    const o = obj as Record<string, unknown>;
    if (Array.isArray(o.images)) {
      for (const im of o.images as Array<Record<string, unknown>>) {
        if (im?.url) out.push({ kind: 'image', src: String(im.url) });
        else if (im?.b64_json) out.push({ kind: 'image', src: `data:image/png;base64,${String(im.b64_json)}` });
      }
    }
    if ((o.image as Record<string, unknown>)?.url) out.push({ kind: 'image', src: String((o.image as Record<string, unknown>).url) });
    if (typeof o.video_url === 'string') out.push({ kind: 'video', src: o.video_url });
    if ((o.video as Record<string, unknown>)?.url) out.push({ kind: 'video', src: String((o.video as Record<string, unknown>).url) });
    if (o.output) visit(o.output);
    if (o.result) visit(o.result);
    if (o.data) visit(o.data);
  };
  visit(data);
  return out;
}

async function toBase64(src: string): Promise<string> {
  if (src.startsWith('data:')) return src.split(',')[1] ?? '';
  const blob = await fetch(src).then((r) => r.blob());
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = reject;
    fr.readAsDataURL(blob);
  });
  return dataUrl.split(',')[1] ?? '';
}

function loadCustomModels(): FalModel[] {
  try {
    return parseModels(localStorage.getItem(MODELS_STORE) ?? '[]');
  } catch {
    return [];
  }
}

export function FalScreen() {
  const { project } = useProject();
  const toast = useToast();
  const [key, setKey] = useState<string>(() => {
    try {
      return localStorage.getItem(KEY_STORE) ?? '';
    } catch {
      return '';
    }
  });
  const [customModels, setCustomModels] = useState<FalModel[]>(loadCustomModels);
  const catalog = useMemo(() => mergeCatalog(FAL_CATALOG, customModels), [customModels]);

  const [modelId, setModelId] = useState('flux/dev');
  const [customId, setCustomId] = useState('');
  const selected = findModel(catalog, modelId);
  const [values, setValues] = useState<Record<string, string | number | boolean>>(() =>
    defaultsFor(findModel(mergeCatalog(FAL_CATALOG, loadCustomModels()), 'flux/dev')),
  );
  const [prompt, setPrompt] = useState('');
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<GenResult[]>([]);
  const [raw, setRaw] = useState<string | null>(null);
  const [importText, setImportText] = useState('');

  const imageModels = catalog.filter((m) => m.category === 'image');
  const videoModels = catalog.filter((m) => m.category === 'video');

  const onKey = (v: string) => {
    setKey(v);
    try {
      localStorage.setItem(KEY_STORE, v);
    } catch {
      /* ignore */
    }
  };

  const onModel = (id: string) => {
    setModelId(id);
    setValues(defaultsFor(findModel(catalog, id)));
  };
  const setValue = (k: string, v: string | number | boolean) => setValues((prev) => ({ ...prev, [k]: v }));

  const persistCustom = (next: FalModel[]) => {
    setCustomModels(next);
    try {
      localStorage.setItem(MODELS_STORE, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };

  const doImport = () => {
    const parsed = parseModels(importText);
    if (parsed.length === 0) {
      toast.push('No valid models found in that JSON', 'danger');
      return;
    }
    persistCustom(mergeCatalog(customModels, parsed));
    setImportText('');
    toast.push(`Imported ${parsed.length} model(s)`, 'ok');
  };

  const doExport = async () => {
    const json = JSON.stringify({ models: catalog }, null, 2);
    const fb = bridge();
    if (fb && project) {
      const r = await fb.saveJson('fal-models.json', { models: catalog });
      toast.push(r.ok ? 'Saved fal-models.json to project' : (r.error ?? 'Save failed'), r.ok ? 'ok' : 'danger');
    } else {
      setImportText(json);
      toast.push('Catalog JSON placed in the box below — copy it out', 'ok');
    }
  };

  const generate = async () => {
    if (!key.trim()) {
      toast.push('Add your fal.ai API key first', 'danger');
      return;
    }
    if (!prompt.trim()) {
      toast.push('Enter a prompt', 'danger');
      return;
    }
    const endpoint = endpointFor((customId.trim() || modelId).trim());
    const payload = buildPayload(selected, values, prompt);
    const headers = { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: `Key ${key.trim()}` };
    setBusy(true);
    setResults([]);
    setRaw(null);
    try {
      let resp = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify(payload) });
      if (!resp.ok) {
        const retry = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify({ input: payload }) }).catch(() => null);
        if (retry && retry.ok) resp = retry;
      }
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        const msg = (data && (data.error || data.message)) || `HTTP ${resp.status}`;
        toast.push(`fal.ai: ${msg}`, 'danger');
        setRaw(JSON.stringify(data, null, 2));
        return;
      }
      const found = collectResults(data);
      setResults(found);
      if (found.length) toast.push(`${found.length} result(s)`, 'ok');
      else setRaw(JSON.stringify(data, null, 2));
    } catch (e) {
      toast.push(String((e as Error)?.message ?? e), 'danger');
    } finally {
      setBusy(false);
    }
  };

  const save = async (src: string, idx: number) => {
    const fb = bridge();
    if (!fb || !project) {
      toast.push('Open a project to save outputs', 'danger');
      return;
    }
    try {
      const b64 = await toBase64(src);
      if (!b64) {
        toast.push('Could not read image', 'danger');
        return;
      }
      const name = `${(customId.trim() || modelId).replace(/\//g, '-')}-${Date.now()}-${idx + 1}.png`;
      const r = await fb.saveBase64(b64, `fal/${name}`);
      toast.push(r.ok ? `Saved fal/${name}` : (r.error ?? 'Save failed'), r.ok ? 'ok' : 'danger');
    } catch (e) {
      toast.push(String((e as Error)?.message ?? e), 'danger');
    }
  };

  const nImages = Math.max(1, Math.min(4, Number(values.num_images ?? 1) || 1));

  return (
    <div className="stack stagger">
      <StageHeader
        kicker="SYSTEM // GENERATION"
        title="Fal AI"
        actions={
          <div className="row">
            <Button onClick={() => bridge()?.openInExplorer('fal')} size="sm" variant="ghost">
              Open fal folder
            </Button>
          </div>
        }
      />

      <Panel title="Generate">
        <div className="stack">
          <Field label="fal.ai API key">
            <Input type="password" value={key} onChange={(e) => onKey(e.target.value)} placeholder="fal key (stored locally)" />
          </Field>
          <div className="grid cols-auto">
            <Field label="Model">
              <Select value={modelId} onChange={(e) => onModel(e.target.value)} aria-label="Model">
                <optgroup label="Image">
                  {imageModels.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Video">
                  {videoModels.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </optgroup>
              </Select>
            </Field>
            <Field label="Custom endpoint (advanced)">
              <Input value={customId} onChange={(e) => setCustomId(e.target.value)} placeholder="e.g. fal-ai/flux/dev" />
            </Field>
          </div>

          {selected?.description ? <span className="label muted">{selected.description}</span> : null}

          {selected && selected.params.length > 0 ? (
            <div className="grid cols-auto">
              {selected.params.map((p) => (
                <ParamField key={p.key} p={p} value={values[p.key]} onChange={(v) => setValue(p.key, v)} />
              ))}
            </div>
          ) : null}

          <Field label="Prompt">
            <textarea className="textarea" rows={3} value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Describe the output…" aria-label="Prompt" />
          </Field>
          <div className="row">
            <Button variant="primary" onClick={generate} disabled={busy}>
              {busy ? 'Generating…' : 'Generate'}
            </Button>
            <span className="label muted">Requests go directly to fal.run with your key.</span>
          </div>
        </div>
      </Panel>

      <Panel title="Output" actions={results.length ? <span className="label">{results.length} RESULTS</span> : null}>
        {busy ? (
          <div className="thumb-grid">
            {Array.from({ length: nImages }).map((_, i) => (
              <Skeleton key={i} h={150} />
            ))}
          </div>
        ) : results.length ? (
          <div className="thumb-grid">
            {results.map((r, i) =>
              r.kind === 'video' ? (
                <video key={i} className="thumb" src={r.src} controls loop muted />
              ) : (
                <div key={i} className="stack" style={{ gap: 6 }}>
                  <img className="thumb" src={r.src} alt={`Result ${i + 1}`} loading="lazy" />
                  <Button size="sm" onClick={() => save(r.src, i)}>
                    Save
                  </Button>
                </div>
              ),
            )}
          </div>
        ) : raw ? (
          <pre className="audit-out mono">{raw}</pre>
        ) : (
          <EmptyState code="IDLE" title="No output yet" hint="Pick a model, set its parameters, and Generate. Image results can be saved into the project's fal/ folder." />
        )}
      </Panel>

      <Panel
        title="Model catalog"
        actions={
          <Button size="sm" variant="ghost" onClick={doExport}>
            Export catalog
          </Button>
        }
      >
        <div className="stack">
          <span className="label muted">
            Add custom fal models (persisted locally). Paste a JSON array or <code>{'{ "models": [...] }'}</code> of
            {' '}<code>{'{ id, label, category, params }'}</code> and Import.
          </span>
          <textarea
            className="textarea"
            rows={5}
            spellCheck={false}
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            placeholder='[{ "id": "fal-ai/flux/dev", "label": "My FLUX", "category": "image", "params": [] }]'
            aria-label="Import models JSON"
          />
          <div className="row">
            <Button size="sm" onClick={doImport}>
              Import models
            </Button>
            {customModels.length ? (
              <Button size="sm" variant="danger" onClick={() => persistCustom([])}>
                Clear custom ({customModels.length})
              </Button>
            ) : null}
          </div>
        </div>
      </Panel>
    </div>
  );
}

function ParamField({ p, value, onChange }: { p: FalParam; value: string | number | boolean | undefined; onChange: (v: string | number | boolean) => void }) {
  if (p.type === 'select') {
    return (
      <Field label={p.label}>
        <Select value={String(value ?? p.default ?? '')} onChange={(e) => onChange(e.target.value)} aria-label={p.label}>
          {(p.options ?? []).map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </Select>
      </Field>
    );
  }
  if (p.type === 'bool') {
    return (
      <label className="row">
        <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} aria-label={p.label} />
        <span className="label">{p.label}</span>
      </label>
    );
  }
  return (
    <Field label={p.label}>
      <Input
        type={p.type === 'number' ? 'number' : 'text'}
        min={p.min}
        max={p.max}
        step={p.step}
        value={value === undefined ? '' : String(value)}
        onChange={(e) => onChange(e.target.value)}
        aria-label={p.label}
      />
    </Field>
  );
}
