import type { ChainAdapter } from '@conkernftz/core';
import { generateSigner, keypairIdentity, percentAmount, publicKey, createSignerFromKeypair } from '@metaplex-foundation/umi';
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import {
  createNft,
  createProgrammableNft,
  mplTokenMetadata,
  findMetadataPda,
} from '@metaplex-foundation/mpl-token-metadata';
import fs from 'node:fs/promises';

export const SolanaMintAdapter: Pick<ChainAdapter, 'mint'> = {
  async mint(args) {
    const keypairRaw = await fs.readFile(String(args.wallet));
    const secret = JSON.parse(keypairRaw.toString());
    const endpoint = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
    const umi = createUmi(endpoint).use(mplTokenMetadata());
    const kp = umi.eddsa.createKeypairFromSecretKey(new Uint8Array(secret));
    umi.use(keypairIdentity(createSignerFromKeypair(umi, kp)));

    const mint = generateSigner(umi);

    const creators = (args.creators ?? []).map((c) => ({ address: publicKey(c.address), share: c.share, verified: Boolean(c.verified) }));
    const sellerBps = percentAmount((args.sellerFeeBasisPoints ?? 0) / 100, 2);
    const isMutable = args.isMutable ?? true;
    const collection = args.collectionMint ? { key: publicKey(args.collectionMint), verified: false } : null;

    if (args.usePnft) {
      await createProgrammableNft(umi, {
        mint,
        name: args.name,
        symbol: args.symbol ?? '',
        uri: args.jsonUri,
        sellerFeeBasisPoints: sellerBps,
        isMutable,
        creators,
        collection,
        ruleSet: args.rulesetPda ? publicKey(args.rulesetPda) : null,
      }).sendAndConfirm(umi);
    } else {
      await createNft(umi, {
        mint,
        name: args.name,
        symbol: args.symbol ?? '',
        uri: args.jsonUri,
        sellerFeeBasisPoints: sellerBps,
        isMutable,
        creators,
        collection,
      }).sendAndConfirm(umi);
    }

    const metadataPda = findMetadataPda(umi, { mint: mint.publicKey });
    return { mint: mint.publicKey.toString(), metadataPda: metadataPda[0].toString?.() ?? String(metadataPda) };
  },
};


