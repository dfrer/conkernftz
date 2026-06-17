import { describe, it, expect } from 'vitest';
import { placeFromPattern } from '../pattern-placement.js';
import type { Pattern, PatternBinding } from '../types/pattern.js';

const centerPattern: Pattern = { id: 'p', dots: [{ id: 'd', x: 0.5, y: 0.5, weight: 1 }] };

function binding(overrides: Partial<PatternBinding> = {}): PatternBinding {
  return {
    id: 'b',
    target: { type: 'layer', layer: 'L' },
    choices: [{ patternId: 'p', weight: 1 }],
    ...overrides,
  };
}

describe('placeFromPattern', () => {
  it('anchors a sized asset on the dot center (uses real asset dimensions)', () => {
    const res = placeFromPattern({
      seed: 's',
      canvas: { width: 200, height: 200 },
      asset: { width: 100, height: 100 },
      pattern: centerPattern,
      binding: binding({ anchor: { mode: 'center' } }),
    });
    // dot at (0.5, 0.5) of a 200px canvas → center (100, 100)
    expect(res.centerX).toBeCloseTo(100);
    expect(res.centerY).toBeCloseTo(100);
    // center anchor on a 100px asset → top-left offset by half the asset
    expect(res.left).toBe(50);
    expect(res.top).toBe(50);
  });

  it('topLeft anchor places the asset corner on the dot (no offset)', () => {
    const res = placeFromPattern({
      seed: 's',
      canvas: { width: 200, height: 200 },
      asset: { width: 100, height: 100 },
      pattern: centerPattern,
      binding: binding({ anchor: { mode: 'topLeft' } }),
    });
    expect(res.left).toBe(100);
    expect(res.top).toBe(100);
  });

  it('is deterministic for a given seed', () => {
    const input = {
      seed: 'k',
      canvas: { width: 128, height: 128 },
      asset: { width: 10, height: 10 },
      pattern: centerPattern,
      binding: binding({ rotation: { mode: 'uniform' as const, minDeg: 0, maxDeg: 360 } }),
    };
    expect(placeFromPattern(input)).toEqual(placeFromPattern(input));
  });

  it('throws when the pattern has no dots', () => {
    expect(() =>
      placeFromPattern({
        seed: 's',
        canvas: { width: 10, height: 10 },
        asset: { width: 1, height: 1 },
        pattern: { id: 'empty', dots: [] },
        binding: binding(),
      }),
    ).toThrow();
  });
});
