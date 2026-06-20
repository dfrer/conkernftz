import { describe, it, expect } from 'vitest';
import { dumpAllowlist } from '../merkle.js';
import { planMint, buildMintCall, proofFromDump, type SaleSnapshot } from '../mintPlan.js';

const ALICE = '0x00000000000000000000000000000000000000a1';
const BOB = '0x00000000000000000000000000000000000000b2';
const OUTSIDER = '0x0000000000000000000000000000000000009999';

const dump = dumpAllowlist([
  { address: ALICE, maxQty: 3 },
  { address: BOB, maxQty: 1 },
]);

const base: SaleSnapshot = {
  phase: 'public',
  allowlistPriceWei: 10_000_000_000_000_000n, // 0.01 ETH
  publicPriceWei: 20_000_000_000_000_000n, // 0.02 ETH
  publicWalletCap: 2n,
  maxPerTx: 5n,
  totalMinted: 0n,
  maxSupply: 100n,
};

describe('planMint — closed / sold out', () => {
  it('blocks when the sale is closed', () => {
    const p = planMint({ sale: { ...base, phase: 'closed' }, address: ALICE });
    expect(p.canMint).toBe(false);
    expect(p.maxMintable).toBe(0);
    expect(p.reason).toMatch(/not open/i);
  });

  it('blocks when sold out', () => {
    const p = planMint({ sale: { ...base, totalMinted: 100n }, address: ALICE });
    expect(p.canMint).toBe(false);
    expect(p.reason).toMatch(/sold out/i);
  });
});

describe('planMint — public phase', () => {
  it('allows up to the wallet cap and prices in public wei', () => {
    const p = planMint({ sale: base, address: BOB });
    expect(p.phase).toBe('public');
    expect(p.canMint).toBe(true);
    expect(p.maxMintable).toBe(2); // publicWalletCap
    expect(p.unitPriceWei).toBe(base.publicPriceWei);
  });

  it('subtracts already-minted from the wallet cap', () => {
    const p = planMint({ sale: base, address: BOB, wallet: { publicMinted: 1n } });
    expect(p.maxMintable).toBe(1);
  });

  it('reports cap reached when the wallet is maxed', () => {
    const p = planMint({ sale: base, address: BOB, wallet: { publicMinted: 2n } });
    expect(p.canMint).toBe(false);
    expect(p.reason).toMatch(/limit reached/i);
  });

  it('is bounded by maxPerTx and remaining supply', () => {
    const tightTx = planMint({ sale: { ...base, publicWalletCap: 50n, maxPerTx: 3n }, address: BOB });
    expect(tightTx.maxMintable).toBe(3);
    const tightSupply = planMint({
      sale: { ...base, publicWalletCap: 50n, maxPerTx: 50n, totalMinted: 99n },
      address: BOB,
    });
    expect(tightSupply.maxMintable).toBe(1);
  });
});

describe('planMint — allowlist phase', () => {
  const al: SaleSnapshot = { ...base, phase: 'allowlist' };

  it('blocks a wallet not on the list', () => {
    const p = planMint({ sale: al, address: OUTSIDER, allowlist: dump });
    expect(p.canMint).toBe(false);
    expect(p.reason).toMatch(/not on the allowlist/i);
  });

  it('uses the per-address cap from the proof and allowlist price', () => {
    const p = planMint({ sale: al, address: ALICE, allowlist: dump });
    expect(p.canMint).toBe(true);
    expect(p.maxMintable).toBe(3); // alice cap
    expect(p.unitPriceWei).toBe(al.allowlistPriceWei);
    expect(p.allowlist?.allowedQty).toBe(3);
    expect(p.allowlist?.proof.length).toBeGreaterThan(0);
  });

  it('subtracts already-minted from the allowlist allocation', () => {
    const p = planMint({ sale: al, address: ALICE, allowlist: dump, wallet: { allowlistMinted: 2n } });
    expect(p.maxMintable).toBe(1);
  });

  it('blocks when no allowlist dump is provided', () => {
    const p = planMint({ sale: al, address: ALICE });
    expect(p.canMint).toBe(false);
  });
});

describe('buildMintCall', () => {
  it('builds a public mint call with exact value', () => {
    const p = planMint({ sale: base, address: BOB });
    const call = buildMintCall(p, 2);
    expect(call.functionName).toBe('publicMint');
    expect(call.args).toEqual([2n]);
    expect(call.valueWei).toBe(base.publicPriceWei * 2n);
  });

  it('builds an allowlist mint call with qty, allowedQty and proof', () => {
    const p = planMint({ sale: { ...base, phase: 'allowlist' }, address: ALICE, allowlist: dump });
    const call = buildMintCall(p, 3);
    expect(call.functionName).toBe('allowlistMint');
    expect(call.args[0]).toBe(3n);
    expect(call.args[1]).toBe(3n); // allowedQty bound into the proof
    expect(Array.isArray(call.args[2])).toBe(true);
    expect(call.valueWei).toBe(base.allowlistPriceWei * 3n);
  });

  it('rejects qty over the max, below 1, or when minting is blocked', () => {
    const p = planMint({ sale: base, address: BOB });
    expect(() => buildMintCall(p, 3)).toThrow(/exceeds/);
    expect(() => buildMintCall(p, 0)).toThrow(/positive/);
    const closed = planMint({ sale: { ...base, phase: 'closed' }, address: BOB });
    expect(() => buildMintCall(closed, 1)).toThrow();
  });
});

describe('proofFromDump', () => {
  it('finds an address case-insensitively and returns null for outsiders', () => {
    expect(proofFromDump(dump, ALICE.toLowerCase())?.allowedQty).toBe(3);
    expect(proofFromDump(dump, OUTSIDER)).toBeNull();
  });
});
