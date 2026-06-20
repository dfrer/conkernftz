import { CHAIN_PRESETS, isTestnet } from '@conkernftz/chain-evm';

/**
 * Mainnet safeguard for launch-contract writes (EVM_LAUNCH_SPEC.md §7). The agent never deploys
 * to mainnet, and even a human running the CLI must clear two deliberate gates:
 *   1. `--mainnet` — acknowledge this is not a testnet.
 *   2. `--confirm <token>` — TYPE the chain's confirmation token (its preset name, e.g. `base`,
 *      or the raw chainId for an unrecognized chain). A bare boolean is too easy to fat-finger
 *      or reuse from shell history; typing the chain name forces conscious intent.
 * Testnets pass freely. UNKNOWN chain ids are treated as mainnet (see `isTestnet`), so the gate
 * errs toward caution.
 */

export interface MainnetGuardOpts {
  mainnet?: boolean;
  confirm?: string;
}

/** The token a user must pass to `--confirm` to operate on the given (mainnet) chain. */
export function requiredConfirmToken(chainId: number): string {
  const preset = Object.values(CHAIN_PRESETS).find((p) => p.chainId === chainId);
  return preset ? preset.name : String(chainId);
}

/** Throw a descriptive error unless the operation on `chainId` is permitted by the gates. */
export function assertChainAllowed(chainId: number, opts: MainnetGuardOpts): void {
  if (isTestnet(chainId)) return;
  const token = requiredConfirmToken(chainId);
  if (!opts.mainnet) {
    throw new Error(
      `Refusing to operate on chain ${chainId} (mainnet or unrecognized) without --mainnet. ` +
        `This is real-funds territory — testnet first, and only after an external audit. ` +
        `If you are certain, re-run with: --mainnet --confirm ${token}`,
    );
  }
  if (opts.confirm !== token) {
    throw new Error(
      `Mainnet operation requires a typed confirmation. Re-run with: --confirm ${token}`,
    );
  }
}
