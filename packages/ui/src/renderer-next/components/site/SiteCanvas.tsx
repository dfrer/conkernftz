import { useRef, type PointerEvent } from 'react';
import { cx } from '../../lib/cx';
import { BlockBody } from './SiteRenderer';
import { defaultLayout, type Rect, type SiteConfig } from '../../lib/site';
import type { ExperienceConfig } from '../../lib/mintExperience';

const MOBILE_W = 390;

// Interactive free-form canvas for the builder: absolute-positioned nodes that drag to
// move and click to select. Pointer drag isn't exercisable in the headless test env (like
// the spawn editor) — the pure layout ops it calls (setBlockLayout/setBlockMobile) are
// what's unit-tested; the drag itself is validated in-app.
export function SiteCanvas({
  site,
  images,
  experience,
  viewport,
  selectedId,
  onSelect,
  onMove,
}: {
  site: SiteConfig;
  images: string[];
  experience: ExperienceConfig;
  viewport: 'desktop' | 'mobile';
  selectedId: string | null;
  onSelect: (id: string) => void;
  onMove: (id: string, x: number, y: number) => void;
}) {
  const drag = useRef<{ id: string; sx: number; sy: number; ox: number; oy: number } | null>(null);
  const canvas = site.canvas ?? { width: 960, height: 1400 };
  const w = viewport === 'mobile' ? MOBILE_W : canvas.width;

  const rectFor = (id: string, index: number): Rect => {
    const b = site.blocks[index]!;
    const lay = b.layout ?? defaultLayout(index);
    if (viewport === 'mobile') return lay.mobile ?? { x: 12, y: 12 + index * 180, w: MOBILE_W - 24, h: lay.h };
    return { x: lay.x, y: lay.y, w: lay.w, h: lay.h };
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>, id: string, index: number): void => {
    onSelect(id);
    const r = rectFor(id, index);
    drag.current = { id, sx: e.clientX, sy: e.clientY, ox: r.x, oy: r.y };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>): void => {
    const d = drag.current;
    if (!d) return;
    onMove(d.id, Math.max(0, Math.round(d.ox + (e.clientX - d.sx))), Math.max(0, Math.round(d.oy + (e.clientY - d.sy))));
  };
  const endDrag = (): void => {
    drag.current = null;
  };

  return (
    <div className="site-canvas-wrap" onPointerMove={onPointerMove} onPointerUp={endDrag} onPointerLeave={endDrag}>
      <div className="site-canvas site-canvas--edit" style={{ width: w, height: canvas.height }}>
        {site.blocks.map((b, i) => {
          const r = rectFor(b.id, i);
          const z = b.layout?.z ?? i + 1;
          return (
            <div
              key={b.id}
              className={cx('site-node', 'site-node--edit', selectedId === b.id && 'site-node--sel')}
              style={{ left: r.x, top: r.y, width: r.w, height: r.h, zIndex: z }}
              onPointerDown={(e) => onPointerDown(e, b.id, i)}
              role="button"
              tabIndex={0}
              aria-label={`Block ${i + 1}`}
            >
              <div className="site-node-inner">
                <BlockBody block={b} images={images} experience={experience} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
