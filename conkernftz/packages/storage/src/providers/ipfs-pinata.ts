import fs from 'node:fs/promises';
import path from 'node:path';
import mime from 'mime';
import type { StorageProvider, UploadedFileRef, DirUploadResult } from '../types.js';

export interface PinataConfig {
  /** Pinata JWT. Falls back to the PINATA_JWT environment variable. */
  jwt?: string;
  /** Dedicated gateway domain (no scheme), used by the SDK to build gateway URLs. */
  gateway?: string;
}

/**
 * IPFS storage via the modern Pinata SDK (JWT auth). Supports both single-file uploads
 * (per-NFT URIs) and directory uploads (a single base CID for an ERC-721 `baseURI`).
 */
export async function createPinataProvider(cfg: PinataConfig): Promise<StorageProvider> {
  const jwt = cfg.jwt || process.env.PINATA_JWT;
  if (!jwt) {
    throw new Error(
      'Pinata JWT missing: set storage.pinata.jwt or the PINATA_JWT environment variable',
    );
  }
  const { PinataSDK } = await import('pinata');
  const pinata = new PinataSDK({ pinataJwt: jwt, pinataGateway: cfg.gateway });

  async function toFile(filePath: string): Promise<File> {
    const buf = await fs.readFile(filePath);
    const type = mime.getType(filePath) ?? 'application/octet-stream';
    // Re-wrap in a plain ArrayBuffer-backed view so it satisfies BlobPart (a Node
    // Buffer is typed as possibly SharedArrayBuffer-backed, which the File API rejects).
    return new File([new Uint8Array(buf)], path.basename(filePath), { type });
  }

  return {
    id: 'pinata',
    async uploadFile(filePath: string): Promise<UploadedFileRef> {
      const type = mime.getType(filePath) ?? 'application/octet-stream';
      const res = await pinata.upload.public.file(await toFile(filePath));
      return { uri: `ipfs://${res.cid}`, type };
    },
    async uploadDir(dirPath: string): Promise<DirUploadResult> {
      const names = (await fs.readdir(dirPath, { withFileTypes: true }))
        .filter((d) => d.isFile())
        .map((d) => d.name);
      const files = await Promise.all(names.map((n) => toFile(path.join(dirPath, n))));
      const res = await pinata.upload.public.fileArray(files);
      return { cid: res.cid, uri: `ipfs://${res.cid}/` };
    },
  };
}
