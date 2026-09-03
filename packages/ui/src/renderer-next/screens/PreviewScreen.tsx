import { useRef, useState, type KeyboardEvent, type MouseEvent } from 'react';
import { Panel } from '../components/Panel';
import { StageHeader } from '../components/StageHeader';
import { Button } from '../components/Button';
import { Field, Input, Select } from '../components/Field';
import { EmptyState } from '../components/EmptyState';
import { Skeleton } from '../components/Skeleton';
import { Lightbox } from '../components/Lightbox';
import { useToast } from '../components/Toast';
import { bridge, isBridged } from '../lib/bridge';
import { cx } from '../lib/cx';
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
  const [selected, setSelected] = useState(0);
  const [fit, setFit] = useState<'contain' | 'cover' | 'actual'>('cover');
  const [background, setBackground] = useState<'checker' | 'dark' | 'light'>('checker');
  const [position, setPosition] = useState({ x: 50, y: 50 });
  const drag = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);

  const generate = async (seedOverride?: string) => {
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
    const usedSeed = seedOverride ?? resolvePreviewSeed(seed);
    setBusy(true);
    try {
      const r = await fb.previewLive(config, n, usedSeed);
      if (r.ok && Array.isArray(r.images)) {
        setImages(r.images);
        setLastSeed(usedSeed);
        setFormat(r.format === 'webp' ? 'webp' : 'png');
        setSelected(0);
        setPosition({ x: 50, y: 50 });
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

  const reroll = () => void generate(resolvePreviewSeed(''));
  const clampPosition = (value: number) => Math.max(0, Math.min(100, value));
  const startDrag = (event: MouseEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    drag.current = { startX: event.clientX, startY: event.clientY, originX: position.x, originY: position.y };
    event.preventDefault();
  };
  const moveDrag = (event: MouseEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    setPosition({
      x: clampPosition(drag.current.originX + (event.clientX - drag.current.startX) / 2),
      y: clampPosition(drag.current.originY + (event.clientY - drag.current.startY) / 2),
    });
  };
  const moveWithKeyboard = (event: KeyboardEvent<HTMLDivElement>) => {
    const delta = event.shiftKey ? 10 : 2;
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault();
    setPosition((current) => ({
      x: clampPosition(current.x + (event.key === 'ArrowLeft' ? -delta : event.key === 'ArrowRight' ? delta : 0)),
      y: clampPosition(current.y + (event.key === 'ArrowUp' ? -delta : event.key === 'ArrowDown' ? delta : 0)),
    }));
  };

  const mime = format === 'webp' ? 'image/webp' : 'image/png';

  return (
    <div className="stack stagger">
      <StageHeader
        kicker="STAGE 02 // INSPECTION"
        title="Preview"
        actions={
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
            <Button variant="primary" onClick={() => void generate()} loading={busy} disabled={!isBridged()}>
              Generate previews
            </Button>
          </div>
        }
      />

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
              <Button variant="primary" onClick={() => void generate()} disabled={!isBridged()}>
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

      {images.length ? <Panel
        title="Inspection stage"
        actions={<div className="row wrap"><Field label="Frame"><Select value={selected} onChange={(event) => { setSelected(Number(event.target.value)); setPosition({ x: 50, y: 50 }); }} aria-label="Inspection frame">{images.map((_, index) => <option key={index} value={index}>Preview {index + 1}</option>)}</Select></Field><Field label="Fit"><Select value={fit} onChange={(event) => setFit(event.target.value as 'contain' | 'cover' | 'actual')} aria-label="Preview fit"><option value="contain">Contain</option><option value="cover">Cover</option><option value="actual">Actual size</option></Select></Field><Field label="Background"><Select value={background} onChange={(event) => setBackground(event.target.value as 'checker' | 'dark' | 'light')} aria-label="Preview background"><option value="checker">Checker</option><option value="dark">Dark</option><option value="light">Light</option></Select></Field><Button size="sm" onClick={reroll} loading={busy}>Reroll</Button><Button size="sm" variant="ghost" onClick={() => setPosition({ x: 50, y: 50 })}>Center</Button></div>}
      >
        <div
          className={cx('preview-inspector-stage', `preview-background--${background}`)}
          role="group"
          aria-label="Drag preview to inspect crop"
          tabIndex={0}
          onMouseDown={startDrag}
          onMouseMove={moveDrag}
          onMouseUp={() => { drag.current = null; }}
          onMouseLeave={() => { drag.current = null; }}
          onKeyDown={moveWithKeyboard}
        >
          <img
            className={cx('preview-inspector-image', `preview-fit--${fit}`)}
            src={`data:${mime};base64,${images[selected] ?? images[0]}`}
            alt={`Inspection preview ${selected + 1}`}
            draggable={false}
            style={{ objectPosition: `${position.x}% ${position.y}%` }}
          />
        </div>
        <span className="label muted hint">Drag the image (or use arrow keys; Shift for larger steps) to inspect crop and transparency against the selected backdrop.</span>
      </Panel> : null}

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
