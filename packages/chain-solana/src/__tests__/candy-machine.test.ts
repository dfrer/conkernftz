import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import os from 'node:os';
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  buildConfigLines,
  resolveGuards,
  loadAllowlist,
  getAllowlistRoot,
  getAllowlistProof,
  bytesToHex,
  hexToBytes,
  mapCandyMachineAccount,
} from '../candy-machine.js';

describe('buildConfigLines', () => {
  it('maps name + uri', () => {
    expect(buildConfigLines([{ name: 'A #1', uri: 'ipfs://a' }])).toEqual([{ name: 'A #1', uri: 'ipfs://a' }]);
  });
  it('throws on a missing uri', () => {
    expect(() => buildConfigLines([{ name: 'A', uri: '' }])).toThrow(/uri/);
  });
});

describe('resolveGuards', () => {
  it('passes through solPayment and mintLimit', () => {
    const r = resolveGuards({ solPayment: { sol: 1.5, destination: 'Dest' }, mintLimit: { id: 1, limit: 3 } });
    expect(r.solPayment).toEqual({ sol: 1.5, destination: 'Dest' });
    expect(r.mintLimit).toEqual({ id: 1, limit: 3 });
  });
  it('parses an ISO start date to unix seconds', () => {
    const r = resolveGuards({ startDate: { date: '2025-01-01T00:00:00Z' } });
    expect(r.startDate?.unixSeconds).toBe(1735689600);
  });
  it('passes through a numeric start date', () => {
    expect(resolveGuards({ startDate: { date: 123 } }).startDate?.unixSeconds).toBe(123);
  });
  it('throws on an invalid start date', () => {
    expect(() => resolveGuards({ startDate: { date: 'not-a-date' } })).toThrow(/Invalid startDate/);
  });
});

describe('loadAllowlist', () => {
  let dir: string;
  beforeAll(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'conkernftz-al-'));
    await fs.writeFile(path.join(dir, 'a.json'), JSON.stringify(['Addr1', 'Addr2']));
    await fs.writeFile(path.join(dir, 'a.csv'), 'Addr1, Addr2\nAddr3\n');
  });
  afterAll(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });
  it('parses a JSON array file', async () => {
    expect(await loadAllowlist(dir, 'a.json')).toEqual(['Addr1', 'Addr2']);
  });
  it('parses a comma/newline file', async () => {
    expect(await loadAllowlist(dir, 'a.csv')).toEqual(['Addr1', 'Addr2', 'Addr3']);
  });
});

describe('mapCandyMachineAccount', () => {
  const acc = (over = {}) => ({
    itemsRedeemed: 0n,
    itemsLoaded: 0,
    authority: { toString: () => 'AUTH' },
    collectionMint: { toString: () => 'COLL' },
    data: { itemsAvailable: 10n },
    ...over,
  });
  it('maps bigint + number fields to a JSON-safe status', () => {
    const s = mapCandyMachineAccount('CM', acc({ itemsRedeemed: 3n, itemsLoaded: 10 }));
    expect(s).toMatchObject({ candyMachine: 'CM', collection: 'COLL', authority: 'AUTH', itemsAvailable: 10, itemsLoaded: 10, itemsRedeemed: 3 });
  });
  it('reports fullyLoaded once every config line is inserted', () => {
    expect(mapCandyMachineAccount('CM', acc({ itemsLoaded: 9 })).fullyLoaded).toBe(false);
    expect(mapCandyMachineAccount('CM', acc({ itemsLoaded: 10 })).fullyLoaded).toBe(true);
  });
  it('reports soldOut once every item is minted', () => {
    expect(mapCandyMachineAccount('CM', acc({ itemsRedeemed: 9n })).soldOut).toBe(false);
    expect(mapCandyMachineAccount('CM', acc({ itemsRedeemed: 10n })).soldOut).toBe(true);
  });
  it('treats an empty (0-item) machine as neither loaded nor sold out', () => {
    const s = mapCandyMachineAccount('CM', acc({ data: { itemsAvailable: 0n } }));
    expect(s.fullyLoaded).toBe(false);
    expect(s.soldOut).toBe(false);
  });
  it('omits collection when absent', () => {
    expect(mapCandyMachineAccount('CM', acc({ collectionMint: undefined })).collection).toBeUndefined();
  });
});

describe('hex helpers', () => {
  it('round-trips bytes <-> hex', () => {
    const b = new Uint8Array([0, 255, 16, 1]);
    expect(bytesToHex(b)).toBe('00ff1001');
    expect([...hexToBytes('00ff1001')]).toEqual([0, 255, 16, 1]);
  });
});

describe('allowList merkle (Core Candy Guard SDK)', () => {
  const addrs = ['11111111111111111111111111111111', 'So11111111111111111111111111111111111111112'];
  it('computes a deterministic 32-byte root', async () => {
    const r1 = await getAllowlistRoot(addrs);
    const r2 = await getAllowlistRoot(addrs);
    expect(r1.length).toBe(32);
    expect(bytesToHex(r1)).toBe(bytesToHex(r2));
  });
  it('produces a proof for a member', async () => {
    const proof = await getAllowlistProof(addrs, addrs[0]!);
    expect(Array.isArray(proof)).toBe(true);
    expect(proof.every((p) => p instanceof Uint8Array)).toBe(true);
  });
});
