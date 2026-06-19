import { useState } from 'react';
import { Panel } from '../components/Panel';
import { Button } from '../components/Button';
import { Field, Input } from '../components/Field';
import { EmptyState } from '../components/EmptyState';
import { Skeleton } from '../components/Skeleton';
import { Lightbox } from '../components/Lightbox';
import { useToast } from '../components/Toast';
import { bridge, isBridged } from '../lib/bridge';
import { useProject } from '../state/project';

/** Empty seed input = a fresh random seed each run; a set value reproduces the same set. */
export function resolvePreviewSeed(input: string): string {
  const trimmed = input.trim();
  return trimmed || `studio-next:${Date.now().toString(36)}`;
}

export function PreviewScreen() {
  const { project, config } = useProject();
  const toast = useToast();
  const [count, setCount] = useState(6);
  const [seed, setSeed] = useState('');
  const [lastSeed, setLastSeed] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [format, setFormat] = useState<'png' | 'webp'>('png');
  const [busy, setBusy] = useState(false);
  const [lightbox, setLightbox] = useState<number | null>(null);

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
    const usedSeed = resolvePreviewSeed(seed);
    setBusy(true);
    try {
      const r = await fb.previewLive(config, n, usedSeed);
      if (r.ok && Array.isArray(r.images)) {
        setImages(r.images);
        setLastSeed(usedSeed);
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

  const lockSeed = () => {
    setSeed(lastSeed);
    toast.push('Seed copied to the field — regenerate to reproduce this set', 'ok');
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
          <Field label="Seed">
            <Input
              value={seed}
              onChange={(e) => setSeed(e.target.value)}
              placeholder="random"
              aria-label="Seed"
              style={{ width: 168 }}
            />
          </Field>
          <Button variant="primary" onClick={generate} disabled={busy || !isBridged()}>
            {busy ? 'Generating…' : 'Generate previews'}
          </Button>
        </div>
      </div>

      <Panel
        title="Live preview"
        actions={
          <div className="row">
            {lastSeed ? (
              <button
                type="button"
                className="seed-chip mono"
                onClick={lockSeed}
                title="Click to copy this seed into the field, then regenerate to reproduce this exact set"
              >
                SEED {lastSeed}
              </button>
            ) : null}
            <span className="label">{images.length} FRAMES</span>
          </div>
        }
      >
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
                ? 'Generate a fresh random set rendered straight from the engine. Set a seed to reproduce a specific set.'
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
              <button
                key={i}
                type="button"
                className="thumb-btn"
                onClick={() => setLightbox(i)}
                aria-label={`Inspect preview ${i + 1}`}
              >
                <img className="thumb" src={`data:${mime};base64,${b64}`} alt={`Preview ${i + 1}`} loading="lazy" />
              </button>
            ))}
          </div>
        )}
      </Panel>

      <Lightbox
        images={images}
        index={lightbox}
        onIndexChange={setLightbox}
        onClose={() => setLightbox(null)}
        mime={mime}
        labelPrefix="Preview"
      />
    </div>
  );
}
