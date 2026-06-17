import { describe, it, expect } from 'vitest';
import { SolanaJsonAdapter } from '../json-builder.js';

interface Properties {
  files: Array<{ uri: string; type: string }>;
  category: string;
}

describe('Solana JSON builder', () => {
  it('includes attributes, image, and properties.files with a type', () => {
    const json = SolanaJsonAdapter.buildOffchainJson({
      index: 1,
      name: 'Example #1',
      description: 'Example',
      imageUri: 'ar://txid',
      attributes: [{ trait_type: 'Background', value: 'Royal' }],
    });
    expect(json['image']).toBe('ar://txid');
    const props = json['properties'] as Properties;
    expect(Array.isArray(props.files)).toBe(true);
    expect(props.files[0]!.type).toBeDefined();
    expect(props.category).toBe('image');
  });

  it('marks the category as "video" when a video file is present', () => {
    const json = SolanaJsonAdapter.buildOffchainJson({
      index: 2,
      name: 'Animated #2',
      description: 'Has a video',
      imageUri: 'ar://thumb',
      attributes: [],
      files: [
        { uri: 'ar://thumb', type: 'image/png' },
        { uri: 'ar://clip', type: 'video/mp4' },
      ],
    });
    const props = json['properties'] as Properties;
    expect(props.category).toBe('video');
  });
});
