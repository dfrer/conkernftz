import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { SiteRenderer } from '../components/site/SiteRenderer';
import { addBlock, defaultSite, setCursor, setLayoutMode, updateBlock } from '../lib/site';
import { resolveExperience } from '../lib/mintExperience';

afterEach(cleanup);

describe('SiteRenderer', () => {
  it('renders the configured blocks, reusing the mint-experience player', () => {
    const site = addBlock(defaultSite(), 'marquee');
    const { container, getByText, getByRole } = render(
      <SiteRenderer site={site} images={[]} experience={resolveExperience({ kind: 'cardPack' })} />,
    );
    // Hero default title
    expect(getByText('Untitled Collection')).toBeTruthy();
    // Gallery default count → 6 placeholder tiles (no images supplied)
    expect(container.querySelectorAll('.site-tile--ph').length).toBe(6);
    // Mint block mounts the P1 experience player → the pack is the rip control
    expect(getByRole('button', { name: 'Rip open the pack' })).toBeTruthy();
    // Marquee flair
    expect(getByText(/MINTING NOW/)).toBeTruthy();
  });

  it('applies the theme background/font classes', () => {
    const site = { ...defaultSite(), theme: { accent: '#abc', background: 'void' as const, font: 'mono' as const } };
    const { container } = render(<SiteRenderer site={site} />);
    const root = container.querySelector('.site');
    expect(root?.classList.contains('site--bg-void')).toBe(true);
    expect(root?.classList.contains('site--font-mono')).toBe(true);
  });

  it('renders canvas mode with one absolute node per block', () => {
    const site = setLayoutMode(defaultSite(), 'canvas');
    const { container } = render(<SiteRenderer site={site} experience={resolveExperience({})} />);
    expect(container.querySelector('[data-mode="canvas"]')).toBeTruthy();
    expect(container.querySelectorAll('.site-node').length).toBe(site.blocks.length);
  });

  it('renders the GeoCities widgets (blink + hit counter)', () => {
    let site = addBlock(defaultSite(), 'blink');
    site = addBlock(site, 'hitCounter');
    const { container, getByText } = render(<SiteRenderer site={site} experience={resolveExperience({})} />);
    expect(getByText('NEW!!!')).toBeTruthy();
    expect(container.querySelector('.site-hitcounter-num')).toBeTruthy();
  });

  it('applies a per-block font scale via the --site-fscale custom property', () => {
    let site = defaultSite();
    // bump the hero's font scale
    site = { ...site, blocks: site.blocks.map((b) => (b.kind === 'hero' ? { ...b, fontScale: 2 } : b)) };
    const { container } = render(<SiteRenderer site={site} experience={resolveExperience({})} />);
    const heroWrap = container.querySelector('.site-hero')?.closest('.site-block') as HTMLElement | null;
    expect(heroWrap?.style.getPropertyValue('--site-fscale')).toBe('2');
    // a block without a scale doesn't set the variable
    const galleryWrap = container.querySelector('.site-gallery')?.closest('.site-block') as HTMLElement | null;
    expect(galleryWrap?.style.getPropertyValue('--site-fscale')).toBe('');
  });

  it('scales the whole widget (e.g. the mint pack) via zoom on a real box', () => {
    let site = defaultSite();
    const mint = site.blocks.find((b) => b.kind === 'mint')!;
    site = updateBlock(site, mint.id, { scale: 1.5 });
    const { container } = render(<SiteRenderer site={site} experience={resolveExperience({ kind: 'cardPack' })} />);
    const wrap = container.querySelector('.site-mint')?.closest('.site-block') as HTMLElement | null;
    expect(wrap?.classList.contains('site-block--scaled')).toBe(true);
    expect(wrap?.style.zoom).toBe('1.5');
  });

  it('applies per-block align + color via the wrapper style', () => {
    let site = addBlock(defaultSite(), 'richText');
    const rt = site.blocks[site.blocks.length - 1]!;
    site = updateBlock(site, rt.id, { align: 'right', color: 'rgb(0, 255, 0)' });
    const { container } = render(<SiteRenderer site={site} experience={resolveExperience({})} />);
    const wrap = container.querySelector('.site-rich')?.closest('.site-block') as HTMLElement | null;
    expect(wrap?.style.textAlign).toBe('right');
    expect(wrap?.style.color).toBe('rgb(0, 255, 0)');
  });

  it('renders the extra nostalgia widgets (wordart / webring / under-construction)', () => {
    let site = addBlock(defaultSite(), 'wordArt');
    site = addBlock(site, 'webRing');
    site = addBlock(site, 'underConstruction');
    const { container, getByText } = render(<SiteRenderer site={site} experience={resolveExperience({})} />);
    expect(getByText('WELCOME')).toBeTruthy();
    expect(getByText('The NFT Web Ring')).toBeTruthy();
    expect(container.querySelector('.site-construction')?.textContent).toContain('UNDER CONSTRUCTION');
  });

  it('web ring renders real links when URLs are set, decorative spans otherwise', () => {
    let site = addBlock(defaultSite(), 'webRing');
    const id = site.blocks[site.blocks.length - 1]!.id;
    // no URLs → prev/next/random are not links
    let r = render(<SiteRenderer site={site} experience={resolveExperience({})} />);
    expect(r.container.querySelectorAll('.site-webring a').length).toBe(0);
    r.unmount();
    // set URLs → real links (prev, random, next, + the name → hub)
    site = updateBlock(site, id, { prev: 'https://a', random: 'https://r', next: 'https://b', hub: 'https://hub' });
    r = render(<SiteRenderer site={site} experience={resolveExperience({})} />);
    const hrefs = Array.from(r.container.querySelectorAll('.site-webring a')).map((a) => a.getAttribute('href'));
    expect(hrefs).toEqual(['https://a', 'https://hub', 'https://r', 'https://b']);
  });

  it('88×31 button shows a badge image when src is set, else the text label', () => {
    let site = addBlock(defaultSite(), 'button');
    const id = site.blocks[site.blocks.length - 1]!.id;
    site = updateBlock(site, id, { text: 'cool site', src: 'data:img/badge' });
    const { container } = render(<SiteRenderer site={site} experience={resolveExperience({})} />);
    const img = container.querySelector('.site-88x31-img') as HTMLImageElement | null;
    expect(img?.getAttribute('src')).toBe('data:img/badge');
  });

  it('hit counter renders a counter-service image when src is set', () => {
    let site = addBlock(defaultSite(), 'hitCounter');
    const id = site.blocks[site.blocks.length - 1]!.id;
    site = updateBlock(site, id, { src: 'https://counter.example/c.gif' });
    const { container } = render(<SiteRenderer site={site} experience={resolveExperience({})} />);
    expect((container.querySelector('.site-hitcounter-img') as HTMLImageElement)?.getAttribute('src')).toBe('https://counter.example/c.gif');
    expect(container.querySelector('.site-hitcounter-num')).toBeNull();
  });

  it('renders the nostalgia-zoo widgets (best-viewed / audio / guestbook)', () => {
    let site = addBlock(defaultSite(), 'bestViewed');
    site = addBlock(site, 'audio');
    site = addBlock(site, 'guestbook');
    const audioId = site.blocks.find((b) => b.kind === 'audio')!.id;
    const gbId = site.blocks.find((b) => b.kind === 'guestbook')!.id;
    site = updateBlock(site, audioId, { src: 'data:audio/midi;base64,xx' });
    site = updateBlock(site, gbId, { href: 'https://guestbook.example' });
    const { container } = render(<SiteRenderer site={site} experience={resolveExperience({})} />);
    expect(container.querySelector('.site-bestviewed')).toBeTruthy();
    expect((container.querySelector('.site-audio-el') as HTMLAudioElement)?.getAttribute('src')).toBe('data:audio/midi;base64,xx');
    expect((container.querySelector('.site-guestbook') as HTMLAnchorElement)?.getAttribute('href')).toBe('https://guestbook.example');
  });

  it('mounts a cursor-trail layer only when site.cursor is set', () => {
    const r = render(<SiteRenderer site={setCursor(defaultSite(), 'sparkle')} experience={resolveExperience({})} />);
    expect(r.container.querySelector('.site-cursor-layer')).toBeTruthy();
    r.unmount();
    const r2 = render(<SiteRenderer site={setCursor(defaultSite(), 'none')} experience={resolveExperience({})} />);
    expect(r2.container.querySelector('.site-cursor-layer')).toBeNull();
  });
});
