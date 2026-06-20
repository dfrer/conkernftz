import { describe, it, expect } from 'vitest';
import { assertChainAllowed, requiredConfirmToken } from '../lib/launchSafety.js';
import { parseAllowlist, formatFromPath } from '../lib/allowlistFile.js';

describe('mainnet safeguard', () => {
  it('allows testnets with no flags', () => {
    expect(() => assertChainAllowed(11155111, {})).not.toThrow(); // sepolia
    expect(() => assertChainAllowed(84532, {})).not.toThrow(); // base-sepolia
  });

  it('blocks mainnet without --mainnet', () => {
    expect(() => assertChainAllowed(1, {})).toThrow(/--mainnet/);
    expect(() => assertChainAllowed(8453, {})).toThrow(/--mainnet/);
  });

  it('blocks mainnet with --mainnet but no/incorrect --confirm token', () => {
    expect(() => assertChainAllowed(8453, { mainnet: true })).toThrow(/--confirm base/);
    expect(() => assertChainAllowed(8453, { mainnet: true, confirm: 'wrong' })).toThrow(/--confirm base/);
  });

  it('allows mainnet only with --mainnet and the correct typed token', () => {
    expect(() => assertChainAllowed(8453, { mainnet: true, confirm: 'base' })).not.toThrow();
    expect(() => assertChainAllowed(1, { mainnet: true, confirm: 'ethereum' })).not.toThrow();
  });

  it('treats unknown chain ids as mainnet, requiring the chainId as the confirm token', () => {
    expect(requiredConfirmToken(424242)).toBe('424242');
    expect(() => assertChainAllowed(424242, {})).toThrow(/--mainnet/);
    expect(() => assertChainAllowed(424242, { mainnet: true, confirm: '424242' })).not.toThrow();
  });
});

describe('allowlist file parsing', () => {
  it('parses CSV with a header and comments', () => {
    const csv = ['address,maxQty', '0xAAA,3', '# a comment', '', '0xBBB, 1'].join('\n');
    expect(parseAllowlist(csv, 'csv')).toEqual([
      { address: '0xAAA', maxQty: 3 },
      { address: '0xBBB', maxQty: 1 },
    ]);
  });

  it('parses a JSON array with qty aliases', () => {
    const json = JSON.stringify([
      { address: '0xAAA', maxQty: 3 },
      { address: '0xBBB', qty: 2 },
      { address: '0xCCC', quantity: 1 },
    ]);
    expect(parseAllowlist(json, 'json')).toEqual([
      { address: '0xAAA', maxQty: 3 },
      { address: '0xBBB', maxQty: 2 },
      { address: '0xCCC', maxQty: 1 },
    ]);
  });

  it('parses a JSON address→qty object', () => {
    expect(parseAllowlist('{"0xAAA":3,"0xBBB":1}', 'json')).toEqual([
      { address: '0xAAA', maxQty: 3 },
      { address: '0xBBB', maxQty: 1 },
    ]);
  });

  it('picks the format from the file extension', () => {
    expect(formatFromPath('list.json')).toBe('json');
    expect(formatFromPath('list.csv')).toBe('csv');
    expect(formatFromPath('list.txt')).toBe('csv');
  });
});
