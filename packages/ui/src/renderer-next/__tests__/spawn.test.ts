import { describe, it, expect } from 'vitest';
import { emptyMap, addDot, moveDot, updateDot, removeDot, toggleLayerDot, setRules, clampUnit, nextDotId, layerHasDot } from '../lib/spawn';

describe('spawn map helpers', () => {
  it('clampUnit clamps to 0..1 and guards NaN', () => {
    expect(clampUnit(-1)).toBe(0);
    expect(clampUnit(2)).toBe(1);
    expect(clampUnit(0.5)).toBe(0.5);
    expect(clampUnit(NaN)).toBe(0);
  });

  it('addDot appends a clamped, id-d dot', () => {
    const m = addDot(emptyMap(), 1.5, -0.2);
    expect(m.dots).toHaveLength(1);
    expect(m.dots[0]).toMatchObject({ id: 'dot-1', x: 1, y: 0, weight: 1 });
  });

  it('moveDot and updateDot modify the right dot', () => {
    let m = addDot(emptyMap(), 0.1, 0.1);
    m = moveDot(m, 'dot-1', 0.5, 0.6);
    expect(m.dots[0]).toMatchObject({ x: 0.5, y: 0.6 });
    m = updateDot(m, 'dot-1', { weight: 3 });
    expect(m.dots[0]!.weight).toBe(3);
  });

  it('toggleLayerDot adds then removes a mapping', () => {
    let m = addDot(emptyMap(), 0.5, 0.5);
    m = toggleLayerDot(m, 'BG', 'dot-1');
    expect(layerHasDot(m, 'BG', 'dot-1')).toBe(true);
    m = toggleLayerDot(m, 'BG', 'dot-1');
    expect(layerHasDot(m, 'BG', 'dot-1')).toBe(false);
  });

  it('removeDot deletes the dot and cleans its mappings', () => {
    let m = addDot(emptyMap(), 0.5, 0.5);
    m = toggleLayerDot(m, 'BG', 'dot-1');
    m = removeDot(m, 'dot-1');
    expect(m.dots).toHaveLength(0);
    expect(m.mappings?.layerToDotIds?.BG).toEqual([]);
  });

  it('setRules merges into existing rules', () => {
    const m = setRules(emptyMap(), { fitMode: 'cover' });
    expect(m.rules?.fitMode).toBe('cover');
    expect(m.rules?.selection).toBe('weighted');
  });

  it('nextDotId skips existing ids', () => {
    expect(nextDotId([{ id: 'dot-1', x: 0, y: 0 }, { id: 'dot-3', x: 0, y: 0 }])).toBe('dot-4');
  });
});
