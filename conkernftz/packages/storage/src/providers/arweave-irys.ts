import fs from 'node:fs/promises';
import path from 'node:path';
import mime from 'mime';
import type { StorageProvider, UploadedFileRef } from '../types.js';

export interface IrysConfig {
  /** Payment token used to fund uploads. Default: 'solana'. */
  token?: 'solana' | 'ethereum';
  /** Path to the wallet file: a Solana keypair JSON array, or an EVM private key (hex). */
  keyPath: string;
  /** Optional RPC URL for the payment token's chain. */
  rpcUrl?: string;
}

/**
 * Permanent storage on Arweave via Irys (formerly Bundlr). Uploads are paid for with
 * the configured token; the returned URIs are `ar://<txId>` and resolve forever.
 */
export async function createIrysProvider(cfg: IrysConfig): Promise<StorageProvider> {
  const token = cfg.token ?? 'solana';
  const wallet = await loadWallet(cfg.keyPath, token);
  const { Uploader } = await import('@irys/upload');

  const builder =
    token === 'ethereum'
      ? Uploader((await import('@irys/upload-ethereum')).Ethereum).withWallet(wallet)
      : Uploader((await import('@irys/upload-solana')).Solana).withWallet(wallet);
  const irys = await (cfg.rpcUrl ? builder.withRpc(cfg.rpcUrl) : builder);

  return {
    id: 'irys',
    async uploadFile(filePath: string): Promise<UploadedFileRef> {
      const contentType = mime.getType(filePath) ?? 'application/octet-stream';
      const receipt = await irys.uploadFile(filePath, {
        tags: [{ name: 'Content-Type', value: contentType }],
      });
      return { uri: `ar://${receipt.id}`, type: contentType };
    },
  };
}

/** Normalize a wallet file into the secret form Irys expects for the given token. */
async function loadWallet(keyPath: string, token: 'solana' | 'ethereum'): Promise<string> {
  const raw = (await fs.readFile(path.resolve(keyPath), 'utf8')).trim();
  if (token === 'ethereum') {
    const pk = raw.replace(/^"|"$/g, '');
    return pk.startsWith('0x') ? pk : `0x${pk}`;
  }
  // Solana: accept either a JSON byte array (Uint8Array secret key) or a base58 string.
  if (raw.startsWith('[')) {
    const bytes = Uint8Array.from(JSON.parse(raw) as number[]);
    const bs58 = (await import('bs58')).default;
    return bs58.encode(bytes);
  }
  return raw.replace(/^"|"$/g, '');
}
