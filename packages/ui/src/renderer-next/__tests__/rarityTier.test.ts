import { describe, it, expect } from 'vitest';
import { tierForRank, buildTierMap, DEFAULT_TIER_SHARE } from '../lib/rarityTier';

const tiers = [{ tier: 'Legendary' }, { tier: 'Rare' }, { tier: 'Uncommon' }];

describe('tierForRank', () => {
  it('maps rarest-first cumulative bands at the default 5% share', () => {
    // 1000 editions, 3 tiers @ 5% → 50 each: 1–50 Legendary, 51–100 Rare, 101–150 Uncommon, 151+ common.
    expect(tierForRank(1, 1000, tiers)).toBe('Legendary');
    expect(tierForRank(50, 1000, tiers)).toBe('Legendary');
    expect(tierForRank(51, 1000, tiers)).toBe('Rare');
    expect(tierForRank(100, 1000, tiers)).toBe('Rare');
    expect(tierForRank(101, 1000, tiers)).toBe('Uncommon');
    expect(tierForRank(150, 1000, tiers)).toBe('Uncommon');
    expect(tierForRank(151, 1000, tiers)).toBe('');
    expect(tierForRank(1000, 1000, tiers)).toBe('');
  });

  it('honors per-tier share overrides', () => {
    const custom = [{ tier: 'Legendary', share: 0.01 }, { tier: 'Rare', share: 0.1 }];
    // 1000 editions: Legendary 1–10, Rare 11–110, common 111+.
    expect(tierForRank(10, 1000, custom)).toBe('Legendary');
    expect(tierForRank(11, 1000, custom)).toBe('Rare');
    expect(tierForRank(110, 1000, custom)).toBe('Rare');
    expect(tierForRank(111, 1000, custom)).toBe('');
  });

  it('guarantees at least one token per tier on tiny collections', () => {
    // 4 editions, 3 tiers: round(0.05*4)=0 → clamped to 1 each → ranks 1,2,3 are the tiers, 4 common.
    expect(tierForRank(1, 4, tiers)).toBe('Legendary');
    expect(tierForRank(2, 4, tiers)).toBe('Rare');
    expect(tierForRank(3, 4, tiers)).toBe('Uncommon');
    expect(tierForRank(4, 4, tiers)).toBe('');
  });

  it('returns common for invalid/empty inputs', () => {
    expect(tierForRank(0, 1000, tiers)).toBe('');
    expect(tierForRank(1, 0, tiers)).toBe('');
    expect(tierForRank(1, 1000, [])).toBe('');
    expect(tierForRank(Number.NaN, 1000, tiers)).toBe('');
  });

  it('exposes the default share constant', () => {
    expect(DEFAULT_TIER_SHARE).toBe(0.05);
  });
});

describe('buildTierMap', () => {
  it('includes only non-common tokens (edition → tier)', () => {
    const tokens = [
      { edition: 1, rank: 1 },   // Legendary
      { edition: 2, rank: 60 },  // Rare
      { edition: 3, rank: 500 }, // common → omitted
    ];
    const map = buildTierMap(tokens, 1000, tiers);
    expect(map).toEqual({ 1: 'Legendary', 2: 'Rare' });
    expect(map[3]).toBeUndefined();
  });

  it('returns an empty map with no tiers', () => {
    expect(buildTierMap([{ edition: 1, rank: 1 }], 1000, [])).toEqual({});
  });
});
