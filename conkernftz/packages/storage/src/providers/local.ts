import path from 'node:path';
import mime from 'mime';
import type { StorageProvider, UploadedFileRef, DirUploadResult } from '../types.js';

export interface LocalConfig {
  /**
   * Optional base URI prepended to file names (e.g. 'ipfs://<cid>' or 'https://cdn.example').
   * When omitted, absolute `file://` URIs are produced. Useful for offline testing without
   * paying for real uploads.
   */
  baseUri?: string;
}

/** A no-network provider that fabricates deterministic URIs for local/offline testing. */
export function createLocalProvider(cfg: LocalConfig): StorageProvider {
  const base = (cfg.baseUri ?? '').replace(/\/+$/, '');
  return {
    id: 'local',
    async uploadFile(filePath: string): Promise<UploadedFileRef> {
      const type = mime.getType(filePath) ?? 'application/octet-stream';
      const name = path.basename(filePath);
      const uri = base ? `${base}/${name}` : `file://${path.resolve(filePath)}`;
      return { uri, type };
    },
    async uploadDir(dirPath: string): Promise<DirUploadResult> {
      const uri = base ? `${base}/` : `file://${path.resolve(dirPath)}/`;
      return { cid: 'local', uri };
    },
  };
}
