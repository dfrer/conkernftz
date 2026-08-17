import { EthereumProvider } from '@walletconnect/ethereum-provider';
import type { Eip1193Provider } from './launchSign';
export { getProjectId, setProjectId } from './walletConnectSettings';

/**
 * WalletConnect v2 — non-custodial creator signing. `connectWallet` opens the WC modal (QR + wallet
 * list); the user approves in their own wallet and we get back an EIP-1193 provider that
 * `launchSign` drives. The app never holds a key. `projectId` is the owner's (cloud.reown.com),
 * stored locally in the browser (not in the project config). The heavy WC SDK is only imported
 * here — the Launch screen lazy-loads this module so it never weighs down the exported mint site.
 */

export interface WalletSession {
  provider: Eip1193Provider;
  address: `0x${string}`;
  chainId: number;
  disconnect: () => Promise<void>;
}

/** Open WalletConnect and connect to the given chain; returns the session (provider + account). */
export async function connectWallet(
  projectId: string,
  chainId: number,
  rpcUrl: string,
): Promise<WalletSession> {
  if (!projectId) throw new Error('Set a WalletConnect projectId first (free at cloud.reown.com).');
  const provider = await EthereumProvider.init({
    projectId,
    chains: [chainId],
    optionalChains: [chainId],
    showQrModal: true,
    rpcMap: { [chainId]: rpcUrl },
    metadata: {
      name: 'ConkerNFTZ',
      description: 'Deploy and manage your NFT launch',
      url: 'https://conkernftz.app',
      icons: [],
    },
  });
  await provider.connect();
  const address = provider.accounts?.[0] as `0x${string}` | undefined;
  if (!address) throw new Error('No account returned by the wallet.');
  return {
    provider: provider as unknown as Eip1193Provider,
    address,
    chainId: provider.chainId,
    disconnect: () => provider.disconnect(),
  };
}
