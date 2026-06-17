import type { ChainAdapter } from '@conkernftz/core';

export interface BuildJsonInput {
  index: number;
  name: string;
  description: string;
  imageUri: string;
  animationUri?: string;
  attributes: Array<{ trait_type: string; value: string }>;
  external_url?: string;
  files?: Array<{ uri: string; type: string }>;
  symbol?: string;
}

export const SolanaJsonAdapter: Pick<ChainAdapter, 'buildOffchainJson' | 'validateProjectConfig' | 'id'> = {
  id: 'solana',
  validateProjectConfig(): void {
    // Detailed validation is handled by zod in core; adapter-specific checks can be added here
    return;
  },
  buildOffchainJson(input: any) {
    const files = (input.files ?? [{ uri: input.imageUri, type: mimeFromUri(input.imageUri) }]).map(
      (f: { uri: string; type: string }) => ({ uri: f.uri, type: f.type }),
    );
    const category = files.some((f: { uri: string; type: string }) => f.type.startsWith('video/'))
      ? 'video'
      : 'image';
    const json: Record<string, unknown> = {
      name: input.name,
      symbol: input.symbol ?? '',
      description: input.description,
      image: input.imageUri,
      attributes: input.attributes,
      properties: { files, category },
    };
    if (input.animationUri) json['animation_url'] = input.animationUri;
    if (input.external_url) json['external_url'] = input.external_url;
    return json;
  },
};

function mimeFromUri(uri: string): string {
  if (uri.endsWith('.png')) return 'image/png';
  if (uri.endsWith('.webp')) return 'image/webp';
  if (uri.endsWith('.gif')) return 'image/gif';
  if (uri.endsWith('.mp4')) return 'video/mp4';
  // Arweave/IPFS URIs often lack extensions; default to image/png for our pipeline
  return 'image/png';
}


