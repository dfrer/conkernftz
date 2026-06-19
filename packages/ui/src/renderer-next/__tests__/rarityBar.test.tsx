import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { RarityBar } from '../components/RarityBar';

afterEach(cleanup);

describe('RarityBar', () => {
  it('renders one segment per trait sized by probability', () => {
    const { getByRole } = render(
      <RarityBar
        rows={[
          { value: 'Gold', probability: 0.5 },
          { value: 'Silver', probability: 0.3 },
          { value: 'Bronze', probability: 0.2 },
        ]}
      />,
    );
    const bar = getByRole('img');
    const segs = bar.querySelectorAll('.rarity-seg');
    expect(segs).toHaveLength(3);
    expect((segs[0] as HTMLElement).style.width).toBe('50%');
  });

  it('summarizes the distribution (rarest-aware, descending) in the accessible label', () => {
    const { getByRole } = render(
      <RarityBar
        rows={[
          { value: 'Common', probability: 0.8 },
          { value: 'Rare', probability: 0.2 },
        ]}
      />,
    );
    const label = getByRole('img').getAttribute('aria-label') ?? '';
    expect(label).toContain('Common 80.0%');
    expect(label.indexOf('Common')).toBeLessThan(label.indexOf('Rare'));
  });

  it('renders an empty, decorative bar when there are no traits', () => {
    const { container } = render(<RarityBar rows={[]} />);
    const bar = container.querySelector('.rarity-bar');
    expect(bar?.classList.contains('rarity-bar--empty')).toBe(true);
    expect(bar?.getAttribute('aria-hidden')).toBe('true');
  });
});
