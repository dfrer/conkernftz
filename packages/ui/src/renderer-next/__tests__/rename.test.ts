import { describe, it, expect } from 'vitest';
import { splitName, traitValueOf, weightOf, setWeight, uniformWeightRenames, sequenceRenames, isImage } from '../lib/rename';

describe('rename helpers', () => {
  it('splits names and parses value + weight', () => {
    expect(splitName('Gold#5.png')).toEqual({ stem: 'Gold#5', ext: '.png' });
    expect(traitValueOf('Gold Crown#5.png', '#')).toBe('Gold Crown');
    expect(weightOf('Gold#5.png', '#', 1)).toBe(5);
    expect(weightOf('Gold.png', '#', 3)).toBe(3);
  });

  it('setWeight replaces or adds the weight suffix', () => {
    expect(setWeight('Gold#5.png', 10, '#')).toBe('Gold#10.png');
    expect(setWeight('Gold.png', 2, '#')).toBe('Gold#2.png');
  });

  it('uniformWeightRenames only changes files whose weight differs', () => {
    const pairs = uniformWeightRenames(['Red#5.png', 'Blue.png', 'Green#5.png'], 5, '#');
    expect(pairs).toEqual([{ from: 'Blue.png', to: 'Blue#5.png' }]);
  });

  it('sequenceRenames pads indices and can keep weights', () => {
    expect(sequenceRenames(['x.png', 'y.png'], 'Trait', 1, 3, '#', false)).toEqual([
      { from: 'x.png', to: 'Trait 001.png' },
      { from: 'y.png', to: 'Trait 002.png' },
    ]);
    expect(sequenceRenames(['a#7.png'], 'T', 1, 2, '#', true)).toEqual([{ from: 'a#7.png', to: 'T 01#7.png' }]);
  });

  it('isImage recognises image files', () => {
    expect(isImage('a.png')).toBe(true);
    expect(isImage('a.webp')).toBe(true);
    expect(isImage('a.txt')).toBe(false);
    expect(isImage('subdir/')).toBe(false);
  });
});
