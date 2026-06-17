import { describe, it, expect } from 'vitest';
import { withRetry, mimeFor, createProvider } from '../provider.js';
import { LocalProvider } from '../providers/local.js';

describe('withRetry', () => {
  it('returns immediately on success', async () => {
    expect(await withRetry(async () => 42)).toBe(42);
  });

  it('retries then succeeds', async () => {
    let n = 0;
    const r = await withRetry(
      async () => {
        n++;
        if (n < 3) throw new Error('boom');
        return 'ok';
      },
      { attempts: 3, baseDelayMs: 1, maxDelayMs: 2 },
    );
    expect(r).toBe('ok');
    expect(n).toBe(3);
  });

  it('throws the last error after exhausting attempts', async () => {
    await expect(
      withRetry(async () => {
        throw new Error('nope');
      }, { attempts: 2, baseDelayMs: 1 }),
    ).rejects.toThrow('nope');
  });
});

describe('mimeFor', () => {
  it('maps known extensions and falls back', () => {
    expect(mimeFor('a.png')).toBe('image/png');
    expect(mimeFor('a.webp')).toBe('image/webp');
    expect(mimeFor('a.gif')).toBe('image/gif');
    expect(mimeFor('a.mp4')).toBe('video/mp4');
    expect(mimeFor('a.json')).toBe('application/json');
    expect(mimeFor('a.unknownext')).toBe('application/octet-stream');
  });
});

describe('createProvider', () => {
  it('constructs the local provider', async () => {
    const p = await createProvider({ provider: 'local', projectRoot: process.cwd() });
    expect(p).toBeInstanceOf(LocalProvider);
    expect(p.id).toBe('local');
  });

  it('rejects deprecated providers with migration guidance', async () => {
    await expect(createProvider({ provider: 'arweave', projectRoot: process.cwd() })).rejects.toThrow(/deprecated/i);
    await expect(createProvider({ provider: 'ipfs', projectRoot: process.cwd() })).rejects.toThrow(/deprecated/i);
  });

  it('requires a JWT for pinata', async () => {
    await expect(createProvider({ provider: 'pinata', projectRoot: process.cwd() })).rejects.toThrow(/jwt/i);
  });
});
