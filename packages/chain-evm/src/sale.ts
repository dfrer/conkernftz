import {
  createWalletClient,
  createPublicClient,
  http,
  type Hex,
  type Account,
  type Chain,
  type PublicClient,
  type WalletClient,
  type ContractFunctionName,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { resolveChain, loadPrivateKey } from './deploy.js';
import { conkernftzLaunchAbi } from './launch-artifact.js';

type LaunchAbi = typeof conkernftzLaunchAbi;
type LaunchNonpayableFn = ContractFunctionName<LaunchAbi, 'nonpayable'>;
type LaunchPayableFn = ContractFunctionName<LaunchAbi, 'payable'>;
type LaunchReadFn = ContractFunctionName<LaunchAbi, 'view' | 'pure'>;

/**
 * Post-deploy operations for `ConkernftzLaunch`: phase/price/cap/root admin, reveal/freeze,
 * withdraw, and (test) mints, plus a read-only sale-state snapshot. Every write goes through one
 * `writeLaunch` helper so the account/chain/receipt handling is uniform. The agent never deploys
 * to mainnet or signs there — these run against testnet (or, for mainnet, the owner's own wallet
 * via the UI). See EVM_LAUNCH_SPEC.md §7.
 */

export const LAUNCH_PHASES = ['closed', 'allowlist', 'public'] as const;
export type LaunchPhaseName = (typeof LAUNCH_PHASES)[number];

/** Map a friendly phase name to its on-chain enum value (Closed=0, Allowlist=1, Public=2). */
export function phaseToEnum(name: LaunchPhaseName): number {
  const i = LAUNCH_PHASES.indexOf(name);
  if (i < 0) throw new Error(`Unknown phase '${name}'. Valid: ${LAUNCH_PHASES.join(', ')}`);
  return i;
}

/** Map an on-chain phase enum value back to its friendly name. */
export function phaseFromEnum(value: number): LaunchPhaseName {
  const name = LAUNCH_PHASES[value];
  if (!name) throw new Error(`Unknown phase enum ${value}`);
  return name;
}

/** Config for a write (state-changing) operation — needs the owner/minter key. */
export interface LaunchWriteConfig {
  rpcUrl: string;
  chainId: number;
  privateKeyPath: string;
  contractAddress: string;
}

/** Config for a read-only operation — no key required. */
export interface LaunchReadConfig {
  rpcUrl: string;
  chainId: number;
  contractAddress: string;
}

interface Connection {
  account: Account;
  chain: Chain;
  wallet: WalletClient;
  pub: PublicClient;
  address: `0x${string}`;
}

async function connect(cfg: LaunchWriteConfig): Promise<Connection> {
  const account = privateKeyToAccount(await loadPrivateKey(cfg.privateKeyPath));
  const chain = resolveChain(cfg.chainId, cfg.rpcUrl);
  const wallet = createWalletClient({ account, chain, transport: http(cfg.rpcUrl) });
  const pub = createPublicClient({ chain, transport: http(cfg.rpcUrl) });
  return { account, chain, wallet, pub, address: cfg.contractAddress as `0x${string}` };
}

/** Send a non-payable contract write, wait for the receipt, and return the tx hash. */
async function writeLaunch(
  cfg: LaunchWriteConfig,
  functionName: LaunchNonpayableFn,
  args: readonly unknown[],
): Promise<Hex> {
  const { account, chain, wallet, pub, address } = await connect(cfg);
  const hash = await wallet.writeContract({
    address,
    abi: conkernftzLaunchAbi,
    functionName,
    args: args as never,
    account,
    chain,
  });
  await pub.waitForTransactionReceipt({ hash });
  return hash;
}

/** Send a payable mint write (carries `value`), wait for the receipt, and return the tx hash. */
async function writeLaunchPayable(
  cfg: LaunchWriteConfig,
  functionName: LaunchPayableFn,
  args: readonly unknown[],
  value: bigint,
): Promise<Hex> {
  const { account, chain, wallet, pub, address } = await connect(cfg);
  const hash = await wallet.writeContract({
    address,
    abi: conkernftzLaunchAbi,
    functionName,
    args: args as never,
    value,
    account,
    chain,
  });
  await pub.waitForTransactionReceipt({ hash });
  return hash;
}

// --- Admin writes ---

export const setAllowlistRoot = (cfg: LaunchWriteConfig, root: Hex): Promise<Hex> =>
  writeLaunch(cfg, 'setAllowlistRoot', [root]);

export const setPhase = (cfg: LaunchWriteConfig, phase: LaunchPhaseName): Promise<Hex> =>
  writeLaunch(cfg, 'setPhase', [phaseToEnum(phase)]);

export const setPrices = (
  cfg: LaunchWriteConfig,
  allowlistWei: bigint,
  publicWei: bigint,
): Promise<Hex> => writeLaunch(cfg, 'setPrices', [allowlistWei, publicWei]);

export const setCaps = (
  cfg: LaunchWriteConfig,
  publicWalletCap: bigint,
  maxPerTx: number,
): Promise<Hex> => writeLaunch(cfg, 'setCaps', [publicWalletCap, BigInt(maxPerTx)]);

export const setTreasury = (cfg: LaunchWriteConfig, treasury: string): Promise<Hex> =>
  writeLaunch(cfg, 'setTreasury', [treasury as `0x${string}`]);

export const reveal = (cfg: LaunchWriteConfig, baseUri: string): Promise<Hex> =>
  writeLaunch(cfg, 'reveal', [baseUri]);

export const freezeMetadata = (cfg: LaunchWriteConfig): Promise<Hex> =>
  writeLaunch(cfg, 'freezeMetadata', []);

export const withdraw = (cfg: LaunchWriteConfig): Promise<Hex> => writeLaunch(cfg, 'withdraw', []);

export const pause = (cfg: LaunchWriteConfig): Promise<Hex> => writeLaunch(cfg, 'pause', []);

export const unpause = (cfg: LaunchWriteConfig): Promise<Hex> => writeLaunch(cfg, 'unpause', []);

// --- Mints (ownerMint is admin; the others are mainly for testnet e2e) ---

export const launchOwnerMint = (cfg: LaunchWriteConfig, to: string, qty: number): Promise<Hex> =>
  writeLaunch(cfg, 'ownerMint', [to as `0x${string}`, BigInt(qty)]);

export const publicMint = (cfg: LaunchWriteConfig, qty: number, valueWei: bigint): Promise<Hex> =>
  writeLaunchPayable(cfg, 'publicMint', [BigInt(qty)], valueWei);

export const allowlistMint = (
  cfg: LaunchWriteConfig,
  qty: number,
  allowedQty: number,
  proof: Hex[],
  valueWei: bigint,
): Promise<Hex> =>
  writeLaunchPayable(cfg, 'allowlistMint', [BigInt(qty), BigInt(allowedQty), proof], valueWei);

// --- Read ---

export interface SaleState {
  phase: LaunchPhaseName;
  allowlistPriceWei: bigint;
  publicPriceWei: bigint;
  publicWalletCap: bigint;
  maxPerTx: bigint;
  allowlistRoot: Hex;
  totalMinted: bigint;
  maxSupply: bigint;
  revealed: boolean;
  metadataFrozen: boolean;
  configLocked: boolean;
  treasury: `0x${string}`;
  owner: `0x${string}`;
}

/** Read a full sale-state snapshot (no key needed) — for CLI `status` and UI display. */
export async function readSaleState(cfg: LaunchReadConfig): Promise<SaleState> {
  const chain = resolveChain(cfg.chainId, cfg.rpcUrl);
  const pub = createPublicClient({ chain, transport: http(cfg.rpcUrl) });
  const address = cfg.contractAddress as `0x${string}`;
  const read = <T>(functionName: LaunchReadFn): Promise<T> =>
    pub.readContract({ address, abi: conkernftzLaunchAbi, functionName }) as Promise<T>;

  const [
    phase,
    allowlistPriceWei,
    publicPriceWei,
    publicWalletCap,
    maxPerTx,
    allowlistRoot,
    totalMinted,
    maxSupply,
    revealed,
    metadataFrozen,
    configLocked,
    treasury,
    owner,
  ] = await Promise.all([
    read<number>('phase'),
    read<bigint>('allowlistPrice'),
    read<bigint>('publicPrice'),
    read<bigint>('publicWalletCap'),
    read<bigint>('maxPerTx'),
    read<Hex>('allowlistRoot'),
    read<bigint>('totalMinted'),
    read<bigint>('maxSupply'),
    read<boolean>('revealed'),
    read<boolean>('metadataFrozen'),
    read<boolean>('configLocked'),
    read<`0x${string}`>('treasury'),
    read<`0x${string}`>('owner'),
  ]);

  return {
    phase: phaseFromEnum(Number(phase)),
    allowlistPriceWei,
    publicPriceWei,
    publicWalletCap,
    maxPerTx,
    allowlistRoot,
    totalMinted,
    maxSupply,
    revealed,
    metadataFrozen,
    configLocked,
    treasury,
    owner,
  };
}
