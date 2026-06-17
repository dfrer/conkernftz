import { createWalletClient, createPublicClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { conkernftzCollectionAbi } from './artifact.js';
import { resolveChain, loadPrivateKey } from './deploy.js';

export interface EvmMintConfig {
  rpcUrl: string;
  chainId: number;
  privateKeyPath: string;
  contractAddress: string;
}

export interface MintResult {
  txHash: string;
  fromTokenId: number;
  count: number;
}

/**
 * Owner-mint `quantity` sequential tokens to `to` on a deployed ConkernftzCollection.
 * When `to` is omitted, tokens are minted to the deployer's own address.
 */
export async function ownerMint(cfg: EvmMintConfig, quantity: number, to?: string): Promise<MintResult> {
  const account = privateKeyToAccount(await loadPrivateKey(cfg.privateKeyPath));
  const chain = resolveChain(cfg.chainId, cfg.rpcUrl);
  const wallet = createWalletClient({ account, chain, transport: http(cfg.rpcUrl) });
  const pub = createPublicClient({ chain, transport: http(cfg.rpcUrl) });
  const address = cfg.contractAddress as `0x${string}`;
  const recipient = (to ?? account.address) as `0x${string}`;

  const fromTokenId = Number(
    await pub.readContract({ address, abi: conkernftzCollectionAbi, functionName: 'nextTokenId' }),
  );
  const hash = await wallet.writeContract({
    address,
    abi: conkernftzCollectionAbi,
    functionName: 'ownerMint',
    args: [recipient, BigInt(quantity)],
    chain,
    account,
  });
  await pub.waitForTransactionReceipt({ hash });
  return { txHash: hash, fromTokenId, count: quantity };
}
