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
  const ripConfig = (over: Record<string, unknown> = {}) => ({
    ...resolveExperience({ kind: 'cardPack', packCount: 2, autoFlip: false }),
    packArt: 'data:img/sealed',
    packOpenArt: 'data:img/open',
    backArt: 'data:img/back',
    ...over,
  });

  it('drag past the threshold tears the pack, then settles into the stacked cards', () => {
    const { getByRole, container } = render(<MintExperience config={ripConfig()} images={[]} />);
    const pack = getByRole('button', { name: 'Rip open the pack' });
    // Grab and pull upward past the rip threshold (120px).
    fireEvent.pointerDown(pack, { clientY: 220, pointerId: 1 });
    fireEvent.pointerMove(pack, { clientY: 60, pointerId: 1 });
    fireEvent.pointerUp(pack, { clientY: 60, pointerId: 1 });
    // Tear beat first — the torn-open art is fading in, no rip scene yet.
    const tearSealed = container.querySelector('.exp-tear-sealed');
    expect(tearSealed).toBeTruthy();
    expect(container.querySelector('.exp-rip-pack')).toBeNull();
    // Tear animation ends → settle into the stacked phase (cards tucked in the open pack).
    fireEvent.animationEnd(tearSealed!);
    expect((container.querySelector('.exp-rip-pack') as HTMLImageElement).getAttribute('src')).toBe('data:img/open');
    expect(container.querySelector('.exp-rip--stacked')).toBeTruthy();
    expect(container.querySelectorAll('.exp-rip-cards .exp-card')).toHaveLength(2);
  });

  it('clicking the open pack spills the stacked cards out on top', () => {
    const { getByRole, container } = render(<MintExperience config={ripConfig()} images={[]} />);
    fireEvent.click(getByRole('button', { name: 'Rip open the pack' })); // click fallback → tear
    fireEvent.animationEnd(container.querySelector('.exp-tear-sealed')!); // → stacked
    expect(container.querySelector('.exp-rip--stacked')).toBeTruthy();
    fireEvent.click(container.querySelector('.exp-rip-pack')!); // pull the cards out
    expect(container.querySelector('.exp-rip--spilled')).toBeTruthy();
    expect(container.querySelector('.exp-rip--stacked')).toBeNull();
  });

  it('a pack without a torn-open image skips the tear and reveals directly', () => {
    const config = { ...resolveExperience({ kind: 'cardPack', packCount: 1, autoFlip: true }), packArt: 'data:img/sealed' };
    const { getByRole, container } = render(<MintExperience config={config} images={['data:img/card']} />);
    fireEvent.click(getByRole('button', { name: 'Rip open the pack' }));
    // No torn-open art → no tear/rip scene; falls back to the flat reveal grid (auto-flipped).
    expect(container.querySelector('.exp-tear')).toBeNull();
    expect(container.querySelector('.exp-rip')).toBeNull();
    expect(container.querySelector('.exp-card-art')?.getAttribute('src')).toBe('data:img/card');
  });

  it('Enter on the pack also rips it open', () => {
    const { getByRole, container } = render(<MintExperience config={ripConfig({ packCount: 1 })} images={[]} />);
    fireEvent.keyDown(getByRole('button', { name: 'Rip open the pack' }), { key: 'Enter' });
    expect(container.querySelector('.exp-tear')).toBeTruthy(); // tear beat starts
    fireEvent.animationEnd(container.querySelector('.exp-tear-sealed')!);
    expect(container.querySelector('.exp-rip-pack')).toBeTruthy();
  });

  it('split front/back art renders the layered cards-inside-the-pack pocket', () => {
    const config = ripConfig({ packOpenFrontArt: 'data:img/front', packOpenBackArt: 'data:img/back-wall' });
    const { getByRole, container } = render(<MintExperience config={config} images={[]} />);
    fireEvent.click(getByRole('button', { name: 'Rip open the pack' }));
    // Tear crossfades to the FRONT piece (preferred over the single open image).
    expect((container.querySelector('.exp-tear-open') as HTMLImageElement).getAttribute('src')).toBe('data:img/front');
    fireEvent.animationEnd(container.querySelector('.exp-tear-sealed')!); // → stacked
    // Three-layer sandwich: back wall (behind), cards, front pocket (in front).
    expect(container.querySelector('.exp-rip--layered')).toBeTruthy();
    expect((container.querySelector('.exp-rip-back') as HTMLImageElement).getAttribute('src')).toBe('data:img/back-wall');
    expect((container.querySelector('.exp-rip-front') as HTMLImageElement).getAttribute('src')).toBe('data:img/front');
    expect(container.querySelector('.exp-rip-pack')).toBeNull(); // single-image element not used
    // Clicking the front pocket spills the cards out.
    fireEvent.click(container.querySelector('.exp-rip-front')!);
    expect(container.querySelector('.exp-rip--spilled')).toBeTruthy();
  });
});
