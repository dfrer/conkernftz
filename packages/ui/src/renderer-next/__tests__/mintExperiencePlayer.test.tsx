import { describe, it, expect, afterEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';
import { MintExperience } from '../components/MintExperience';
import { resolveExperience } from '../lib/mintExperience';

afterEach(cleanup);

describe('MintExperience — rarity backs', () => {
  it('shows the rarity-tier back on a tiered card and the default back on the rest', () => {
    const config = {
      ...resolveExperience({ kind: 'flip', packCount: 2, autoFlip: false }),
      backArt: 'data:img/default',
      tierBacks: { Rare: 'data:img/rare' },
    };
    const { getByRole, container } = render(<MintExperience config={config} images={[]} cardTiers={['', 'Rare']} />);
    fireEvent.click(getByRole('button', { name: 'Reveal' })); // open → cards show their backs

    const srcs = Array.from(container.querySelectorAll('.exp-card-art')).map((el) => el.getAttribute('src'));
    expect(srcs).toHaveLength(2);
    expect(srcs).toContain('data:img/default'); // ordinary card → default back
    expect(srcs).toContain('data:img/rare'); // tiered card → rarity back
  });

  it('falls back to the default back when a tier has no mapped art', () => {
    const config = { ...resolveExperience({ kind: 'flip', packCount: 1, autoFlip: false }), backArt: 'data:img/default' };
    const { getByRole, container } = render(<MintExperience config={config} images={[]} cardTiers={['Mythic']} />);
    fireEvent.click(getByRole('button', { name: 'Reveal' }));
    expect(container.querySelector('.exp-card-art')?.getAttribute('src')).toBe('data:img/default');
  });
});

describe('MintExperience — interactive rip', () => {
  it('a cardPack with a torn-open image rips into the cards-from-pack stage on click', () => {
    const config = {
      ...resolveExperience({ kind: 'cardPack', packCount: 2, autoFlip: false }),
      packArt: 'data:img/sealed',
      packOpenArt: 'data:img/open',
      backArt: 'data:img/back',
    };
    const { getByRole, container } = render(<MintExperience config={config} images={[]} />);
    const pack = getByRole('button', { name: 'Rip open the pack' });
    // A click (no drag) opens it via the accessible fallback.
    fireEvent.pointerDown(pack, { clientY: 100, pointerId: 1 });
    fireEvent.pointerUp(pack, { clientY: 100, pointerId: 1 });
    // Rip stage: the torn-open pack + the cards rising out of it.
    expect((container.querySelector('.exp-rip-pack') as HTMLImageElement)?.getAttribute('src')).toBe('data:img/open');
    expect(container.querySelectorAll('.exp-rip-cards .exp-card')).toHaveLength(2);
  });

  it('Enter on the pack also rips it open', () => {
    const config = { ...resolveExperience({ kind: 'cardPack', packCount: 1 }), packArt: 'data:img/sealed', packOpenArt: 'data:img/open' };
    const { getByRole, container } = render(<MintExperience config={config} images={[]} />);
    fireEvent.keyDown(getByRole('button', { name: 'Rip open the pack' }), { key: 'Enter' });
    expect(container.querySelector('.exp-rip-pack')).toBeTruthy();
  });
});
