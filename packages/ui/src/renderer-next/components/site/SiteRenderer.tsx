import { type CSSProperties } from 'react';
import { cx } from '../../lib/cx';
import { MintExperience } from '../MintExperience';
import { resolveExperience, type ExperienceConfig } from '../../lib/mintExperience';
import type { Block, BlockLayout, Rect, SiteConfig } from '../../lib/site';

const MOBILE_W = 390;

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
        <div className="site-canvas" style={{ width: w, height: canvas.height }}>
          {site.blocks.map((b, i) => {
            const r = rectFor(b.layout, i, viewport);
            const z = b.layout?.z ?? i + 1;
            return (
              <div key={b.id} className="site-node" style={{ left: r.x, top: r.y, width: r.w, height: r.h, zIndex: z }}>
                <BlockBody block={b} images={images} experience={experience} />
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
      {site.blocks.map((b) => (
        <BlockBody key={b.id} block={b} images={images} experience={experience} />
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

export function BlockBody({ block, images, experience }: { block: Block; images: string[]; experience?: ExperienceConfig }) {
  switch (block.kind) {
    case 'hero':
      return (
        <section className={cx('site-hero', `site-hero--${block.align}`)}>
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
          <span className="site-hitcounter-label">{block.label}</span>
          <span className="site-hitcounter-num">{String(Math.max(0, block.start)).padStart(6, '0')}</span>
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
        <a className="site-88x31" href={block.href || undefined} target="_blank" rel="noreferrer">
          {block.text}
        </a>
      );
    case 'webRing':
      return (
        <div className="site-webring">
          <span>‹ prev</span>
          <span className="site-webring-name">{block.name}</span>
          <span>random</span>
          <span>next ›</span>
        </div>
      );
    case 'underConstruction':
      return (
        <div className="site-construction" aria-label="under construction">
          <span aria-hidden>🚧</span> {block.text} <span aria-hidden>🚧</span>
        </div>
      );
  }
}
