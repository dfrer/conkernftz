import { describe, it, expect } from 'vitest';
import {
  EXPERIENCE_PRESETS,
  DEFAULT_EXPERIENCE,
  resolveExperience,
  revealLabel,
  hasPack,
  type ExperienceConfig,
} from '../lib/mintExperience';

describe('mintExperience', () => {
  it('resolves defaults from an empty config', () => {
    expect(resolveExperience({})).toEqual(DEFAULT_EXPERIENCE);
    expect(resolveExperience(null)).toEqual(DEFAULT_EXPERIENCE);
  });

  it('clamps packCount / durationMs and falls back on an invalid kind', () => {
    const r = resolveExperience({ kind: 'bogus', packCount: 99, durationMs: 1 } as unknown as Partial<ExperienceConfig>);
    expect(r.kind).toBe(DEFAULT_EXPERIENCE.kind);
    expect(r.packCount).toBe(12);
    expect(r.durationMs).toBe(50);
  });

  it('keeps valid overrides and omits empty optionals', () => {
    const r = resolveExperience({ kind: 'flip', packCount: 4, label: 'X', shake: false, autoFlip: true, accent: '' });
    expect(r.kind).toBe('flip');
    expect(r.packCount).toBe(4);
    expect(r.label).toBe('X');
    expect(r.autoFlip).toBe(true);
    expect('accent' in r).toBe(false);
  });

  it('falls back to the default label when blank', () => {
    expect(resolveExperience({ label: '   ' }).label).toBe(DEFAULT_EXPERIENCE.label);
  });

  it('revealLabel and hasPack reflect the kind', () => {
    expect(revealLabel(resolveExperience({ kind: 'cardPack' }))).toBe('Rip open');
    expect(revealLabel(resolveExperience({ kind: 'fade' }))).toBe('Reveal');
    expect(hasPack(resolveExperience({ kind: 'cardPack' }))).toBe(true);
    expect(hasPack(resolveExperience({ kind: 'flip' }))).toBe(false);
  });

  it('keeps valid rarity-back rules and drops malformed ones', () => {
    const r = resolveExperience({
      packId: 'p1',
      backId: 'b-default',
      rarityBacks: [
        { tier: 'Rare', backId: 'b-eye' },
        { tier: '', backId: 'b-x' }, // empty tier → dropped
        { tier: 'Legendary', backId: '' }, // empty back → dropped
        { tier: 'Holo' } as unknown as { tier: string; backId: string }, // missing back → dropped
      ],
    });
    expect(r.packId).toBe('p1');
    expect(r.backId).toBe('b-default');
    expect(r.rarityBacks).toEqual([{ tier: 'Rare', backId: 'b-eye' }]);
  });

  it('omits rarityBacks entirely when no rule is valid', () => {
    expect('rarityBacks' in resolveExperience({ rarityBacks: [{ tier: '', backId: '' }] })).toBe(false);
  });

  it('every preset is stable through resolve (idempotent)', () => {
    for (const p of Object.values(EXPERIENCE_PRESETS)) {
      expect(resolveExperience(resolveExperience(p))).toEqual(resolveExperience(p));
    }
  });

  it('preserves runtime-resolved art through repeated resolves (site/export pass-through)', () => {
    // The site/export path runs resolveExperience multiple times; it must NOT strip the
    // resolved art, or the layered pack rip + rarity backs vanish from the generated site.
    const resolved: Partial<ExperienceConfig> = {
      kind: 'cardPack',
      packId: 'conkerco-default',
      packArt: 'data:img/pack',
      packOpenArt: 'data:img/open',
      packOpenFrontArt: 'data:img/front',
      packOpenBackArt: 'data:img/back',
      backArt: 'data:img/cardback',
      tierBacks: { Rare: 'data:img/rare' },
    };
    const once = resolveExperience(resolved);
    const twice = resolveExperience(once); // simulate buildSiteData → template → renderer
    for (const r of [once, twice]) {
      expect(r.packArt).toBe('data:img/pack');
      expect(r.packOpenArt).toBe('data:img/open');
      expect(r.packOpenFrontArt).toBe('data:img/front');
      expect(r.packOpenBackArt).toBe('data:img/back');
      expect(r.backArt).toBe('data:img/cardback');
      expect(r.tierBacks).toEqual({ Rare: 'data:img/rare' });
    }
  });
});
