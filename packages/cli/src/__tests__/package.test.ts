import { describe, it, expect } from 'vitest';
import pkg from '../../package.json';

describe('package.json', () => {
  it('exposes the CLI package name', () => {
    expect(pkg.name).toBe('@foundry/cli');
  });
});

