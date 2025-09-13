import Bundlr from '@bundlr-network/client';
import fs from 'node:fs/promises';
import path from 'node:path';
import mime from 'mime';

export interface BundlrConfig {
  bundlrNode: string;
  currency: string;
  keyPath: string;
}

export async function uploadFileViaBundlr(
  filePath: string,
  cfg: BundlrConfig,
): Promise<{ uri: string; type: string }> {
  const key = JSON.parse(await fs.readFile(path.resolve(cfg.keyPath), 'utf8'));
  const bundlr = new Bundlr(cfg.bundlrNode, cfg.currency, key);
  await bundlr.ready();

  const buffer = await fs.readFile(filePath);
  const contentType = mime.getType(filePath) ?? 'application/octet-stream';
  const tx = await bundlr.upload(buffer, { tags: [{ name: 'Content-Type', value: contentType }] });
  // Normalize to HTTPS gateway URL for broad client compatibility
  const httpsUri = `https://arweave.net/${tx.id}`;
  return { uri: httpsUri, type: contentType };
}


