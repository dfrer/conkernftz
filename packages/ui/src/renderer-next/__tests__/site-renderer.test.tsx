import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { SiteRenderer } from '../components/site/SiteRenderer';
import { addBlock, defaultSite, setLayoutMode, updateBlock } from '../lib/site';
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
});
