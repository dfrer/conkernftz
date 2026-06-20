import { useRef, type PointerEvent } from 'react';
import { cx } from '../../lib/cx';
import { BlockBody } from './SiteRenderer';
import { defaultLayout, type Rect, type SiteConfig } from '../../lib/site';
import type { ExperienceConfig } from '../../lib/mintExperience';

const MOBILE_W = 390;

// Interactive free-form canvas for the builder: absolute nodes that drag to move, a corner
// handle to resize, a top handle to rotate, and click to select. Pointer drag isn't exercisable
// in the headless test env (like the spawn editor) — the pure layout ops it calls
// (setBlockLayout/setBlockMobile) are what's unit-tested; the drag itself is validated in-app.
export function SiteCanvas({
  site,
  images,
  experience,
  viewport,
  selectedIds,
  onSelect,
  onMoveMany,
  onResize,
  onRotate,
  onInteractStart,
}: {
  site: SiteConfig;
  images: string[];
  experience: ExperienceConfig;
  viewport: 'desktop' | 'mobile';
  selectedIds: string[];
  onSelect: (id: string, additive: boolean) => void;
  onMoveMany: (updates: { id: string; x: number; y: number }[]) => void;
  onResize: (id: string, w: number, h: number) => void;
  onRotate?: (id: string, deg: number) => void;
  /** Called once when a drag/resize/rotate begins (so the parent can snapshot for undo). */
  onInteractStart?: () => void;
}) {
  const drag = useRef<
    | { mode: 'move'; ids: string[]; sx: number; sy: number; starts: Map<string, { x: number; y: number }> }
    | { mode: 'resize'; id: string; sx: number; sy: number; ox: number; oy: number }
    | { mode: 'rotate'; id: string; cx: number; cy: number }
    | null
  >(null);
  const canvas = site.canvas ?? { width: 960, height: 1400 };
  const w = viewport === 'mobile' ? MOBILE_W : canvas.width;

  const rectFor = (index: number): Rect => {
    const b = site.blocks[index]!;
    const lay = b.layout ?? defaultLayout(index);
    if (viewport === 'mobile') return lay.mobile ?? { x: 12, y: 12 + index * 180, w: MOBILE_W - 24, h: lay.h };
    return { x: lay.x, y: lay.y, w: lay.w, h: lay.h };
  };

  const startMove = (e: PointerEvent<HTMLDivElement>, id: string): void => {
    if (e.shiftKey || e.ctrlKey || e.metaKey) {
      onSelect(id, true); // toggle into the multi-selection; no drag
      return;
    }
    // Keep an existing multi-selection if this node is part of it (group drag); else select it.
    const groupDrag = selectedIds.includes(id) && selectedIds.length > 1;
    if (!groupDrag) onSelect(id, false);
    onInteractStart?.();
    const ids = groupDrag ? selectedIds : [id];
    const starts = new Map<string, { x: number; y: number }>();
    ids.forEach((mid) => {
      const idx = site.blocks.findIndex((b) => b.id === mid);
      const r = rectFor(idx);
      starts.set(mid, { x: r.x, y: r.y });
    });
    drag.current = { mode: 'move', ids, sx: e.clientX, sy: e.clientY, starts };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const startResize = (e: PointerEvent<HTMLDivElement>, id: string, index: number): void => {
    e.stopPropagation();
    onSelect(id, false);
    onInteractStart?.();
    const r = rectFor(index);
    drag.current = { mode: 'resize', id, sx: e.clientX, sy: e.clientY, ox: r.w, oy: r.h };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const startRotate = (e: PointerEvent<HTMLDivElement>, id: string): void => {
    e.stopPropagation();
    onSelect(id, false);
    onInteractStart?.();
    // Rotation pivots around the node's bounding-box center (== its rotation center).
    const node = (e.currentTarget as HTMLElement).closest('.site-node') as HTMLElement | null;
    const box = node?.getBoundingClientRect();
    const cx = box ? box.left + box.width / 2 : e.clientX;
    const cy = box ? box.top + box.height / 2 : e.clientY;
    drag.current = { mode: 'rotate', id, cx, cy };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>): void => {
    const d = drag.current;
    if (!d) return;
    if (d.mode === 'rotate') {
      // Handle sits at 12 o'clock, so +90° makes "pointing up" == 0°. Shift = free; else snap 15°.
      let deg = (Math.atan2(e.clientY - d.cy, e.clientX - d.cx) * 180) / Math.PI + 90;
      if (!e.shiftKey) deg = Math.round(deg / 15) * 15;
      onRotate?.(d.id, Math.round(deg));
      return;
    }
    const dx = e.clientX - d.sx;
    const dy = e.clientY - d.sy;
    if (d.mode === 'move') {
      onMoveMany(
        d.ids.map((mid) => {
          const st = d.starts.get(mid)!;
          return { id: mid, x: Math.max(0, Math.round(st.x + dx)), y: Math.max(0, Math.round(st.y + dy)) };
        }),
      );
    } else onResize(d.id, Math.max(40, Math.round(d.ox + dx)), Math.max(30, Math.round(d.oy + dy)));
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
          const rot = b.layout?.rot;
          const sel = selectedIds.includes(b.id);
          return (
            <div
              key={b.id}
              className={cx('site-node', 'site-node--edit', sel && 'site-node--sel')}
              style={{ left: r.x, top: r.y, width: r.w, height: r.h, zIndex: z, transform: rot ? `rotate(${rot}deg)` : undefined }}
              onPointerDown={(e) => startMove(e, b.id)}
              role="button"
              tabIndex={0}
              aria-label={`Block ${i + 1}`}
            >
              <div className="site-node-inner">
                <BlockBody block={b} images={images} experience={experience} />
              </div>
              {sel ? (
                <>
                  <div className="site-node-rotate" onPointerDown={(e) => startRotate(e, b.id)} aria-hidden />
                  <div className="site-node-resize" onPointerDown={(e) => startResize(e, b.id, i)} aria-hidden />
                </>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
