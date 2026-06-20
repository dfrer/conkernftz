import { useEffect, useRef, type CSSProperties } from 'react';
import { cx } from '../../lib/cx';
import { MintExperience } from '../MintExperience';
import { MintLive } from './MintLive';
import { resolveExperience, type ExperienceConfig } from '../../lib/mintExperience';
import { clampFontScale, clampScale, normalizeAlign, type Block, type BlockLayout, type MintConfig, type Rect, type SiteConfig, type SiteCursor } from '../../lib/site';

const MOBILE_W = 390;

// Page-level retro cursor trail: spawns fading sparkle/comet glyphs in the site as the pointer
// moves. Scoped to the .site container (not document), throttled, and disabled for
// prefers-reduced-motion. Runs in the in-app preview and the exported static site alike.
function CursorTrail({ kind }: { kind: SiteCursor }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (kind === 'none') return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const host = ref.current;
    const parent = host?.parentElement;
    if (!host || !parent) return;
    let last = 0;
    const onMove = (e: MouseEvent): void => {
      const now = performance.now();
      if (now - last < 45) return; // throttle the spawn rate
      last = now;
      const rect = parent.getBoundingClientRect();
      const bit = document.createElement('span');
      bit.className = `site-cursor-bit site-cursor-bit--${kind}`;
      bit.style.left = `${e.clientX - rect.left}px`;
      bit.style.top = `${e.clientY - rect.top}px`;
      bit.textContent = kind === 'comet' ? '☄' : '✦';
      host.appendChild(bit);
      window.setTimeout(() => bit.remove(), 720);
    };
    parent.addEventListener('mousemove', onMove);
    return () => parent.removeEventListener('mousemove', onMove);
  }, [kind]);
  if (kind === 'none') return null;
  return <div ref={ref} className="site-cursor-layer" aria-hidden />;
}

// Renders a SiteConfig to React, in 'flow' (stacked) or 'canvas' (free-form, absolute)
// mode, at a desktop or mobile viewport. Shared by the in-app builder preview and (P3) the
// generated static site, so what an artist builds is what ships.
export function SiteRenderer({
  site,
  images = [],
  experience,
  viewport = 'desktop',
}: {
  site: SiteConfig;
  images?: string[];
  experience?: ExperienceConfig;
  viewport?: 'desktop' | 'mobile';
}) {
  const mode = site.layout ?? 'flow';
  const theme = site.theme;
  const pageBg = site.pageBg ?? { kind: 'theme' as const, color: '#101312', tile: '' };

  const style: CSSProperties = { '--site-accent': theme.accent } as CSSProperties;
  if (pageBg.kind === 'color') style.background = pageBg.color;
  else if (pageBg.kind === 'tile' && pageBg.tile) {
    style.backgroundImage = `url("${pageBg.tile}")`;
    style.backgroundRepeat = 'repeat';
  }
  const bgClass = pageBg.kind === 'theme' ? `site--bg-${theme.background}` : '';

  if (mode === 'canvas') {
    const canvas = site.canvas ?? { width: 960, height: 1400 };
    const w = viewport === 'mobile' ? MOBILE_W : canvas.width;
    return (
      <div
        className={cx('site', 'site--canvas', bgClass, `site--font-${theme.font}`)}
        style={style}
        data-testid="site-render"
        data-mode="canvas"
      >
        {site.cursor && site.cursor !== 'none' ? <CursorTrail kind={site.cursor} /> : null}
        <div className="site-canvas" style={{ width: w, height: canvas.height }}>
          {site.blocks.map((b, i) => {
            const r = rectFor(b.layout, i, viewport);
            const z = b.layout?.z ?? i + 1;
            const rot = b.layout?.rot;
            return (
              <div
                key={b.id}
                className="site-node"
                style={{ left: r.x, top: r.y, width: r.w, height: r.h, zIndex: z, transform: rot ? `rotate(${rot}deg)` : undefined }}
              >
                <BlockBody block={b} images={images} experience={experience} mint={site.mint} />
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cx('site', bgClass, `site--font-${theme.font}`)}
      style={style}
      data-testid="site-render"
      data-mode="flow"
    >
      {site.cursor && site.cursor !== 'none' ? <CursorTrail kind={site.cursor} /> : null}
      {site.blocks.map((b) => (
        <BlockBody key={b.id} block={b} images={images} experience={experience} mint={site.mint} />
      ))}
    </div>
  );
}

function rectFor(layout: BlockLayout | undefined, index: number, viewport: 'desktop' | 'mobile'): Rect {
  const base: Rect = layout ?? { x: 40, y: 40 + index * 200, w: 400, h: 160 };
  if (viewport === 'mobile') {
    if (layout?.mobile) return layout.mobile;
    // No explicit mobile override → single-column stack scaled to the phone width.
    return { x: 12, y: 12 + index * 180, w: MOBILE_W - 24, h: base.h };
  }
  return { x: base.x, y: base.y, w: base.w, h: base.h };
}

// Wraps each block's content in a `display:contents` element carrying its per-block text style
// (size scale + alignment + color), so it flows everywhere BlockBody is used (flow + canvas
// preview + editor + exported site) without affecting layout. font-size, text-align and color
// are inherited properties, so they cascade through the box-less wrapper to the block's text;
// site.css multiplies sizes by var(--site-fscale). All three are no-ops when unset.
export function BlockBody(props: { block: Block; images: string[]; experience?: ExperienceConfig; mint?: MintConfig }) {
  const { block } = props;
  const fscale = clampFontScale(block.fontScale);
  const wscale = clampScale(block.scale);
  const align = normalizeAlign(block.align);
  const style: Record<string, string | number> = {};
  if (fscale !== 1) style['--site-fscale'] = fscale;
  if (align) style.textAlign = align;
  if (typeof block.color === 'string' && block.color) style.color = block.color;
  // Whole-widget scale uses `zoom` (it reflows, reserving the scaled space — unlike
  // transform:scale). It needs a real box, so a scaled block drops display:contents.
  if (wscale !== 1) style.zoom = wscale;
  return (
    <div className={cx('site-block', wscale !== 1 && 'site-block--scaled')} style={Object.keys(style).length ? (style as CSSProperties) : undefined}>
      <BlockContent {...props} />
    </div>
  );
}

function BlockContent({ block, images, experience, mint }: { block: Block; images: string[]; experience?: ExperienceConfig; mint?: MintConfig }) {
  switch (block.kind) {
    case 'hero':
      // Alignment comes from the block wrapper's text-align (the general per-block control),
      // defaulting to center when unset so existing/blank heroes stay centered.
      return (
        <section className="site-hero" style={block.align ? undefined : { textAlign: 'center' }}>
          <h1 className="site-hero-title">{block.title}</h1>
          {block.subtitle ? <p className="site-hero-sub">{block.subtitle}</p> : null}
        </section>
      );
    case 'richText':
      return (
        <section className="site-rich">
          {block.heading ? <h2 className="site-h2">{block.heading}</h2> : null}
          {block.text.split('\n').map((line, i) => (line.trim() ? <p key={i}>{line}</p> : null))}
        </section>
      );
    case 'gallery': {
      const n = Math.max(1, Math.min(24, block.count));
      const cols = Math.max(1, Math.min(6, block.columns));
      return (
        <section className="site-gallery">
          {block.heading ? <h2 className="site-h2">{block.heading}</h2> : null}
          <div className="site-gallery-grid" style={{ '--site-cols': cols } as CSSProperties}>
            {Array.from({ length: n }).map((_, i) =>
              images.length ? (
                <img key={i} className="site-tile" src={images[i % images.length]} alt={`Item ${i + 1}`} loading="lazy" />
              ) : (
                <div key={i} className="site-tile site-tile--ph" aria-hidden>
                  {i + 1}
                </div>
              ),
            )}
          </div>
        </section>
      );
    }
    case 'mint':
      return (
        <section className="site-mint">
          {block.heading ? <h2 className="site-h2">{block.heading}</h2> : null}
          {block.price ? <p className="site-mint-price">{block.price}</p> : null}
          <MintExperience config={resolveExperience(experience)} images={images} />
          {mint?.contractAddress ? <MintLive {...mint} /> : null}
        </section>
      );
    case 'faq':
      return (
        <section className="site-faq">
          {block.heading ? <h2 className="site-h2">{block.heading}</h2> : null}
          <dl>
            {block.items.map((it, i) => (
              <div key={i} className="site-faq-item">
                <dt>{it.q}</dt>
                <dd>{it.a}</dd>
              </div>
            ))}
          </dl>
        </section>
      );
    case 'divider':
      return <hr className="site-divider" />;
    case 'marquee':
      return (
        <div className="site-marquee" aria-label="marquee">
          <span className="site-marquee-text">{block.text}</span>
        </div>
      );
    case 'blink':
      return (
        <span className="site-blink" style={{ color: block.color }}>
          {block.text}
        </span>
      );
    case 'image':
      return block.src ? (
        <img className="site-img" src={block.src} alt={block.alt} loading="lazy" />
      ) : (
        <div className="site-img site-img--ph" aria-hidden>
          IMG
        </div>
      );
    case 'hitCounter':
      return (
        <div className="site-hitcounter">
          {block.label ? <span className="site-hitcounter-label">{block.label}</span> : null}
          {block.src ? (
            // A real counter from a service (the static-site-friendly way to get a global count).
            <img className="site-hitcounter-img" src={block.src} alt="visit counter" loading="lazy" />
          ) : (
            <span className="site-hitcounter-num">{String(Math.max(0, block.start)).padStart(6, '0')}</span>
          )}
        </div>
      );
    case 'html':
      // Raw-HTML escape hatch (GeoCities-style). Rendered in a sandboxed iframe (scripts
      // allowed, but no same-origin) so the artist's markup runs fully isolated from the app
      // and the IPC bridge — and the same isolation carries into the generated static site.
      return <iframe className="site-html" title="Custom HTML" sandbox="allow-scripts allow-popups allow-forms" srcDoc={block.html} />;
    case 'wordArt':
      return <div className={cx('site-wordart', `site-wordart--${block.style}`)}>{block.text}</div>;
    case 'button':
      return (
        <a className={cx('site-88x31', block.src && 'site-88x31--img')} href={block.href || undefined} target="_blank" rel="noreferrer">
          {block.src ? <img className="site-88x31-img" src={block.src} alt={block.text || 'button'} loading="lazy" /> : block.text}
        </a>
      );
    case 'webRing': {
      // prev / random / next become real links when a target URL is set, else stay decorative.
      const ringLink = (label: string, href: string | undefined, cls?: string) =>
        href ? (
          <a className={cx('site-webring-link', cls)} href={href} target="_blank" rel="noreferrer">
            {label}
          </a>
        ) : (
          <span className={cls}>{label}</span>
        );
      return (
        <div className="site-webring">
          {ringLink('‹ prev', block.prev)}
          {block.hub ? (
            <a className="site-webring-name site-webring-link" href={block.hub} target="_blank" rel="noreferrer">
              {block.name}
            </a>
          ) : (
            <span className="site-webring-name">{block.name}</span>
          )}
          {ringLink('random', block.random)}
          {ringLink('next ›', block.next)}
        </div>
      );
    }
    case 'underConstruction':
      return (
        <div className="site-construction" aria-label="under construction">
          <span aria-hidden>🚧</span> {block.text} <span aria-hidden>🚧</span>
        </div>
      );
    case 'bestViewed':
      return <div className="site-bestviewed">{block.text}</div>;
    case 'audio':
      return (
        <div className="site-audio">
          {block.label ? <span className="site-audio-label">{block.label}</span> : null}
          {block.src ? (
            // eslint-disable-next-line jsx-a11y/media-has-caption
            <audio className="site-audio-el" src={block.src} controls loop={block.loop} autoPlay={block.autoplay} />
          ) : (
            <span className="site-audio-ph">add a MIDI/MP3 URL</span>
          )}
        </div>
      );
    case 'guestbook':
      return (
        <a className="site-guestbook" href={block.href || undefined} target="_blank" rel="noreferrer">
          {block.label}
        </a>
      );
  }
}
