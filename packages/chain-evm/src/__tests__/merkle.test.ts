import { describe, it, expect } from 'vitest';
import { StandardMerkleTree } from '@openzeppelin/merkle-tree';
import { getAddress } from 'viem';
import {
  ALLOWLIST_FORMAT,
  ALLOWLIST_LEAF_ENCODING,
  allowlistRoot,
  buildAllowlistTree,
  dumpAllowlist,
  leafHash,
  proofForAddress,
  verifyAllowlistProof,
  type AllowlistEntry,
} from '../merkle.js';

const A = '0x1111111111111111111111111111111111111111';
const B = '0x2222222222222222222222222222222222222222';
const C = '0x3333333333333333333333333333333333333333';
const OUTSIDER = '0x9999999999999999999999999999999999999999';

const list: AllowlistEntry[] = [
  { address: A, maxQty: 3 },
  { address: B, maxQty: 1 },
  { address: C, maxQty: 5 },
];

describe('allowlist root', () => {
  it('is deterministic and order-independent', () => {
    const r1 = allowlistRoot(list);
    const r2 = allowlistRoot([list[2], list[0], list[1]]);
    expect(r1).toMatch(/^0x[0-9a-f]{64}$/);
    expect(r2).toBe(r1); // StandardMerkleTree sorts leaves, so input order doesn't matter
  });
});

describe('cross-impl leaf encoding (threat T13)', () => {
  it('viem-recomputed leaf hash equals the tree leaf hash for every entry', () => {
    const tree = buildAllowlistTree(list);
    for (const [, value] of tree.entries()) {
      const [addr, qty] = value;
      // tree.leafHash is what MerkleProof.verify reconstructs on-chain; leafHash() mirrors it in viem.
      expect(leafHash(addr, Number(qty))).toBe(tree.leafHash(value));
    }
  });
});

describe('dumpAllowlist', () => {
  it('tags the format, counts entries, and every proof verifies against the root', () => {
    const dump = dumpAllowlist(list);
    expect(dump.format).toBe(ALLOWLIST_FORMAT);
    expect(dump.count).toBe(3);
    for (const e of dump.entries) {
      expect(verifyAllowlistProof(dump.root, e.address, e.maxQty, e.proof)).toBe(true);
    }
  });

  it('checksums addresses in the output', () => {
    const dump = dumpAllowlist([{ address: A.toLowerCase(), maxQty: 2 }]);
    expect(dump.entries[0].address).toBe(getAddress(A));
  });
});

describe('proofForAddress', () => {
  it('finds an entry case-insensitively and the proof verifies', () => {
    const root = allowlistRoot(list);
    const p = proofForAddress(list, A.toUpperCase().replace('0X', '0x'));
    expect(p).not.toBeNull();
    expect(p!.maxQty).toBe(3);
    expect(verifyAllowlistProof(root, p!.address, p!.maxQty, p!.proof)).toBe(true);
  });

  it('returns null for an address not on the list and for a malformed address', () => {
    expect(proofForAddress(list, OUTSIDER)).toBeNull();
    expect(proofForAddress(list, 'not-an-address')).toBeNull();
  });
});

describe('verifyAllowlistProof rejects tampering (forged-proof resistance)', () => {
  const root = allowlistRoot(list);
  const valid = proofForAddress(list, A)!;

  it('rejects a different (higher) maxQty with a valid proof — the cap is bound into the leaf', () => {
    expect(verifyAllowlistProof(root, valid.address, valid.maxQty + 1, valid.proof)).toBe(false);
  });

  it("rejects reusing A's proof for another address", () => {
    expect(verifyAllowlistProof(root, B, valid.maxQty, valid.proof)).toBe(false);
  });

  it('rejects an outsider not in the tree', () => {
    expect(verifyAllowlistProof(root, OUTSIDER, 1, valid.proof)).toBe(false);
  });

  it('rejects a tampered proof node', () => {
    const bad = [...valid.proof];
    bad[0] = ('0x' + 'de'.repeat(32)) as `0x${string}`;
    expect(verifyAllowlistProof(root, valid.address, valid.maxQty, bad)).toBe(false);
  });
});

describe('normalize rejects bad configuration', () => {
  it('throws on an empty list', () => {
    expect(() => allowlistRoot([])).toThrow(/empty/);
  });
  it('throws on an invalid address', () => {
    expect(() => allowlistRoot([{ address: '0xnope', maxQty: 1 }])).toThrow(/invalid address/);
  });
  it('throws on maxQty < 1 or non-integer', () => {
    expect(() => allowlistRoot([{ address: A, maxQty: 0 }])).toThrow(/maxQty/);
    expect(() => allowlistRoot([{ address: A, maxQty: 1.5 }])).toThrow(/maxQty/);
  });
  it('throws on a duplicate address (case-insensitive)', () => {
    expect(() =>
      allowlistRoot([
        { address: A, maxQty: 1 },
        { address: A.toLowerCase(), maxQty: 2 },
      ]),
    ).toThrow(/duplicate/);
  });
});

describe('ALLOWLIST_LEAF_ENCODING', () => {
  it('matches the documented Solidity abi.encode(address, uint256)', () => {
    expect([...ALLOWLIST_LEAF_ENCODING]).toEqual(['address', 'uint256']);
  });
  it('the standard tree verify agrees with our wrapper', () => {
    const tree = buildAllowlistTree(list);
    const value = [getAddress(A), '3'];
    const proof = tree.getProof(value as [string, string]);
    expect(
      StandardMerkleTree.verify(tree.root, [...ALLOWLIST_LEAF_ENCODING], value, proof),
    ).toBe(true);
  });
});
