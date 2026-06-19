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
