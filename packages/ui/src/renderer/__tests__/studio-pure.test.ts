import { describe, it, expect } from 'vitest';
import {
  reorderLayers,
  parseWeightFromFilename,
  traitValueFromFilename,
  setWeightInFilename,
  predictedDistribution,
  histogramFromCounts,
  filterAnimationFiles,
  isVideoFile,
  buildRenamePairs,
  makeSeed,
} from '../studio/pure.js';

describe('reorderLayers', () => {
  it('moves an item down', () => {
    expect(reorderLayers(['a', 'b', 'c', 'd'], 0, 2)).toEqual(['b', 'c', 'a', 'd']);
  });
  it('moves an item up', () => {
    expect(reorderLayers(['a', 'b', 'c', 'd'], 3, 1)).toEqual(['a', 'd', 'b', 'c']);
  });
  it('is a no-op for equal or out-of-range indices', () => {
    expect(reorderLayers(['a', 'b'], 1, 1)).toEqual(['a', 'b']);
    expect(reorderLayers(['a', 'b'], 5, 0)).toEqual(['a', 'b']);
  });
  it('does not mutate the input', () => {
    const src = ['a', 'b', 'c'];
    reorderLayers(src, 0, 2);
    expect(src).toEqual(['a', 'b', 'c']);
  });
});

describe('weights in filenames', () => {
  it('parses weights and defaults', () => {
    expect(parseWeightFromFilename('Hat#10.png')).toBe(10);
    expect(parseWeightFromFilename('Hat.png')).toBe(1);
    expect(parseWeightFromFilename('Hat#0.png')).toBe(1); // non-positive -> default
    expect(parseWeightFromFilename('Hat#abc.png', '#', 5)).toBe(5);
  });
  it('extracts the trait value', () => {
    expect(traitValueFromFilename('Blue Hat#10.png')).toBe('Blue Hat');
    expect(traitValueFromFilename('Plain.png')).toBe('Plain');
  });
  it('sets/replaces the weight, preserving value + extension', () => {
    expect(setWeightInFilename('Hat#10.png', 3)).toBe('Hat#3.png');
    expect(setWeightInFilename('Hat.png', 7)).toBe('Hat#7.png');
    expect(setWeightInFilename('Blue Hat#2.webp', 9)).toBe('Blue Hat#9.webp');
    expect(setWeightInFilename('Hat#10.png', 0)).toBe('Hat#1.png'); // floored to >=1
  });
});

describe('predictedDistribution', () => {
  it('computes per-value shares from weights', () => {
    const d = predictedDistribution({
      name: 'Bg',
      values: [
        { value: 'Red', weight: 3, filename: 'Red#3.png' },
        { value: 'Blue', weight: 1, filename: 'Blue#1.png' },
      ],
    });
    expect(d.find((e) => e.value === 'Red')!.share).toBeCloseTo(0.75, 6);
    expect(d.find((e) => e.value === 'Blue')!.share).toBeCloseTo(0.25, 6);
  });
  it('handles a zero-weight layer without dividing by zero', () => {
    const d = predictedDistribution({ name: 'X', values: [{ value: 'A', weight: 0, filename: 'A.png' }] });
    expect(d[0]!.share).toBe(0);
  });
});

describe('histogramFromCounts', () => {
  it('builds bars sorted by count desc with percentages', () => {
    const bars = histogramFromCounts({ Cap: 3, Crown: 1 }, 4);
    expect(bars[0]).toEqual({ value: 'Cap', count: 3, pct: 0.75 });
    expect(bars[1]).toEqual({ value: 'Crown', count: 1, pct: 0.25 });
  });
});

describe('animation file filtering', () => {
  it('keeps animated files in numeric order', () => {
    expect(filterAnimationFiles(['1.png', '2.gif', '10.gif', '1.mp4', 'a.txt'])).toEqual(['1.mp4', '2.gif', '10.gif']);
  });
  it('detects video files', () => {
    expect(isVideoFile('1.mp4')).toBe(true);
    expect(isVideoFile('1.gif')).toBe(false);
  });
});

describe('buildRenamePairs', () => {
  it('renumbers with base name + index and optional weight', () => {
    expect(buildRenamePairs(['x.png', 'y.png'], 'Trait', 1)).toEqual([
      { from: 'x.png', to: 'Trait 1.png' },
      { from: 'y.png', to: 'Trait 2.png' },
    ]);
    expect(buildRenamePairs(['x.png'], 'Trait', 5, '#', 4)).toEqual([{ from: 'x.png', to: 'Trait 5#4.png' }]);
  });
});

describe('makeSeed', () => {
  it('produces distinct prefixed seeds', () => {
    const a = makeSeed('g');
    const b = makeSeed('g');
    expect(a.startsWith('g:')).toBe(true);
    expect(a).not.toBe(b);
  });
});
