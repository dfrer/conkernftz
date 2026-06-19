import { describe, it, expect } from 'vitest';
import { computeTraitTable, formatPct } from '../lib/traits';

describe('computeTraitTable', () => {
  it('parses filename weights and normalizes to probabilities', () => {
    const t = computeTraitTable(['Gold#5.png', 'Silver#3.png', 'Bronze#2.png'], { delimiter: '#', defaultWeight: 1 });
    expect(t.total).toBe(10);
    expect(t.rows.map((r) => r.value)).toEqual(['Gold', 'Silver', 'Bronze']);
    expect(t.rows.map((r) => r.weight)).toEqual([5, 3, 2]);
    expect(t.rows.map((r) => r.probability)).toEqual([0.5, 0.3, 0.2]);
  });

  it('falls back to defaultWeight when a name has no weight suffix', () => {
    const t = computeTraitTable(['Plain.png', 'Heavy#3.png'], { delimiter: '#', defaultWeight: 1 });
    expect(t.total).toBe(4);
    expect(t.rows.find((r) => r.value === 'Plain')?.weight).toBe(1);
  });

  it('uniform mode ignores filename weights — every asset weighs 1', () => {
    const t = computeTraitTable(['Gold#5.png', 'Silver#3.png'], { delimiter: '#', defaultWeight: 1, uniform: true });
    expect(t.total).toBe(2);
    expect(t.rows.every((r) => r.weight === 1)).toBe(true);
    expect(t.rows.every((r) => r.probability === 0.5)).toBe(true);
  });

  it('ignores non-image files', () => {
    const t = computeTraitTable(['Gold#5.png', 'notes.txt', 'sub/'], { delimiter: '#', defaultWeight: 1 });
    expect(t.rows).toHaveLength(1);
  });

  it('returns zero probabilities (not NaN) for an empty layer', () => {
    const t = computeTraitTable([], { delimiter: '#', defaultWeight: 1 });
    expect(t.total).toBe(0);
    expect(t.rows).toEqual([]);
  });
});

describe('formatPct', () => {
  it('formats with adaptive precision and guards tiny/zero values', () => {
    expect(formatPct(0.5)).toBe('50.0%');
    expect(formatPct(0.0123)).toBe('1.23%');
    expect(formatPct(0)).toBe('0%');
    expect(formatPct(0.0005)).toBe('<0.1%');
  });
});
