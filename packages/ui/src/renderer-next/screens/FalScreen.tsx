import { useState } from 'react';
import { Panel } from '../components/Panel';
import { Button } from '../components/Button';
import { Field, Input, Select } from '../components/Field';
import { EmptyState } from '../components/EmptyState';
import { Skeleton } from '../components/Skeleton';
import { useToast } from '../components/Toast';
import { bridge } from '../lib/bridge';
import { useProject } from '../state/project';

const KEY_STORE = 'cnftz:falKey';
const MODELS = ['flux/dev', 'flux/schnell', 'flux-pro/v1.0', 'recraft-v3', 'stable-diffusion-v35-large'];
const SIZES = ['square_hd', 'square', 'landscape_4_3', 'landscape_16_9', 'portrait_4_3', 'portrait_16_9'];

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
  const [model, setModel] = useState('flux/dev');
  const [prompt, setPrompt] = useState('');
  const [size, setSize] = useState('square_hd');
  const [num, setNum] = useState(1);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<GenResult[]>([]);
  const [raw, setRaw] = useState<string | null>(null);

  const onKey = (v: string) => {
    setKey(v);
    try {
      localStorage.setItem(KEY_STORE, v);
    } catch {
      /* ignore */
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
    const endpoint = endpointFor(model.trim());
    const payload = { prompt, image_size: size, num_images: Math.max(1, Math.min(4, num)) };
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
      const name = `${model.replace(/\//g, '-')}-${Date.now()}-${idx + 1}.png`;
      const r = await fb.saveBase64(b64, `fal/${name}`);
      toast.push(r.ok ? `Saved fal/${name}` : (r.error ?? 'Save failed'), r.ok ? 'ok' : 'danger');
    } catch (e) {
      toast.push(String((e as Error)?.message ?? e), 'danger');
    }
  };

  return (
    <div className="stack stagger">
      <div className="main-head">
        <div>
          <div className="label main-kicker">SYSTEM // GENERATION</div>
          <h1 className="main-title">Fal AI</h1>
        </div>
        <div className="row">
          <Button onClick={() => bridge()?.openInExplorer('fal')} size="sm" variant="ghost">
            Open fal folder
          </Button>
        </div>
      </div>

      <Panel title="Quick image">
        <div className="stack">
          <Field label="fal.ai API key">
            <Input type="password" value={key} onChange={(e) => onKey(e.target.value)} placeholder="fal key (stored locally)" />
          </Field>
          <div className="grid cols-auto">
            <Field label="Model">
              <Input list="fal-models" value={model} onChange={(e) => setModel(e.target.value)} placeholder="flux/dev" />
              <datalist id="fal-models">
                {MODELS.map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
            </Field>
            <Field label="Image size">
              <Select value={size} onChange={(e) => setSize(e.target.value)} aria-label="Image size">
                {SIZES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Images">
              <Input type="number" min="1" max="4" value={num} onChange={(e) => setNum(Number(e.target.value) || 1)} />
            </Field>
          </div>
          <Field label="Prompt">
            <textarea className="textarea" rows={3} value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Describe the image…" aria-label="Prompt" />
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
            {Array.from({ length: Math.max(1, Math.min(4, num)) }).map((_, i) => (
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
          <EmptyState code="IDLE" title="No output yet" hint="Enter a prompt and Generate. Image results can be saved into the project's fal/ folder." />
        )}
      </Panel>
    </div>
  );
}
