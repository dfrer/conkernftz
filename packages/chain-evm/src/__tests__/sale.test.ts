import { describe, it, expect } from 'vitest';
import {
  CHAIN_PRESETS,
  resolvePreset,
  isTestnet,
  isMainnet,
  explorerAddressUrl,
  explorerTxUrl,
} from '../chains.js';
import { LAUNCH_PHASES, phaseToEnum, phaseFromEnum } from '../sale.js';
import { launchConstructorArgs, ZERO_HASH, type EvmLaunchDeployConfig } from '../deploy.js';
import { conkernftzLaunchAbi } from '../launch-artifact.js';

describe('chain presets', () => {
  it('resolves the four launch chains by name', () => {
    expect(resolvePreset('base').chainId).toBe(8453);
    expect(resolvePreset('base-sepolia').chainId).toBe(84532);
    expect(resolvePreset('ethereum').chainId).toBe(1);
    expect(resolvePreset('sepolia').chainId).toBe(11155111);
  });

  it('throws on an unknown chain name, listing the valid set', () => {
    expect(() => resolvePreset('polygon')).toThrow(/Valid:/);
  });

  it('classifies known testnets vs mainnets', () => {
    expect(isTestnet(11155111)).toBe(true); // sepolia
    expect(isTestnet(84532)).toBe(true); // base-sepolia
    expect(isTestnet(1)).toBe(false); // ethereum
    expect(isTestnet(8453)).toBe(false); // base
  });

  it('treats UNKNOWN chain ids as mainnet (safeguard errs toward requiring --confirm)', () => {
    expect(isTestnet(999999)).toBe(false);
    expect(isMainnet(999999)).toBe(true);
  });

  it('builds explorer URLs for known chains and undefined for unknown', () => {
    expect(explorerAddressUrl(8453, '0xabc')).toBe('https://basescan.org/address/0xabc');
    expect(explorerTxUrl(1, '0xdef')).toBe('https://etherscan.io/tx/0xdef');
    expect(explorerAddressUrl(999999, '0xabc')).toBeUndefined();
  });

  it('every preset testnet flag is internally consistent', () => {
    for (const p of Object.values(CHAIN_PRESETS)) {
      expect(isTestnet(p.chainId)).toBe(p.testnet);
    }
  });
});

describe('phase mapping', () => {
  it('round-trips name <-> enum (Closed=0, Allowlist=1, Public=2)', () => {
    expect(phaseToEnum('closed')).toBe(0);
    expect(phaseToEnum('allowlist')).toBe(1);
    expect(phaseToEnum('public')).toBe(2);
    for (const name of LAUNCH_PHASES) {
      expect(phaseFromEnum(phaseToEnum(name))).toBe(name);
    }
  });

  it('throws on an out-of-range enum value', () => {
    expect(() => phaseFromEnum(3)).toThrow();
  });
});

describe('launchConstructorArgs', () => {
  const base: EvmLaunchDeployConfig = {
    rpcUrl: 'http://x',
    chainId: 84532,
    privateKeyPath: '/dev/null',
    name: 'Conker',
    symbol: 'CONK',
    maxSupply: 1000,
    placeholderUri: 'ipfs://ph',
    treasury: '0x000000000000000000000000000000000000dEaD',
  };

  it('defaults provenanceHash to ZERO_HASH and royaltyReceiver to the treasury', () => {
    const args = launchConstructorArgs(base);
    expect(args[2]).toBe(1000n); // maxSupply as bigint
    expect(args[4]).toBe(ZERO_HASH); // provenanceHash default
    expect(args[6]).toBe(base.treasury); // royaltyReceiver defaults to treasury
    expect(args[7]).toBe(0n); // royaltyBps default (uint96 → bigint)
  });

  it('rejects a non-positive maxSupply and a missing treasury', () => {
    expect(() => launchConstructorArgs({ ...base, maxSupply: 0 })).toThrow(/maxSupply/);
    expect(() => launchConstructorArgs({ ...base, treasury: '' })).toThrow(/treasury/);
  });
});

describe('sale.ts only calls real ABI functions', () => {
  // Guards against a typo'd functionName string in a writeLaunch/read call (which would only
  // fail at runtime against a live node). Every name sale.ts uses must exist in the ABI.
  const abiFns = new Set(
    (conkernftzLaunchAbi as ReadonlyArray<{ type?: string; name?: string }>)
      .filter((e) => e.type === 'function')
      .map((e) => e.name),
  );
  const used = [
    'setAllowlistRoot',
    'setPhase',
    'setPrices',
    'setCaps',
    'setTreasury',
    'reveal',
    'freezeMetadata',
    'withdraw',
    'pause',
    'unpause',
    'ownerMint',
    'publicMint',
    'allowlistMint',
    'phase',
    'allowlistPrice',
    'publicPrice',
    'publicWalletCap',
    'maxPerTx',
    'allowlistRoot',
    'totalMinted',
    'maxSupply',
    'revealed',
    'metadataFrozen',
    'configLocked',
    'treasury',
    'owner',
  ];
  it.each(used)('ABI exposes %s', (fn) => {
    expect(abiFns.has(fn)).toBe(true);
  });
});
