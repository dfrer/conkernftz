import { describe, it, expect } from 'vitest';
import { computeTraitStatistics, rankEditions, scoreToken } from '../rarity-score.js';

const editions = [
  { traits: { Background: 'Red', Hat: 'Crown' } }, // edition 1 — rarest (has Crown)
  { traits: { Background: 'Red', Hat: 'Cap' } }, // edition 2
  { traits: { Background: 'Blue', Hat: 'Cap' } }, // edition 3
  { traits: { Background: 'Blue', Hat: 'Cap' } }, // edition 4
];

describe('rarity-score', () => {
  it('computes per-trait frequency and statistical rarity', () => {
    const stats = computeTraitStatistics(editions);
    expect(stats.editionCount).toBe(4);
    expect(stats.traits.Background!.Red).toEqual({ count: 2, frequency: 0.5, rarityScore: 2 });
    expect(stats.traits.Hat!.Crown!.rarityScore).toBe(4); // 1 / (1/4)
    expect(stats.traits.Hat!.Cap!.rarityScore).toBeCloseTo(4 / 3, 6); // 1 / (3/4)
  });

  it('scores a token as the sum of its trait rarity', () => {
    const stats = computeTraitStatistics(editions);
    expect(scoreToken({ Background: 'Red', Hat: 'Crown' }, stats)).toBeCloseTo(6, 6); // 2 + 4
  });

  it('ranks the rarest token first and breaks ties by edition order', () => {
    const { tokens } = rankEditions(editions);
    const byEdition = new Map(tokens.map((t) => [t.edition, t]));
    expect(byEdition.get(1)!.rank).toBe(1);
    expect(byEdition.get(1)!.score).toBeCloseTo(6, 6);
    // editions 2,3,4 tie on score -> ranks follow edition order
    expect(byEdition.get(2)!.rank).toBe(2);
    expect(byEdition.get(3)!.rank).toBe(3);
    expect(byEdition.get(4)!.rank).toBe(4);
  });
});
