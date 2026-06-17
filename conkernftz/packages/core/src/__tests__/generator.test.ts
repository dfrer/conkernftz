import { describe, it, expect } from 'vitest';
import { generateEditions, generateEditionsConstrained } from '../generator.js';
import type { LayerCatalogEntry } from '../catalog.js';

function catalog(): LayerCatalogEntry[] {
  return [
    {
      spec: { name: 'Bg', path: 'bg' },
      options: [
        { filePath: 'bg/a.png', value: 'A', weight: 1 },
        { filePath: 'bg/b.png', value: 'B', weight: 1 },
      ],
    },
    {
      spec: { name: 'Body', path: 'body' },
      options: [
        { filePath: 'body/x.png', value: 'X', weight: 1 },
        { filePath: 'body/y.png', value: 'Y', weight: 1 },
      ],
    },
  ];
}

describe('generateEditions', () => {
  it('generates the requested count with one pick per layer', () => {
    const eds = generateEditions(catalog(), 3, { seed: 's' });
    expect(eds).toHaveLength(3);
    for (const e of eds) {
      expect(Object.keys(e.traits).sort()).toEqual(['Bg', 'Body']);
    }
  });

  it('is deterministic for a seed', () => {
    expect(generateEditions(catalog(), 4, { seed: 'z' })).toEqual(
      generateEditions(catalog(), 4, { seed: 'z' }),
    );
  });
});

describe('generateEditionsConstrained', () => {
  it('enforces DNA uniqueness across editions', () => {
    const eds = generateEditionsConstrained(catalog(), 4, { seed: 'u' }, { uniqueness: { hash: 'sha256' } });
    const combos = new Set(eds.map((e) => `${e.traits['Bg']}-${e.traits['Body']}`));
    expect(combos.size).toBe(4); // 2x2 = exactly four unique combinations
  });

  it('throws when uniqueness cannot be satisfied', () => {
    expect(() =>
      generateEditionsConstrained(catalog(), 5, { seed: 'u' }, { uniqueness: { hash: 'sha256' } }),
    ).toThrow();
  });

  it('respects mutuallyExclusive rules', () => {
    const eds = generateEditionsConstrained(
      catalog(),
      3,
      { seed: 'r' },
      { rules: { mutuallyExclusive: [['Bg:A', 'Body:X']] }, uniqueness: { hash: 'sha256' } },
    );
    for (const e of eds) {
      expect(e.traits['Bg'] === 'A' && e.traits['Body'] === 'X').toBe(false);
    }
  });

  it('respects maxOccurrences across editions', () => {
    const eds = generateEditionsConstrained(
      catalog(),
      3,
      { seed: 'm' },
      { rules: { maxOccurrences: [{ trait: 'Bg:A', max: 1 }] }, uniqueness: { hash: 'sha256' } },
    );
    expect(eds.filter((e) => e.traits['Bg'] === 'A').length).toBeLessThanOrEqual(1);
  });

  it('produces placements when a pattern is bound to a layer', () => {
    const eds = generateEditionsConstrained(
      catalog(),
      2,
      { seed: 'p' },
      {
        uniqueness: { hash: 'sha256' },
        imageSize: { width: 100, height: 100 },
        patterns: [{ id: 'p', dots: [{ id: 'd', x: 0.5, y: 0.5, weight: 1 }] }],
        patternBindings: [
          {
            id: 'b',
            target: { type: 'layer', layer: 'Body' },
            choices: [{ patternId: 'p', weight: 1 }],
            anchor: { mode: 'center' },
          },
        ],
      },
    );
    expect(eds.every((e) => (e.placements?.length ?? 0) >= 1)).toBe(true);
    expect(eds[0]!.placements![0]!.layer).toBe('Body');
    expect(eds[0]!.placements![0]!.centerX).toBeCloseTo(50);
  });
});
