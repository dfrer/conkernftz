import { describe, it, expect } from 'vitest';
import { resolveWorkerCount } from '../render-pool.js';

describe('resolveWorkerCount', () => {
  it('stays in-process (1) unless more than one worker is requested', () => {
    expect(resolveWorkerCount(undefined, 100)).toBe(1);
    expect(resolveWorkerCount(0, 100)).toBe(1);
    expect(resolveWorkerCount(1, 100)).toBe(1);
  });

  it('returns 1 when there is at most one job', () => {
    expect(resolveWorkerCount(8, 1)).toBe(1);
    expect(resolveWorkerCount(8, 0)).toBe(1);
  });

  it('never exceeds the job count or the requested count', () => {
    const a = resolveWorkerCount(4, 100);
    expect(a).toBeGreaterThanOrEqual(1);
    expect(a).toBeLessThanOrEqual(4);
    const b = resolveWorkerCount(8, 3);
    expect(b).toBeGreaterThanOrEqual(1);
    expect(b).toBeLessThanOrEqual(3);
  });
});
