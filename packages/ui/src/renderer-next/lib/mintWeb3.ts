import { createPublicClient, http, encodeFunctionData, type Hex } from 'viem';
import {
  conkernftzLaunchAbi,
  LAUNCH_PHASES,
  toAddEthereumChainParams,
  type SaleSnapshot,
  type WalletMintState,
  type MintCall,
} from '@conkernftz/chain-evm';
import { mintedTokenIds } from './mintReceipt';

/**
 * Non-custodial browser mint connector. Talks to an injected EIP-1193 wallet (MetaMask et al.)
 * for connect / chain-switch / signing, and a read-only RPC for sale state. The funds-affecting
 * decisions live in `@conkernftz/chain-evm`'s tested `planMint`/`buildMintCall`; this file only
 * does the wallet I/O. It imports ONLY pure chain-evm exports (no node:fs) so it is safe to bundle
 * into the renderer and the exported static site.
 *
 * The wallet always signs — we never hold a key. Mints go out as a single `eth_sendTransaction`
 * with calldata from viem's `encodeFunctionData`, so there is no extra dependency surface.
 */

export interface Eip1193Provider {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
  on?(event: string, handler: (...args: unknown[]) => void): void;
  removeListener?(event: string, handler: (...args: unknown[]) => void): void;
}

export interface RawTx {
  from: Hex;
  to: Hex;
  data: Hex;
  /** Hex-quantity wei value (EIP-1193 expects a hex string, not a bigint). */
  value: Hex;
}

/** The injected wallet provider, or null if none is present. */
export function getInjectedProvider(): Eip1193Provider | null {
  const eth = (globalThis as { ethereum?: Eip1193Provider }).ethereum;
  return eth ?? null;
}

/** Request accounts + current chain id from the wallet. Throws if the user rejects. */
export async function connect(provider: Eip1193Provider): Promise<{ address: Hex; chainId: number }> {
  const accounts = (await provider.request({ method: 'eth_requestAccounts' })) as string[];
  const address = accounts?.[0];
  if (!address) throw new Error('No account returned by the wallet.');
  const chainIdHex = (await provider.request({ method: 'eth_chainId' })) as string;
  return { address: address as Hex, chainId: Number(BigInt(chainIdHex)) };
}

/**
 * Ensure the wallet is on `chainId`, prompting a switch (and, if the chain is unknown to the
 * wallet — error 4902 — an add) using EIP-3085 params. No-op if already on the right chain.
 */
export async function ensureChain(
  provider: Eip1193Provider,
  chainId: number,
  rpcUrl?: string,
): Promise<void> {
  const hexId = `0x${chainId.toString(16)}`;
  try {
    await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: hexId }] });
  } catch (err) {
    if (getErrorCode(err) === 4902) {
      // Chain not added to the wallet yet — add it, then it is selected.
      await provider.request({
        method: 'wallet_addEthereumChain',
        params: [toAddEthereumChainParams(chainId, rpcUrl)],
      });
      return;
    }
    throw err;
  }
}

export interface SaleStateWithWallet extends SaleSnapshot {
  revealed: boolean;
  wallet: WalletMintState;
}

/** Read the on-chain sale state (and the connected wallet's mint counts) over a read-only RPC. */
export async function readSale(
  rpcUrl: string,
  chainId: number,
  contractAddress: string,
  address?: string,
): Promise<SaleStateWithWallet> {
  const pub = createPublicClient({ transport: http(rpcUrl) });
  const address_ = contractAddress as Hex;
  const read = <T>(functionName: string, args: unknown[] = []): Promise<T> =>
    pub.readContract({
      address: address_,
      abi: conkernftzLaunchAbi,
      functionName,
      args,
      // chainId is informational here; the transport URL determines the network.
    } as never) as Promise<T>;

  const [
    phase,
    allowlistPriceWei,
    publicPriceWei,
    publicWalletCap,
    maxPerTx,
    totalMinted,
    maxSupply,
    revealed,
  ] = await Promise.all([
    read<number>('phase'),
    read<bigint>('allowlistPrice'),
    read<bigint>('publicPrice'),
    read<bigint>('publicWalletCap'),
    read<bigint>('maxPerTx'),
    read<bigint>('totalMinted'),
    read<bigint>('maxSupply'),
    read<boolean>('revealed'),
  ]);

  const wallet: WalletMintState = {};
  if (address) {
    const [allowlistMinted, publicMinted] = await Promise.all([
      read<bigint>('allowlistMinted', [address as Hex]),
      read<bigint>('publicMinted', [address as Hex]),
    ]);
    wallet.allowlistMinted = allowlistMinted;
    wallet.publicMinted = publicMinted;
  }

  return {
    phase: LAUNCH_PHASES[Number(phase)] ?? 'closed',
    allowlistPriceWei,
    publicPriceWei,
    publicWalletCap,
    maxPerTx,
    totalMinted,
    maxSupply,
    revealed,
    wallet,
  };
}

/** Encode a `MintCall` into a raw EIP-1193 transaction the wallet can sign. */
export function encodeMintTx(call: MintCall, from: string, to: string): RawTx {
  const data = encodeFunctionData({
    abi: conkernftzLaunchAbi,
    functionName: call.functionName,
    args: call.args as never,
  });
  return {
    from: from as Hex,
    to: to as Hex,
    data,
    value: `0x${call.valueWei.toString(16)}`,
  };
}

/** Submit a mint: the wallet signs and broadcasts. Returns the tx hash. */
export async function submitMint(
  provider: Eip1193Provider,
  from: string,
  to: string,
  call: MintCall,
): Promise<Hex> {
  const tx = encodeMintTx(call, from, to);
  const hash = (await provider.request({ method: 'eth_sendTransaction', params: [tx] })) as string;
  return hash as Hex;
}

/**
 * Wait for a mint tx's receipt and return the token ids it minted (OC-3b) — read-only RPC, used
 * by the live widget to map a buyer's tokens to their rarity tiers for the reveal.
 */
export async function waitForMintedTokenIds(rpcUrl: string, contract: string, hash: Hex): Promise<number[]> {
  const pub = createPublicClient({ transport: http(rpcUrl) });
  const receipt = await pub.waitForTransactionReceipt({ hash });
  return mintedTokenIds(
    receipt.logs.map((l) => ({ address: l.address, topics: l.topics as unknown as string[] })),
    contract,
  );
}

function getErrorCode(err: unknown): number | undefined {
  if (err && typeof err === 'object') {
    const code = (err as { code?: unknown }).code;
    if (typeof code === 'number') return code;
    // Some wallets nest the provider error.
    const inner = (err as { error?: { code?: unknown } }).error;
    if (inner && typeof inner.code === 'number') return inner.code;
  }
  return undefined;
}

/** Map a wallet/RPC error to a short, user-facing message. */
export function parseWalletError(err: unknown): string {
  const code = getErrorCode(err);
  if (code === 4001) return 'You rejected the request in your wallet.';
  if (code === 4902) return 'The required network is not added to your wallet.';
  if (code === -32002) return 'A wallet request is already pending — check your wallet.';
  const msg = err instanceof Error ? err.message : typeof err === 'string' ? err : '';
  if (/insufficient funds/i.test(msg)) return 'Insufficient funds for this mint plus gas.';
  return msg || 'Something went wrong talking to your wallet.';
}
