import { NFTStorage } from 'nft.storage';
import fs from 'node:fs/promises';
import path from 'node:path';
import mime from 'mime';
import pinataSDK from '@pinata/sdk';

export interface IpfsConfig {
  pinataKey?: string;
  pinataSecret?: string;
  nftStorageKey?: string;
}

export async function uploadViaNftStorage(filePath: string, key: string): Promise<{ uri: string; type: string }> {
  const client = new NFTStorage({ token: key });
  const buffer = await fs.readFile(filePath);
  const contentType = mime.getType(filePath) ?? 'application/octet-stream';
  // Convert Node Buffer to ArrayBuffer slice to satisfy BlobPart types
  const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
  const blob = new Blob([arrayBuffer], { type: contentType });
  const cid = await client.storeBlob(blob);
  return { uri: `ipfs://${cid}`, type: contentType };
}
// Optional Pinata implementation can be wired later to avoid strict type conflicts in older SDK versions
// Pinata uploader using pinFileToIPFS with a stream interface
export async function uploadViaPinata(filePath: string, key: string, secret: string): Promise<{ uri: string; type: string }> {
  const pinata = new pinataSDK({ pinataApiKey: key, pinataSecretApiKey: secret });
  const contentType = mime.getType(filePath) ?? 'application/octet-stream';
  const { createReadStream } = await import('node:fs');
  const stream = createReadStream(filePath);
  const res = await pinata.pinFileToIPFS(stream, { pinataMetadata: { name: path.basename(filePath) } });
  return { uri: `ipfs://${res.IpfsHash}`, type: contentType };
}


