import { describe, it, expect } from 'vitest';
import { createSeededRng } from '../rng.js';

describe('createSeededRng', () => {
  it('is deterministic for the same seed (string and number)', () => {
    const a = createSeededRng('seed');
    const b = createSeededRng('seed');
    const seqA = Array.from({ length: 16 }, () => a.next());
    const seqB = Array.from({ length: 16 }, () => b.next());
    expect(seqA).toEqual(seqB);

    const n1 = createSeededRng(42);
    const n2 = createSeededRng(42);
    expect(n1.next()).toBe(n2.next());
  });

  it('produces values in [0, 1) — never exactly 1', () => {
    const rng = createSeededRng(123456789);
    for (let i = 0; i < 50000; i++) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('int() stays in range and never returns maxExclusive', () => {
    const rng = createSeededRng('bounds');
    for (let i = 0; i < 50000; i++) {
      const n = rng.int(5);
      expect(Number.isInteger(n)).toBe(true);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(5);
    }
  });

  it('int() rejects non-positive bounds', () => {
    const rng = createSeededRng(1);
    expect(() => rng.int(0)).toThrow();
    expect(() => rng.int(-3)).toThrow();
  });

  it('different seeds diverge', () => {
    const a = createSeededRng('alpha');
    const b = createSeededRng('beta');
    expect(a.next()).not.toBe(b.next());
  });
});
