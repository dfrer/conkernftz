import { describe, it, expect } from 'vitest';
import { EvmJsonAdapter } from '../json-builder.js';

describe('EvmJsonAdapter', () => {
  it('builds OpenSea-standard metadata (no symbol/properties/seller fee)', () => {
    const json = EvmJsonAdapter.buildOffchainJson({
      index: 1,
      name: 'Collection #1',
      description: 'desc',
      imageUri: 'ipfs://img',
      attributes: [{ trait_type: 'Bg', value: 'A' }],
    });
    expect(json['name']).toBe('Collection #1');
    expect(json['image']).toBe('ipfs://img');
    expect(json['attributes']).toEqual([{ trait_type: 'Bg', value: 'A' }]);
    expect(json['symbol']).toBeUndefined();
    expect(json['properties']).toBeUndefined();
    expect(json['seller_fee_basis_points']).toBeUndefined();
  });

  it('includes animation_url and external_url when provided', () => {
    const json = EvmJsonAdapter.buildOffchainJson({
      index: 1,
      name: 'N',
      description: 'd',
      imageUri: 'i',
      attributes: [],
      animationUri: 'ipfs://anim',
      external_url: 'https://example.com',
    });
    expect(json['animation_url']).toBe('ipfs://anim');
    expect(json['external_url']).toBe('https://example.com');
  });

  it('reports id "ethereum"', () => {
    expect(EvmJsonAdapter.id).toBe('ethereum');
  });
});
