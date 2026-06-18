import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { SiteRenderer } from '../components/site/SiteRenderer';
import { addBlock, defaultSite } from '../lib/site';
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
    // Mint block mounts the P1 experience player → its call-to-action
    expect(getByRole('button', { name: 'Rip open' })).toBeTruthy();
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
});
