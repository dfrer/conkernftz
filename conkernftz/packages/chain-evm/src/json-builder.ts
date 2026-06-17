import type { ChainAdapter } from '@conkernftz/core';

/**
 * Builds ERC-721 / OpenSea-standard metadata JSON. Unlike the Solana variant there is no
 * `symbol`, `properties.files`, or `seller_fee_basis_points` — royalties live on-chain via
 * ERC-2981, and marketplaces read `attributes`, `image`, and optional `animation_url`.
 */
export const EvmJsonAdapter: Pick<ChainAdapter, 'buildOffchainJson' | 'validateProjectConfig' | 'id'> = {
  id: 'ethereum',
  validateProjectConfig(): void {
    return;
  },
  buildOffchainJson(input) {
    const json: Record<string, unknown> = {
      name: input.name,
      description: input.description,
      image: input.imageUri,
      attributes: input.attributes,
    };
    if (input.animationUri) json['animation_url'] = input.animationUri;
    if (input.external_url) json['external_url'] = input.external_url;
    return json;
  },
};
