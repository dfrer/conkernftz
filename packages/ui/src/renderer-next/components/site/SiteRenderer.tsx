import { type CSSProperties } from 'react';
import { cx } from '../../lib/cx';
import { MintExperience } from '../MintExperience';
import { resolveExperience, type ExperienceConfig } from '../../lib/mintExperience';
import type { Block, SiteConfig } from '../../lib/site';

// Renders a SiteConfig to React. This is the shared view used by both the in-app builder
// preview and (later, P3) the generated static mint site, so the page an artist builds is
// byte-for-byte the page that ships.
export function SiteRenderer({
  site,
  images = [],
  experience,
}: {
  site: SiteConfig;
  images?: string[];
  experience?: ExperienceConfig;
}) {
  const style = { '--site-accent': site.theme.accent } as CSSProperties;
  return (
    <div
      className={cx('site', `site--bg-${site.theme.background}`, `site--font-${site.theme.font}`)}
      style={style}
      data-testid="site-render"
    >
      {site.blocks.map((b) => (
        <BlockView key={b.id} block={b} images={images} experience={experience} />
      ))}
    </div>
  );
}

function BlockView({ block, images, experience }: { block: Block; images: string[]; experience?: ExperienceConfig }) {
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
  }
}
