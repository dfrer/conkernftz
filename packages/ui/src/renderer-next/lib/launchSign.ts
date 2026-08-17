import {
  encodeDeployData,
  encodeFunctionData,
  parseEther,
  createClient,
  http,
  type Hex,
} from 'viem';
import { waitForTransactionReceipt } from 'viem/actions';
import { conkernftzLaunchAbi, conkernftzLaunchBytecode } from '@conkernftz/chain-evm';

/**
 * Non-custodial creator signing — build the deploy + admin transactions for the launch contract
 * and submit them through a connected EIP-1193 wallet (WalletConnect / injected). The wallet
 * always signs; no key file. The calldata builders are pure (encode the ABI) and unit-tested by
 * decoding them back; the senders just hand a `{to,data,value}` to `eth_sendTransaction`. Imports
 * only pure chain-evm artifacts (no node:fs), so this is safe in the renderer.
 */

const ZERO_HASH = `0x${'0'.repeat(64)}` as Hex;

export interface Eip1193Provider {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
}

export interface DeployInputs {
  name: string;
  symbol: string;
  maxSupply: number;
  placeholderUri: string;
  provenanceHash?: Hex;
  treasury: string;
  royaltyReceiver?: string;
  royaltyBps?: number;
}

export type LaunchPhase = 'closed' | 'allowlist' | 'public';
const PHASES: LaunchPhase[] = ['closed', 'allowlist', 'public'];

/** Map a friendly phase name to its on-chain enum value (Closed=0, Allowlist=1, Public=2). */
export function phaseEnum(p: LaunchPhase): number {
  return PHASES.indexOf(p);
}

function ctorArgs(i: DeployInputs): readonly unknown[] {
  return [
    i.name,
    i.symbol,
    BigInt(i.maxSupply),
    i.placeholderUri,
    i.provenanceHash ?? ZERO_HASH,
    i.treasury as Hex,
    (i.royaltyReceiver ?? i.treasury) as Hex,
    BigInt(i.royaltyBps ?? 0),
  ];
}

/** Calldata (bytecode + encoded constructor args) for deploying the launch contract. */
export function buildDeployData(i: DeployInputs): Hex {
  return encodeDeployData({
    abi: conkernftzLaunchAbi,
    bytecode: conkernftzLaunchBytecode,
    args: ctorArgs(i) as never,
  });
}

/** Calldata for any admin/owner write on the deployed contract. */
export function buildCallData(functionName: string, args: readonly unknown[]): Hex {
  return encodeFunctionData({ abi: conkernftzLaunchAbi, functionName: functionName as never, args: args as never });
}

// Per-op calldata helpers (keep parseEther/phase encoding in one place, mirroring the CLI/IPC).
export const callSetCaps = (publicWalletCap: number, maxPerTx: number): Hex =>
  buildCallData('setCaps', [BigInt(publicWalletCap), BigInt(maxPerTx)]);
export const callSetPrices = (allowlistEth: string, publicEth: string): Hex =>
  buildCallData('setPrices', [parseEther(allowlistEth), parseEther(publicEth)]);
export const callSetPhase = (p: LaunchPhase): Hex => buildCallData('setPhase', [phaseEnum(p)]);
export const callReveal = (baseUri: string): Hex => buildCallData('reveal', [baseUri]);
export const callFreeze = (): Hex => buildCallData('freezeMetadata', []);
export const callWithdraw = (): Hex => buildCallData('withdraw', []);
export const callSetAllowlistRoot = (root: Hex): Hex => buildCallData('setAllowlistRoot', [root]);

const toHexQty = (wei: bigint): Hex => `0x${wei.toString(16)}` as Hex;

/** Submit an admin write from the connected wallet; returns the tx hash. */
export async function walletSend(
  provider: Eip1193Provider,
  from: string,
  to: string,
  data: Hex,
  valueWei = 0n,
): Promise<Hex> {
  const tx = { from: from as Hex, to: to as Hex, data, value: toHexQty(valueWei) };
  return (await provider.request({ method: 'eth_sendTransaction', params: [tx] })) as Hex;
}

/** Submit a contract-creation tx (no `to`) from the connected wallet; returns the tx hash. */
export async function walletDeploy(
  provider: Eip1193Provider,
  from: string,
  inputs: DeployInputs,
): Promise<Hex> {
  const tx = { from: from as Hex, data: buildDeployData(inputs), value: '0x0' };
  return (await provider.request({ method: 'eth_sendTransaction', params: [tx] })) as Hex;
}

/** Wait for a deploy tx to mine and return the created contract address (read-only RPC). */
export async function waitForContractAddress(rpcUrl: string, txHash: Hex): Promise<Hex> {
  const client = createClient({ transport: http(rpcUrl) });
  const receipt = await waitForTransactionReceipt(client, { hash: txHash });
  if (!receipt.contractAddress) throw new Error('Deploy transaction did not create a contract.');
  return receipt.contractAddress;
}
