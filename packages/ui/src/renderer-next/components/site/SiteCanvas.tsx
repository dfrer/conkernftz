import { useRef, type PointerEvent } from 'react';
import { cx } from '../../lib/cx';
import { BlockBody } from './SiteRenderer';
import { defaultLayout, type Rect, type SiteConfig } from '../../lib/site';
import type { ExperienceConfig } from '../../lib/mintExperience';

const MOBILE_W = 390;

// Interactive free-form canvas for the builder: absolute nodes that drag to move, a corner
// handle to resize, and click to select. Pointer drag isn't exercisable in the headless test
// env (like the spawn editor) — the pure layout ops it calls (setBlockLayout/setBlockMobile)
// are what's unit-tested; the drag itself is validated in-app.
export function SiteCanvas({
  site,
  images,
  experience,
  viewport,
  selectedId,
  onSelect,
  onMove,
  onResize,
}: {
  site: SiteConfig;
  images: string[];
  experience: ExperienceConfig;
  viewport: 'desktop' | 'mobile';
  selectedId: string | null;
  onSelect: (id: string) => void;
  onMove: (id: string, x: number, y: number) => void;
  onResize: (id: string, w: number, h: number) => void;
}) {
  const drag = useRef<{ mode: 'move' | 'resize'; id: string; sx: number; sy: number; ox: number; oy: number } | null>(null);
  const canvas = site.canvas ?? { width: 960, height: 1400 };
  const w = viewport === 'mobile' ? MOBILE_W : canvas.width;

  const rectFor = (index: number): Rect => {
    const b = site.blocks[index]!;
    const lay = b.layout ?? defaultLayout(index);
    if (viewport === 'mobile') return lay.mobile ?? { x: 12, y: 12 + index * 180, w: MOBILE_W - 24, h: lay.h };
    return { x: lay.x, y: lay.y, w: lay.w, h: lay.h };
  };

  const startMove = (e: PointerEvent<HTMLDivElement>, id: string, index: number): void => {
    onSelect(id);
    const r = rectFor(index);
    drag.current = { mode: 'move', id, sx: e.clientX, sy: e.clientY, ox: r.x, oy: r.y };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const startResize = (e: PointerEvent<HTMLDivElement>, id: string, index: number): void => {
    e.stopPropagation();
    onSelect(id);
    const r = rectFor(index);
    drag.current = { mode: 'resize', id, sx: e.clientX, sy: e.clientY, ox: r.w, oy: r.h };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>): void => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.sx;
    const dy = e.clientY - d.sy;
    if (d.mode === 'move') onMove(d.id, Math.max(0, Math.round(d.ox + dx)), Math.max(0, Math.round(d.oy + dy)));
    else onResize(d.id, Math.max(40, Math.round(d.ox + dx)), Math.max(30, Math.round(d.oy + dy)));
  };
  const endDrag = (): void => {
    drag.current = null;
  };

  return (
    <div className="site-canvas-wrap" onPointerMove={onPointerMove} onPointerUp={endDrag} onPointerLeave={endDrag}>
      <div className="site-canvas site-canvas--edit" style={{ width: w, height: canvas.height }}>
        {site.blocks.map((b, i) => {
          const r = rectFor(i);
          const z = b.layout?.z ?? i + 1;
          const sel = selectedId === b.id;
          return (
            <div
              key={b.id}
              className={cx('site-node', 'site-node--edit', sel && 'site-node--sel')}
              style={{ left: r.x, top: r.y, width: r.w, height: r.h, zIndex: z }}
              onPointerDown={(e) => startMove(e, b.id, i)}
              role="button"
              tabIndex={0}
              aria-label={`Block ${i + 1}`}
            >
              <div className="site-node-inner">
                <BlockBody block={b} images={images} experience={experience} />
              </div>
              {sel ? <div className="site-node-resize" onPointerDown={(e) => startResize(e, b.id, i)} aria-hidden /> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
