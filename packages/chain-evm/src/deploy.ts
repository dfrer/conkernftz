import fs from 'node:fs/promises';
import path from 'node:path';
import { createWalletClient, createPublicClient, http, defineChain, type Chain } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import * as chains from 'viem/chains';
import { conkernftzCollectionAbi, conkernftzCollectionBytecode } from './artifact.js';

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
