import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resolveChain, loadPrivateKey } from '../deploy.js';

describe('resolveChain', () => {
  it('returns the known viem chain for a recognized id', () => {
    expect(resolveChain(1, 'http://x').id).toBe(1); // Ethereum mainnet
    expect(resolveChain(8453, 'http://x').id).toBe(8453); // Base
  });

  it('falls back to a custom chain (using the given RPC) for an unknown id', () => {
    const c = resolveChain(987654, 'https://rpc.example/');
    expect(c.id).toBe(987654);
    expect(c.name).toBe('chain-987654');
    expect(c.rpcUrls.default.http[0]).toBe('https://rpc.example/');
    expect(c.nativeCurrency.symbol).toBe('ETH');
  });
});

describe('loadPrivateKey', () => {
  const dir = mkdtempSync(join(tmpdir(), 'evm-key-'));
  const write = (name: string, content: string): string => {
    const p = join(dir, name);
    writeFileSync(p, content);
    return p;
  };

  it('prefixes 0x when the key file has none', async () => {
    expect(await loadPrivateKey(write('a.txt', 'abc123'))).toBe('0xabc123');
  });

  it('keeps an existing 0x prefix', async () => {
    expect(await loadPrivateKey(write('b.txt', '0xdeadbeef'))).toBe('0xdeadbeef');
  });

  it('trims whitespace and surrounding quotes', async () => {
    expect(await loadPrivateKey(write('c.txt', '  "0xfeed"\n'))).toBe('0xfeed');
  });
});
