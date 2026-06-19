import { describe, it, expect } from 'vitest';
import { makeStarterConfig, deriveSymbol, STARTER_LAYERS } from '../lib/newProject';

describe('deriveSymbol', () => {
  it('upper-cases alphanumerics and caps length', () => {
    expect(deriveSymbol('Specimens')).toBe('SPECIMEN');
    expect(deriveSymbol('My Cool Drop!')).toBe('MYCOOLDR');
    expect(deriveSymbol('!!!')).toBe('COLL'); // fallback when nothing usable remains
  });
});

describe('makeStarterConfig', () => {
  it('builds a sensible default config', () => {
    const cfg = makeStarterConfig({ name: 'Specimens' });
    expect(cfg.name).toBe('Specimens');
    expect(cfg.symbol).toBe('SPECIMEN');
    expect(cfg.editionSize).toBe(100);
    expect(cfg.image).toMatchObject({ width: 1024, height: 1024 });
    expect((cfg as { chain?: { target?: string } }).chain?.target).toBe('evm');
  });

  it('scaffolds the starter layers, last one optional, paths under layers/', () => {
    const cfg = makeStarterConfig({ name: 'X' });
    expect(cfg.layers?.map((l) => l.name)).toEqual([...STARTER_LAYERS]);
    expect(cfg.layers?.map((l) => l.path)).toEqual(STARTER_LAYERS.map((n) => `layers/${n}`));
    expect(cfg.layers?.at(-1)?.required).toBe(false);
    expect(cfg.layers?.[0]?.required).toBe(true);
  });

  it('honors explicit symbol, chain, and edition size; floors fractional sizes', () => {
    const cfg = makeStarterConfig({ name: 'Y', symbol: 'yo', chain: 'solana', editionSize: 50.9 });
    expect(cfg.symbol).toBe('YO');
    expect((cfg as { chain?: { target?: string } }).chain?.target).toBe('solana');
    expect(cfg.editionSize).toBe(50);
  });

  it('falls back to defaults for blank name / non-positive edition size', () => {
    const cfg = makeStarterConfig({ name: '   ', editionSize: 0 });
    expect(cfg.name).toBe('Untitled Collection');
    expect(cfg.editionSize).toBe(100);
  });
});
