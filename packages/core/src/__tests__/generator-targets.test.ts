import { describe, it, expect } from 'vitest';
import { generateEditionsConstrained, type GeneratedEdition } from '../../src/generator.js';
import type { LayerCatalogEntry } from '../../src/catalog.js';
import type { LayerSpec } from '../../src/types.js';

function layer(name: string, values: Array<[string, number]>): LayerCatalogEntry {
  return {
    spec: { name, path: name } as unknown as LayerSpec,
    options: values.map(([value, weight]) => ({ filePath: `${name}/${value}.png`, value, weight })),
  };
}

function tally(editions: GeneratedEdition[], layerName: string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const ed of editions) {
    const v = ed.traits[layerName];
    if (v) counts[v] = (counts[v] ?? 0) + 1;
  }
  return counts;
}

describe('distribution targets', () => {
  it('hits exact counts when targets sum to the edition count', () => {
    const catalog = [layer('Bg', [['Gold', 1], ['Silver', 1], ['Bronze', 1]])];
    const editions = generateEditionsConstrained(catalog, 50, { seed: 'targets-1' }, {
      rules: { targets: [{ trait: 'Bg:Gold', count: 30 }, { trait: 'Bg:Silver', count: 20 }] },
    });
    expect(editions).toHaveLength(50);
    expect(tally(editions, 'Bg')).toEqual({ Gold: 30, Silver: 20 });
  });

  it('treats a target as an exact cap, backfilling the rest with untargeted values', () => {
    const catalog = [layer('Bg', [['Gold', 1], ['Silver', 1]])];
    const editions = generateEditionsConstrained(catalog, 50, { seed: 'targets-2' }, {
      rules: { targets: [{ trait: 'Bg:Gold', count: 10 }] },
    });
    const counts = tally(editions, 'Bg');
    expect(counts.Gold).toBe(10);
    expect(counts.Silver).toBe(40);
  });

  it('never exceeds a target even when its count is smaller than demand', () => {
    const catalog = [layer('Bg', [['Gold', 5], ['Silver', 1]])];
    const editions = generateEditionsConstrained(catalog, 100, { seed: 'targets-3' }, {
      rules: { targets: [{ trait: 'Bg:Gold', count: 25 }] },
    });
    // Gold is heavily weighted but capped to exactly 25; the rest fall to Silver.
    expect(tally(editions, 'Bg')).toEqual({ Gold: 25, Silver: 75 });
  });

  it('is deterministic for a given seed', () => {
    const make = (): GeneratedEdition[] =>
      generateEditionsConstrained([layer('Bg', [['Gold', 1], ['Silver', 1], ['Bronze', 1]])], 40, { seed: 'det' }, {
        rules: { targets: [{ trait: 'Bg:Gold', count: 10 }, { trait: 'Bg:Bronze', count: 10 }] },
      });
    expect(make().map((e) => e.traits.Bg)).toEqual(make().map((e) => e.traits.Bg));
  });

  it('leaves generation unchanged when no targets are set', () => {
    const catalog = (): LayerCatalogEntry[] => [layer('Bg', [['Gold', 2], ['Silver', 1]])];
    const baseline = generateEditionsConstrained(catalog(), 30, { seed: 's' }, {}).map((e) => e.traits.Bg);
    const emptyTargets = generateEditionsConstrained(catalog(), 30, { seed: 's' }, { rules: { targets: [] } }).map(
      (e) => e.traits.Bg,
    );
    expect(emptyTargets).toEqual(baseline);
  });
});
