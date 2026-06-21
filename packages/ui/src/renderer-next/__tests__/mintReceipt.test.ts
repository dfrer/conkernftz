import { describe, it, expect } from 'vitest';
import { mintedTokenIds, tiersForTokens, TRANSFER_TOPIC } from '../lib/mintReceipt';

const CONTRACT = '0xAbC0000000000000000000000000000000000001';
const ZERO = '0x0000000000000000000000000000000000000000000000000000000000000000';
const addr = (a: string) => '0x000000000000000000000000' + a.replace(/^0x/, '');
const tokenTopic = (n: number) => '0x' + n.toString(16).padStart(64, '0');

describe('mintedTokenIds', () => {
  it('extracts token ids from ERC-721 mint logs (from == 0x0)', () => {
    const logs = [
      { address: CONTRACT, topics: [TRANSFER_TOPIC, ZERO, addr('beef'), tokenTopic(7)] },
      { address: CONTRACT, topics: [TRANSFER_TOPIC, ZERO, addr('beef'), tokenTopic(8)] },
    ];
    expect(mintedTokenIds(logs, CONTRACT)).toEqual([7, 8]);
  });

  it('ignores non-mint transfers, other contracts, and ERC-20 (3-topic) logs', () => {
    const logs = [
      { address: CONTRACT, topics: [TRANSFER_TOPIC, addr('dead'), addr('beef'), tokenTopic(1)] }, // resale, not mint
      { address: '0xother', topics: [TRANSFER_TOPIC, ZERO, addr('beef'), tokenTopic(2)] }, // other contract
      { address: CONTRACT, topics: [TRANSFER_TOPIC, ZERO, addr('beef')] }, // ERC-20 (no tokenId topic)
      { address: CONTRACT, topics: ['0xdeadbeef', ZERO, addr('beef'), tokenTopic(3)] }, // not Transfer
      { address: CONTRACT, topics: [TRANSFER_TOPIC, ZERO, addr('beef'), tokenTopic(5)] }, // valid mint
    ];
    expect(mintedTokenIds(logs, CONTRACT)).toEqual([5]);
  });

  it('is case-insensitive on the contract address + topic, sorts + de-dupes', () => {
    const logs = [
      { address: CONTRACT.toLowerCase(), topics: [TRANSFER_TOPIC.toUpperCase(), ZERO, addr('beef'), tokenTopic(9)] },
      { address: CONTRACT, topics: [TRANSFER_TOPIC, ZERO, addr('beef'), tokenTopic(2)] },
      { address: CONTRACT, topics: [TRANSFER_TOPIC, ZERO, addr('beef'), tokenTopic(2)] }, // dupe
    ];
    expect(mintedTokenIds(logs, CONTRACT)).toEqual([2, 9]);
  });

  it('returns [] for empty / missing logs', () => {
    expect(mintedTokenIds([], CONTRACT)).toEqual([]);
    expect(mintedTokenIds(undefined as never, CONTRACT)).toEqual([]);
  });
});

describe('tiersForTokens', () => {
  it('maps token ids to tiers via the embedded map (common → "")', () => {
    expect(tiersForTokens([1, 2, 3], { 1: 'Legendary', 3: 'Rare' })).toEqual(['Legendary', '', 'Rare']);
  });
  it('returns all-common when there is no map', () => {
    expect(tiersForTokens([1, 2], undefined)).toEqual(['', '']);
  });
});
