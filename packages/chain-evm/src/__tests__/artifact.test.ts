import { describe, it, expect } from 'vitest';
import { conkernftzCollectionAbi, conkernftzCollectionBytecode } from '../artifact.js';
import { conkernftzLaunchAbi, conkernftzLaunchBytecode } from '../launch-artifact.js';

type AbiEntry = { type?: string; name?: string; inputs?: Array<{ type: string }> };
const fnNames = (abi: readonly AbiEntry[]): Set<string> =>
  new Set(abi.filter((e) => e.type === 'function').map((e) => e.name!));

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

describe('ConkernftzLaunch artifact', () => {
  it('exports deployable 0x-prefixed bytecode within the EIP-170 contract size limit', () => {
    expect(conkernftzLaunchBytecode.startsWith('0x')).toBe(true);
    const sizeBytes = (conkernftzLaunchBytecode.length - 2) / 2;
    expect(sizeBytes).toBeGreaterThan(0);
    expect(sizeBytes).toBeLessThan(24576); // EIP-170 max deployed contract size
  });

  it('exposes the full phased-mint surface', () => {
    const fns = fnNames(conkernftzLaunchAbi as readonly AbiEntry[]);
    for (const required of [
      'allowlistMint',
      'publicMint',
      'ownerMint',
      'setPhase',
      'setPrices',
      'setCaps',
      'setAllowlistRoot',
      'setTreasury',
      'reveal',
      'freezeMetadata',
      'withdraw',
      'pause',
      'unpause',
      'tokenURI',
      'totalMinted',
      'provenanceHash',
      'allowlistRoot',
      'supportsInterface',
    ]) {
      expect(fns.has(required), `missing function ${required}`).toBe(true);
    }
  });

  it('keeps the allowlistMint signature in lockstep with merkle.ts (qty, allowedQty, proof)', () => {
    const entry = (conkernftzLaunchAbi as readonly AbiEntry[]).find(
      (e) => e.type === 'function' && e.name === 'allowlistMint',
    );
    expect(entry?.inputs?.map((i) => i.type)).toEqual(['uint256', 'uint256', 'bytes32[]']);
  });

  it('uses Ownable2Step (two-step ownership handoff to a multisig)', () => {
    const fns = fnNames(conkernftzLaunchAbi as readonly AbiEntry[]);
    expect(fns.has('transferOwnership')).toBe(true);
    expect(fns.has('acceptOwnership')).toBe(true);
    expect(fns.has('pendingOwner')).toBe(true);
  });
});
