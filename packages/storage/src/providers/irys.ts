import fs from 'node:fs/promises';
import path from 'node:path';
import { mimeFor, withRetry, type StorageProvider, type UploadedDirectory, type UploadedRef } from '../provider.js';

export interface IrysProviderOptions {
  /** Funding token, e.g. 'ethereum' | 'matic' | 'base-eth' | 'solana'. Defaults to 'ethereum'. */
  token?: string;
  /** Path to the funding wallet key file (EVM hex private key, or Solana secret key). */
  keyPath?: string;
  /** Irys node / gateway base. Defaults to the public gateway. */
  node?: string;
  /** RPC URL for the funding chain (optional; SDK has sensible defaults). */
  rpcUrl?: string;
}

// The Irys SDK packages are heavy and chain-specific, so they are OPTIONAL: they are
// loaded lazily by name (widened to `string` so the build does not require them to be
// installed). Enable Arweave-via-Irys uploads with:
//   pnpm add @irys/upload @irys/upload-ethereum @irys/upload-solana
const IRYS_UPLOAD_PKG: string = '@irys/upload';
const IRYS_ETHEREUM_PKG: string = '@irys/upload-ethereum';
const IRYS_SOLANA_PKG: string = '@irys/upload-solana';

/** Arweave permanent storage via Irys (successor to Bundlr). */
export class IrysProvider implements StorageProvider {
  readonly id = 'irys';
  private readonly opts: IrysProviderOptions;
  private readonly projectRoot: string;
  private uploaderPromise: Promise<unknown> | null = null;

  constructor(projectRoot: string, opts: IrysProviderOptions) {
    this.projectRoot = projectRoot;
    this.opts = opts;
  }

  private gateway(): string {
    return (this.opts.node ?? 'https://gateway.irys.xyz').replace(/\/+$/, '');
  }

  private async getUploader(): Promise<{ uploadFile: (p: string, o?: unknown) => Promise<{ id: string }>; uploadFolder: (p: string, o?: unknown) => Promise<{ id: string }> }> {
    if (!this.uploaderPromise) this.uploaderPromise = this.buildUploader();
    return this.uploaderPromise as Promise<{ uploadFile: (p: string, o?: unknown) => Promise<{ id: string }>; uploadFolder: (p: string, o?: unknown) => Promise<{ id: string }> }>;
  }

  private async buildUploader(): Promise<unknown> {
    if (!this.opts.keyPath) throw new Error('Irys provider requires storage.irys.keyPath');
    let core;
    let tokenMod;
    const isSolana = (this.opts.token ?? 'ethereum').toLowerCase().includes('sol');
    try {
      core = await import(IRYS_UPLOAD_PKG);
      tokenMod = await import(isSolana ? IRYS_SOLANA_PKG : IRYS_ETHEREUM_PKG);
    } catch {
      throw new Error(
        'Irys provider requires optional dependencies. Install them with: ' +
          'pnpm add @irys/upload @irys/upload-ethereum @irys/upload-solana',
      );
    }
    const Uploader = core.Uploader ?? core.default?.Uploader;
    const Token = isSolana ? tokenMod.Solana : tokenMod.Ethereum;
    const keyRaw = (await fs.readFile(path.resolve(this.projectRoot, this.opts.keyPath), 'utf8')).trim().replace(/^"|"$/g, '');
    let builder = Uploader(Token).withWallet(keyRaw);
    if (this.opts.rpcUrl) builder = builder.withRpc(this.opts.rpcUrl);
    if (this.opts.node) builder = builder.withUploaderUrl(this.opts.node);
    return await builder;
  }

  async uploadFile(filePath: string): Promise<UploadedRef> {
    const uploader = await this.getUploader();
    const type = mimeFor(filePath);
    const receipt = await withRetry(() => uploader.uploadFile(filePath, { tags: [{ name: 'Content-Type', value: type }] }));
    return { uri: `${this.gateway()}/${receipt.id}`, type, cid: receipt.id };
  }

  async uploadDirectory(dirPath: string): Promise<UploadedDirectory> {
    const uploader = await this.getUploader();
    const receipt = await withRetry(() => uploader.uploadFolder(dirPath, { indexFile: '', batchSize: 50, keepDeleted: false }));
    const baseUri = `${this.gateway()}/${receipt.id}/`;
    const rels = await listFilesRecursive(dirPath);
    const files: Record<string, string> = {};
    for (const rel of rels) files[rel] = `${baseUri}${rel}`;
    return { baseUri, cid: receipt.id, files };
  }
}

async function listFilesRecursive(root: string, dir: string = root, out: string[] = []): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await listFilesRecursive(root, full, out);
    } else if (entry.isFile()) {
      out.push(path.relative(root, full).split(path.sep).join('/'));
    }
  }
  return out;
}
