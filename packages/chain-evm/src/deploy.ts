import fs from 'node:fs/promises';
import path from 'node:path';
import {
  createWalletClient,
  createPublicClient,
  http,
  defineChain,
  encodeDeployData,
  type Chain,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import * as chains from 'viem/chains';
import { conkernftzCollectionAbi, conkernftzCollectionBytecode } from './artifact.js';
import { conkernftzLaunchAbi, conkernftzLaunchBytecode } from './launch-artifact.js';

export interface EvmDeployConfig {
  rpcUrl: string;
  chainId: number;
  /** Path to a file containing the deployer's EVM private key (hex, with or without 0x). */
  privateKeyPath: string;
  name: string;
  symbol: string;
  /** ERC-721 baseURI, e.g. `ipfs://<cid>/`. Token N resolves to `<baseURI>N.json`. */
  baseUri?: string;
  /** Hard cap on supply; 0 (default) means unlimited. */
  maxSupply?: number;
  /** Royalty receiver (defaults to the deployer). */
  royaltyReceiver?: string;
  /** Royalty in basis points (e.g. 500 = 5%). */
  royaltyBps?: number;
}

export interface DeployResult {
  address: string;
  txHash: string;
}

/** Deploy the ConkernftzCollection ERC-721 contract and return its address. */
export async function deployCollection(cfg: EvmDeployConfig): Promise<DeployResult> {
  const account = privateKeyToAccount(await loadPrivateKey(cfg.privateKeyPath));
  const chain = resolveChain(cfg.chainId, cfg.rpcUrl);
  const wallet = createWalletClient({ account, chain, transport: http(cfg.rpcUrl) });
  const pub = createPublicClient({ chain, transport: http(cfg.rpcUrl) });

  const hash = await wallet.deployContract({
    abi: conkernftzCollectionAbi,
    bytecode: conkernftzCollectionBytecode,
    args: [
      cfg.name,
      cfg.symbol,
      cfg.baseUri ?? '',
      BigInt(cfg.maxSupply ?? 0),
      (cfg.royaltyReceiver ?? account.address) as `0x${string}`,
      BigInt(cfg.royaltyBps ?? 0),
    ],
  });
  const receipt = await pub.waitForTransactionReceipt({ hash });
  if (!receipt.contractAddress) throw new Error('Deployment did not return a contract address');
  return { address: receipt.contractAddress, txHash: hash };
}

/** Zero bytes32 — the default provenance hash when the caller hasn't committed one. */
export const ZERO_HASH = `0x${'0'.repeat(64)}` as `0x${string}`;

export interface EvmLaunchDeployConfig {
  rpcUrl: string;
  chainId: number;
  /** Path to a file containing the deployer's EVM private key (hex, with or without 0x). */
  privateKeyPath: string;
  name: string;
  symbol: string;
  /** Hard cap on supply (must be > 0). */
  maxSupply: number;
  /** Pre-reveal placeholder tokenURI (returned for every token until `reveal`). */
  placeholderUri: string;
  /**
   * Provenance hash committed at construction (a hash over the final asset/DNA set) for
   * fair-mint proof. Defaults to {@link ZERO_HASH}; set a real value for a verifiable mint.
   */
  provenanceHash?: `0x${string}`;
  /** Treasury that receives withdrawn proceeds (should be a Safe multisig). Required, non-zero. */
  treasury: string;
  /** Royalty receiver (defaults to the treasury). */
  royaltyReceiver?: string;
  /** Royalty in basis points (e.g. 500 = 5%). */
  royaltyBps?: number;
}

/** Validate config and build the ConkernftzLaunch constructor argument tuple. */
export function launchConstructorArgs(
  cfg: EvmLaunchDeployConfig,
): readonly [string, string, bigint, string, `0x${string}`, `0x${string}`, `0x${string}`, bigint] {
  if (cfg.maxSupply <= 0) throw new Error('maxSupply must be > 0');
  if (!cfg.treasury) throw new Error('treasury is required');
  return [
    cfg.name,
    cfg.symbol,
    BigInt(cfg.maxSupply),
    cfg.placeholderUri,
    cfg.provenanceHash ?? ZERO_HASH,
    cfg.treasury as `0x${string}`,
    (cfg.royaltyReceiver ?? cfg.treasury) as `0x${string}`,
    BigInt(cfg.royaltyBps ?? 0),
  ] as const;
}

/**
 * Deploy the launch-grade `ConkernftzLaunch` contract (phased allowlist → public → reveal mint)
 * and return its address. The contract starts in the `Closed` phase with no prices/caps/root —
 * configure those with the `sale.ts` helpers before opening a phase.
 */
export async function deployLaunch(cfg: EvmLaunchDeployConfig): Promise<DeployResult> {
  const args = launchConstructorArgs(cfg);
  const account = privateKeyToAccount(await loadPrivateKey(cfg.privateKeyPath));
  const chain = resolveChain(cfg.chainId, cfg.rpcUrl);
  const wallet = createWalletClient({ account, chain, transport: http(cfg.rpcUrl) });
  const pub = createPublicClient({ chain, transport: http(cfg.rpcUrl) });

  const hash = await wallet.deployContract({
    abi: conkernftzLaunchAbi,
    bytecode: conkernftzLaunchBytecode,
    args,
  });
  const receipt = await pub.waitForTransactionReceipt({ hash });
  if (!receipt.contractAddress) throw new Error('Deployment did not return a contract address');
  return { address: receipt.contractAddress, txHash: hash };
}

export interface DeployEstimate {
  deployer: `0x${string}`;
  balanceWei: bigint;
  gas: bigint;
  gasPriceWei: bigint;
  /** Estimated total deploy cost (gas × gasPrice). */
  costWei: bigint;
  /** Whether the deployer balance covers the estimated cost. */
  sufficient: boolean;
}

/**
 * Dry-run a launch deploy: estimate gas + cost and check the deployer's balance covers it.
 * Powers the CLI's `--dry-run` and the pre-deploy balance gate (no transaction is sent).
 */
export async function estimateLaunchDeploy(cfg: EvmLaunchDeployConfig): Promise<DeployEstimate> {
  const args = launchConstructorArgs(cfg);
  const account = privateKeyToAccount(await loadPrivateKey(cfg.privateKeyPath));
  const chain = resolveChain(cfg.chainId, cfg.rpcUrl);
  const pub = createPublicClient({ chain, transport: http(cfg.rpcUrl) });
  const data = encodeDeployData({
    abi: conkernftzLaunchAbi,
    bytecode: conkernftzLaunchBytecode,
    args,
  });
  const [gas, gasPriceWei, balanceWei] = await Promise.all([
    pub.estimateGas({ account, data }),
    pub.getGasPrice(),
    pub.getBalance({ address: account.address }),
  ]);
  const costWei = gas * gasPriceWei;
  return {
    deployer: account.address,
    balanceWei,
    gas,
    gasPriceWei,
    costWei,
    sufficient: balanceWei >= costWei,
  };
}

/** Resolve a viem Chain by id, falling back to a minimal custom chain using the given RPC. */
export function resolveChain(chainId: number, rpcUrl: string): Chain {
  // viem exports each chain with a distinct literal type; treat them uniformly as Chain.
  const all = Object.values(chains) as unknown as Chain[];
  const known = all.find((c) => c?.id === chainId);
  if (known) return known;
  return defineChain({
    id: chainId,
    name: `chain-${chainId}`,
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: { default: { http: [rpcUrl] } },
  });
}

/** Read an EVM private key from a file and normalize it to a 0x-prefixed hex string. */
export async function loadPrivateKey(keyPath: string): Promise<`0x${string}`> {
  const raw = (await fs.readFile(path.resolve(keyPath), 'utf8')).trim().replace(/^"|"$/g, '');
  return (raw.startsWith('0x') ? raw : `0x${raw}`) as `0x${string}`;
}
