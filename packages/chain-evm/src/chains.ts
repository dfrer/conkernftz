/**
 * Chain presets for the launch flow — the two mainnets and their testnets the launch targets
 * (Base + Ethereum L1; spec §9.4). Used for friendly `--chain base-sepolia` CLI selection and,
 * critically, for the mainnet safeguard: `isTestnet` is the allowlist that decides whether a
 * write is allowed without explicit `--mainnet --confirm`.
 */

export type ChainName = 'ethereum' | 'sepolia' | 'base' | 'base-sepolia';

export interface ChainPreset {
  name: ChainName;
  chainId: number;
  /** True only for chains we recognize as testnets — the safeguard allowlist. */
  testnet: boolean;
  /** A sensible public default RPC; callers should override with their own for reliability. */
  defaultRpcUrl: string;
  /** Block explorer base URL (for printing deploy/tx links). */
  explorer: string;
}

export const CHAIN_PRESETS: Record<ChainName, ChainPreset> = {
  ethereum: {
    name: 'ethereum',
    chainId: 1,
    testnet: false,
    defaultRpcUrl: 'https://eth.llamarpc.com',
    explorer: 'https://etherscan.io',
  },
  sepolia: {
    name: 'sepolia',
    chainId: 11155111,
    testnet: true,
    defaultRpcUrl: 'https://rpc.sepolia.org',
    explorer: 'https://sepolia.etherscan.io',
  },
  base: {
    name: 'base',
    chainId: 8453,
    testnet: false,
    defaultRpcUrl: 'https://mainnet.base.org',
    explorer: 'https://basescan.org',
  },
  'base-sepolia': {
    name: 'base-sepolia',
    chainId: 84532,
    testnet: true,
    defaultRpcUrl: 'https://sepolia.base.org',
    explorer: 'https://sepolia.basescan.org',
  },
};

/** Resolve a friendly chain name to its preset. Throws on an unknown name (with the valid set). */
export function resolvePreset(name: string): ChainPreset {
  const preset = CHAIN_PRESETS[name as ChainName];
  if (!preset) {
    throw new Error(`Unknown chain '${name}'. Valid: ${Object.keys(CHAIN_PRESETS).join(', ')}`);
  }
  return preset;
}

const KNOWN_TESTNET_IDS = new Set(
  Object.values(CHAIN_PRESETS)
    .filter((p) => p.testnet)
    .map((p) => p.chainId),
);

/**
 * Is this chain id a recognized testnet? Conservative by design: an UNKNOWN chain id returns
 * `false` (i.e. treated as mainnet) so the mainnet safeguard errs toward requiring `--confirm`
 * rather than letting an unrecognized chain through silently.
 */
export function isTestnet(chainId: number): boolean {
  return KNOWN_TESTNET_IDS.has(chainId);
}

/** Inverse of {@link isTestnet} — true for mainnets and any unrecognized chain id. */
export function isMainnet(chainId: number): boolean {
  return !isTestnet(chainId);
}

/** Build an explorer address URL when the chain id is a known preset, else `undefined`. */
export function explorerAddressUrl(chainId: number, address: string): string | undefined {
  const preset = Object.values(CHAIN_PRESETS).find((p) => p.chainId === chainId);
  return preset ? `${preset.explorer}/address/${address}` : undefined;
}

/** Build an explorer tx URL when the chain id is a known preset, else `undefined`. */
export function explorerTxUrl(chainId: number, txHash: string): string | undefined {
  const preset = Object.values(CHAIN_PRESETS).find((p) => p.chainId === chainId);
  return preset ? `${preset.explorer}/tx/${txHash}` : undefined;
}
