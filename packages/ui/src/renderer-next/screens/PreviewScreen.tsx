import { useState } from 'react';
import { Panel } from '../components/Panel';
import { Button } from '../components/Button';
import { Field, Input } from '../components/Field';
import { EmptyState } from '../components/EmptyState';
import { Skeleton } from '../components/Skeleton';
import { useToast } from '../components/Toast';
import { bridge, isBridged } from '../lib/bridge';
import { useProject } from '../state/project';

export function PreviewScreen() {
  const { project, config } = useProject();
  const toast = useToast();
  const [count, setCount] = useState(6);
  const [images, setImages] = useState<string[]>([]);
  const [format, setFormat] = useState<'png' | 'webp'>('png');
  const [busy, setBusy] = useState(false);

  const generate = async () => {
    const fb = bridge();
    if (!fb) {
      toast.push('Bridge offline — live preview runs in the desktop app', 'danger');
      return;
    }
    if (!config) {
      toast.push('Open a project first', 'danger');
      return;
    }
    const n = Math.max(1, Math.min(12, count));
    setBusy(true);
    try {
      const seed = `studio-next:${Date.now().toString(36)}`;
      const r = await fb.previewLive(config, n, seed);
      if (r.ok && Array.isArray(r.images)) {
        setImages(r.images);
        setFormat(r.format === 'webp' ? 'webp' : 'png');
      } else {
        toast.push(r.error ?? 'Preview failed', 'danger');
      }
    } catch (e) {
      toast.push(String((e as Error)?.message ?? e), 'danger');
    } finally {
      setBusy(false);
    }
  };

  const mime = format === 'webp' ? 'image/webp' : 'image/png';

  return (
    <div className="stack stagger">
      <div className="main-head">
        <div>
          <div className="label main-kicker">STAGE 02 // INSPECTION</div>
          <h1 className="main-title">Preview</h1>
        </div>
        <div className="row">
          <Field label="Count">
            <Input
              type="number"
              min="1"
              max="12"
              value={count}
              onChange={(e) => setCount(Number(e.target.value) || 1)}
              style={{ width: 72 }}
            />
          </Field>
          <Button variant="primary" onClick={generate} disabled={busy || !isBridged()}>
            {busy ? 'Generating…' : 'Generate previews'}
          </Button>
        </div>
      </div>

      <Panel title="Live preview" actions={<span className="label">{images.length} FRAMES</span>}>
        {!project ? (
          <EmptyState code="NO PROJECT" title="No project loaded" hint="Open a project to render live previews." />
        ) : busy ? (
          <div className="thumb-grid">
            {Array.from({ length: Math.max(1, Math.min(12, count)) }).map((_, i) => (
              <Skeleton key={i} h={150} />
            ))}
          </div>
        ) : images.length === 0 ? (
          <EmptyState
            code="IDLE"
            title="No previews yet"
            hint={
              isBridged()
                ? 'Generate a fresh random set rendered straight from the engine (new seed each time).'
                : 'Bridge offline — live preview runs inside the desktop app.'
            }
            action={
              <Button variant="primary" onClick={generate} disabled={!isBridged()}>
                Generate previews
              </Button>
            }
          />
        ) : (
          <div className="thumb-grid">
            {images.map((b64, i) => (
              <img key={i} className="thumb" src={`data:${mime};base64,${b64}`} alt={`Preview ${i + 1}`} loading="lazy" />
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
