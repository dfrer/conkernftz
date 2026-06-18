import { describe, it, expect, afterEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';
import { MintExperience } from '../components/MintExperience';
import { resolveExperience } from '../lib/mintExperience';

afterEach(cleanup);

describe('MintExperience', () => {
  it('auto-flips to reveal the art on open', () => {
    const cfg = resolveExperience({ kind: 'cardPack', packCount: 2, autoFlip: true });
    const { getByRole, getByAltText, queryByAltText } = render(<MintExperience config={cfg} images={['a.png', 'b.png']} />);
    expect(queryByAltText('Card 1')).toBeNull(); // sealed until opened
    fireEvent.click(getByRole('button', { name: 'Rip open' }));
    expect(getByAltText('Card 1')).toBeTruthy();
    expect(getByAltText('Card 2')).toBeTruthy();
  });

  it('reveals a card on tap when autoFlip is off', () => {
    const cfg = resolveExperience({ kind: 'flip', packCount: 2, autoFlip: false });
    const { getByRole, getByLabelText, getByAltText, queryByAltText } = render(
      <MintExperience config={cfg} images={['a.png', 'b.png']} />,
    );
    fireEvent.click(getByRole('button', { name: 'Reveal' }));
    expect(queryByAltText('Card 1')).toBeNull(); // face-down
    fireEvent.click(getByLabelText('Reveal card 1'));
    expect(getByAltText('Card 1')).toBeTruthy();
  });

  it('fires onComplete once every card is revealed', () => {
    const cfg = resolveExperience({ kind: 'fade', packCount: 1, autoFlip: true });
    let done = false;
    const { getByRole } = render(
      <MintExperience
        config={cfg}
        images={['a.png']}
        onComplete={() => {
          done = true;
        }}
      />,
    );
    fireEvent.click(getByRole('button', { name: 'Reveal' }));
    expect(done).toBe(true);
  });
});
