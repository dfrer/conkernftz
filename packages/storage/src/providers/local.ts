import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { mimeFor, sha256Hex, type StorageProvider, type UploadedDirectory, type UploadedRef } from '../provider.js';

export interface LocalProviderOptions {
  /** Output directory (relative to projectRoot or absolute). Defaults to `build/storage`. */
  outDir?: string;
  /**
   * Optional base URL used to construct returned URIs instead of `file://`.
   * e.g. `https://gateway.example/cid` -> a file at `images/1.png` becomes
   * `https://gateway.example/cid/images/1.png`. Useful for deterministic tests
   * and for serving the output via a local static server.
   */
  gatewayBase?: string;
}

/**
 * A filesystem-backed provider. It copies uploads into a local directory and returns
 * `file://` (or gateway) URIs. No network, no credentials — ideal for dry-runs and CI,
 * and it exercises the same directory-CID code path the EVM launch flow relies on.
 */
export class LocalProvider implements StorageProvider {
  readonly id = 'local';
  private readonly outDir: string;
  private readonly gatewayBase?: string;

  constructor(projectRoot: string, opts: LocalProviderOptions = {}) {
    const out = opts.outDir ?? 'build/storage';
    this.outDir = path.isAbsolute(out) ? out : path.join(projectRoot, out);
    this.gatewayBase = opts.gatewayBase ? opts.gatewayBase.replace(/\/+$/, '') : undefined;
  }

  private uriFor(relPosix: string): string {
    if (this.gatewayBase) return `${this.gatewayBase}/${relPosix}`;
    return pathToFileURL(path.join(this.outDir, relPosix)).href;
  }

  async uploadFile(filePath: string): Promise<UploadedRef> {
    const buf = await fs.readFile(filePath);
    const cid = sha256Hex(buf);
    const rel = path.posix.join('files', path.basename(filePath));
    const dest = path.join(this.outDir, rel);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.writeFile(dest, buf);
    return { uri: this.uriFor(rel), type: mimeFor(filePath), cid };
  }

  async uploadDirectory(dirPath: string): Promise<UploadedDirectory> {
    const dirName = path.basename(path.resolve(dirPath));
    const destDir = path.join(this.outDir, dirName);
    await fs.mkdir(destDir, { recursive: true });
    const rels = await listFilesRecursive(dirPath);
    const files: Record<string, string> = {};
    const hasher: string[] = [];
    for (const rel of rels) {
      const buf = await fs.readFile(path.join(dirPath, rel));
      const dest = path.join(destDir, rel);
      await fs.mkdir(path.dirname(dest), { recursive: true });
      await fs.writeFile(dest, buf);
      const childRel = path.posix.join(dirName, rel);
      files[rel] = this.uriFor(childRel);
      hasher.push(`${rel}:${sha256Hex(buf)}`);
    }
    const cid = sha256Hex(Buffer.from(hasher.sort().join('\n')));
    const baseUri = this.gatewayBase
      ? `${this.gatewayBase}/${dirName}/`
      : `${pathToFileURL(destDir).href}/`;
    return { baseUri, cid, files };
  }
}

/** List all files under `root`, returned as POSIX relative paths. */
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
