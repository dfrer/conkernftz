import { describe, it, expect } from 'vitest';
import { SolanaJsonAdapter } from '../../src/json-builder.js';

describe('Solana JSON builder', () => {
  it('includes attributes, image, and properties.files type', () => {
    const json = SolanaJsonAdapter.buildOffchainJson({
      index: 1,
      name: 'Example #1',
      description: 'Example',
      imageUri: 'ar://txid',
      attributes: [{ trait_type: 'Background', value: 'Royal' }],
    });
    expect(json['image']).toBe('ar://txid');
    const props = json['properties'] as any;
    expect(Array.isArray(props.files)).toBe(true);
    expect(props.files[0].type).toBeDefined();
  });
});


