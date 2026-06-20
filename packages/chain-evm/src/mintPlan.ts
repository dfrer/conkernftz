import type { Hex } from 'viem';
import type { AllowlistDump } from './merkle.js';
import type { LaunchPhaseName } from './sale.js';

/**
 * Pure mint-decision logic for the launch contract — the brain behind the mint widget, shared by
 * the CLI and the (non-custodial) browser UI. It takes a sale snapshot + the connected wallet and
 * answers "can this address mint right now, how many, at what price, and with what call?" with no
 * chain or wallet access, so it is fully unit-testable. The connector layer (window.ethereum /
 * WalletConnect) only has to read state, call `planMint`, and submit `buildMintCall`'s output.
 */

/** The subset of on-chain sale state needed to decide a mint. */
export interface SaleSnapshot {
  phase: LaunchPhaseName;
  allowlistPriceWei: bigint;
  publicPriceWei: bigint;
  publicWalletCap: bigint;
  maxPerTx: bigint;
  totalMinted: bigint;
  maxSupply: bigint;
}

/** Per-wallet amounts already minted (from the contract's `allowlistMinted`/`publicMinted`). */
export interface WalletMintState {
  allowlistMinted?: bigint;
  publicMinted?: bigint;
}

export interface MintPlan {
  phase: LaunchPhaseName;
  /** Whether this wallet can mint at least one token right now. */
  canMint: boolean;
  /** Human-readable reason when `canMint` is false. */
  reason?: string;
  /** Price per token in the active phase (wei). */
  unitPriceWei: bigint;
  /** Max tokens this wallet may still mint in one go (min of wallet cap, supply, per-tx ceiling). */
  maxMintable: number;
  /** Allowlist proof + per-address cap, present only in the allowlist phase when the wallet is listed. */
  allowlist?: { allowedQty: number; proof: Hex[] };
}

export interface MintCall {
  functionName: 'publicMint' | 'allowlistMint';
  args: readonly unknown[];
  valueWei: bigint;
}

/** Find a wallet's allowlist entry in a dump (case-insensitive), or null. */
export function proofFromDump(
  dump: AllowlistDump,
  address: string,
): { allowedQty: number; proof: Hex[] } | null {
  const target = address.toLowerCase();
  const entry = dump.entries.find((e) => e.address.toLowerCase() === target);
  return entry ? { allowedQty: entry.maxQty, proof: entry.proof } : null;
}

/** Clamp a non-negative bigint to a JS number (mint caps are tiny, so this never loses precision). */
function toCount(n: bigint): number {
  return n > 0n ? Number(n) : 0;
}

function bigMin(...xs: bigint[]): bigint {
  return xs.reduce((m, x) => (x < m ? x : m));
}

/** Decide whether and how `address` can mint, given the current sale snapshot. */
export function planMint(args: {
  sale: SaleSnapshot;
  address: string;
  allowlist?: AllowlistDump;
  wallet?: WalletMintState;
}): MintPlan {
  const { sale, address, allowlist, wallet } = args;
  const supplyRemaining = sale.maxSupply > sale.totalMinted ? sale.maxSupply - sale.totalMinted : 0n;

  if (sale.phase === 'closed') {
    return { phase: 'closed', canMint: false, reason: 'The sale is not open yet.', unitPriceWei: 0n, maxMintable: 0 };
  }
  if (supplyRemaining === 0n) {
    const price = sale.phase === 'public' ? sale.publicPriceWei : sale.allowlistPriceWei;
    return { phase: sale.phase, canMint: false, reason: 'Sold out.', unitPriceWei: price, maxMintable: 0 };
  }

  if (sale.phase === 'public') {
    const already = wallet?.publicMinted ?? 0n;
    const walletRemaining = sale.publicWalletCap > already ? sale.publicWalletCap - already : 0n;
    const maxMintable = toCount(bigMin(walletRemaining, supplyRemaining, sale.maxPerTx));
    return {
      phase: 'public',
      canMint: maxMintable > 0,
      reason: maxMintable > 0 ? undefined : 'Per-wallet limit reached.',
      unitPriceWei: sale.publicPriceWei,
      maxMintable,
    };
  }

  // allowlist phase
  const found = allowlist ? proofFromDump(allowlist, address) : null;
  if (!found) {
    return {
      phase: 'allowlist',
      canMint: false,
      reason: 'This wallet is not on the allowlist.',
      unitPriceWei: sale.allowlistPriceWei,
      maxMintable: 0,
    };
  }
  const already = wallet?.allowlistMinted ?? 0n;
  const allowed = BigInt(found.allowedQty);
  const walletRemaining = allowed > already ? allowed - already : 0n;
  const maxMintable = toCount(bigMin(walletRemaining, supplyRemaining, sale.maxPerTx));
  return {
    phase: 'allowlist',
    canMint: maxMintable > 0,
    reason: maxMintable > 0 ? undefined : 'Allowlist allocation already minted.',
    unitPriceWei: sale.allowlistPriceWei,
    maxMintable,
    allowlist: found,
  };
}

/** Build the contract call (function/args/value) for minting `qty` per a plan. Throws if invalid. */
export function buildMintCall(plan: MintPlan, qty: number): MintCall {
  if (!plan.canMint) throw new Error(plan.reason ?? 'Cannot mint right now.');
  if (!Number.isInteger(qty) || qty < 1) throw new Error('qty must be a positive integer');
  if (qty > plan.maxMintable) throw new Error(`qty exceeds the max mintable (${plan.maxMintable})`);
  const valueWei = plan.unitPriceWei * BigInt(qty);

  if (plan.phase === 'public') {
    return { functionName: 'publicMint', args: [BigInt(qty)], valueWei };
  }
  if (plan.phase === 'allowlist' && plan.allowlist) {
    return {
      functionName: 'allowlistMint',
      args: [BigInt(qty), BigInt(plan.allowlist.allowedQty), plan.allowlist.proof],
      valueWei,
    };
  }
  throw new Error(`Cannot build a mint call for phase '${plan.phase}'`);
}
