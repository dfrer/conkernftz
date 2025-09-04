import { describe, it, expect } from 'vitest';
import { parseWeightFromFilename } from '../../src/rarity.js';

const cfg = { mode: 'filenameDelimiter' as const, delimiter: '#', defaultWeight: 1 };

describe('rarity parsing', () => {
  it('extracts weight from filename', () => {
    expect(parseWeightFromFilename('Trait#25.png', cfg)).toBe(25);
  });
  it('falls back to default when absent', () => {
    expect(parseWeightFromFilename('Trait.png', cfg)).toBe(1);
  });
  it('ignores invalid numbers', () => {
    expect(parseWeightFromFilename('Trait#abc.png', cfg)).toBe(1);
  });
});


