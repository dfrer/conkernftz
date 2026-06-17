import path from 'node:path';
import { createHash } from 'node:crypto';

/** A single uploaded file. */
export interface UploadedRef {
  /** Resolvable URI, e.g. `ipfs://<cid>`, `https://arweave.net/<id>`, or a gateway URL. */
  uri: string;
  /** MIME type. */
  type: string;
  /** Content identifier where the backend exposes one (IPFS CID, Arweave tx id, content hash). */
  cid?: string;
}

/**
 * An uploaded directory. `baseUri` is constructed so that a child at relative path
 * `rel` resolves to `${baseUri}${rel}` — this is what the EVM contract's
 * `tokenURI = <baseURI><id>.json` pattern requires.
 */
export interface UploadedDirectory {
  baseUri: string;
  cid?: string;
  /** Map of relative path (POSIX separators) -> absolute resolvable URI. */
  files: Record<string, string>;
}

/** Pluggable upload backend. */
export interface StorageProvider {
  readonly id: string;
  uploadFile(filePath: string): Promise<UploadedRef>;
  uploadDirectory(dirPath: string): Promise<UploadedDirectory>;
}

export interface RetryOptions {
  attempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  /** Called before each retry (not before the first attempt). */
  onRetry?: (error: unknown, attempt: number) => void;
}

/** Run `fn` with exponential backoff. Lifted from the previous inline CLI retry loop. */
export async function withRetry<T>(fn: () => Promise<T>, opts: RetryOptions = {}): Promise<T> {
  const attempts = Math.max(1, opts.attempts ?? 3);
  const base = opts.baseDelayMs ?? 1000;
  const max = opts.maxDelayMs ?? 8000;
  let lastErr: unknown = null;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (i === attempts - 1) break;
      if (opts.onRetry) opts.onRetry(e, i + 1);
      const delay = Math.min(max, base * 2 ** i);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

/** Minimal extension -> MIME mapping (avoids a runtime `mime` dependency). */
export function mimeFor(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.png':
      return 'image/png';
    case '.webp':
      return 'image/webp';
    case '.gif':
      return 'image/gif';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.svg':
      return 'image/svg+xml';
    case '.mp4':
      return 'video/mp4';
    case '.webm':
      return 'video/webm';
    case '.json':
      return 'application/json';
    default:
      return 'application/octet-stream';
  }
}

/** sha256 hex of a buffer — used as a content id by the local provider and for verification. */
export function sha256Hex(data: Buffer): string {
  return createHash('sha256').update(data).digest('hex');
}

export interface CreateProviderOptions {
  provider: 'local' | 'pinata' | 'irys' | 'arweave' | 'ipfs';
  /** Project root, used to resolve relative key/output paths. */
  projectRoot: string;
  local?: { outDir?: string; gatewayBase?: string };
  pinata?: { jwt?: string; gateway?: string };
  irys?: { token?: string; keyPath?: string; node?: string; rpcUrl?: string };
}

/** Construct a {@link StorageProvider} from config. Throws for the deprecated legacy providers. */
export async function createProvider(opts: CreateProviderOptions): Promise<StorageProvider> {
  switch (opts.provider) {
    case 'local': {
      const { LocalProvider } = await import('./providers/local.js');
      return new LocalProvider(opts.projectRoot, opts.local);
    }
    case 'pinata': {
      const { PinataJwtProvider } = await import('./providers/pinata-jwt.js');
      if (!opts.pinata?.jwt) throw new Error('Pinata provider requires storage.pinata.jwt');
      return new PinataJwtProvider(opts.pinata.jwt, opts.pinata.gateway);
    }
    case 'irys': {
      const { IrysProvider } = await import('./providers/irys.js');
      return new IrysProvider(opts.projectRoot, opts.irys ?? {});
    }
    case 'arweave':
      throw new Error(
        "storage.provider 'arweave' (Bundlr) is deprecated. Use 'irys' (Arweave via Irys), 'pinata', or 'local'.",
      );
    case 'ipfs':
      throw new Error(
        "storage.provider 'ipfs' (nft.storage / legacy Pinata) is deprecated. Use 'pinata' (JWT) or 'local'.",
      );
    default:
      throw new Error(`Unknown storage provider: ${String(opts.provider)}`);
  }
}
