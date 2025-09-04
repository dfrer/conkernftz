import { describe, it, expect } from 'vitest';
import { canonicalizeTraits, makeDna } from '../../src/dna.js';

describe('DNA', () => {
  it('canonicalizes traits with ignore and sorted keys', () => {
    const c = canonicalizeTraits({ B: '2', A: '1', Background: 'X' }, ['Background']);
    expect(c).toBe('A:1|B:2');
  });

  it('produces stable sha256', () => {
    const d = makeDna({ A: '1', B: '2' }, { hash: 'sha256' });
    const d2 = makeDna({ B: '2', A: '1' }, { hash: 'sha256' });
    expect(d).toBe(d2);
  });
});


