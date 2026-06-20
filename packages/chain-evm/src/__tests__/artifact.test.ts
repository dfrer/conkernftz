import { describe, it, expect } from 'vitest';
import { conkernftzCollectionAbi, conkernftzCollectionBytecode } from '../artifact.js';

describe('ConkernftzCollection artifact', () => {
  it('exports a non-empty ABI with a constructor and callable functions', () => {
    expect(Array.isArray(conkernftzCollectionAbi)).toBe(true);
    expect(conkernftzCollectionAbi.length).toBeGreaterThan(0);
    const types = new Set((conkernftzCollectionAbi as Array<{ type?: string }>).map((e) => e.type));
    expect(types.has('constructor')).toBe(true);
    expect(types.has('function')).toBe(true);
  });

  it('exports deployable 0x-prefixed bytecode', () => {
    expect(typeof conkernftzCollectionBytecode).toBe('string');
    expect(conkernftzCollectionBytecode.startsWith('0x')).toBe(true);
    expect(conkernftzCollectionBytecode.length).toBeGreaterThan(2);
  });
});
