import fs from 'node:fs/promises';
import path from 'node:path';
import { mimeFor, withRetry, type StorageProvider, type UploadedDirectory, type UploadedRef } from '../provider.js';

const PIN_FILE_URL = 'https://api.pinata.cloud/pinning/pinFileToIPFS';

interface PinResponse {
  IpfsHash: string;
  PinSize?: number;
  Timestamp?: string;
}

/**
 * Modern Pinata provider using JWT bearer auth over the pinning REST API via global
 * `fetch` (no SDK dependency). Directory uploads return the directory CID so the EVM
 * contract's `<baseURI><id>.json` pattern resolves: `baseUri = ipfs://<dirCid>/`.
 */
export class PinataJwtProvider implements StorageProvider {
  readonly id = 'pinata';
  private readonly jwt: string;
  private readonly gateway?: string;

  constructor(jwt: string, gateway?: string) {
    this.jwt = jwt;
    this.gateway = gateway ? gateway.replace(/\/+$/, '') : undefined;
  }

  private async pin(form: FormData): Promise<PinResponse> {
    return withRetry(async () => {
      const res = await fetch(PIN_FILE_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.jwt}` },
        body: form,
      });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`Pinata upload failed: ${res.status} ${res.statusText} ${body}`.trim());
      }
      return (await res.json()) as PinResponse;
    });
  }

  /** Optional https gateway URL for a CID (the canonical uri stays ipfs://). */
  private gatewayUrl(cid: string, rel?: string): string | undefined {
    if (!this.gateway) return undefined;
    return rel ? `${this.gateway}/ipfs/${cid}/${rel}` : `${this.gateway}/ipfs/${cid}`;
  }

  async uploadFile(filePath: string): Promise<UploadedRef> {
    const buf = await fs.readFile(filePath);
    const form = new FormData();
    form.append('file', new Blob([new Uint8Array(buf)], { type: mimeFor(filePath) }), path.basename(filePath));
    form.append('pinataMetadata', JSON.stringify({ name: path.basename(filePath) }));
    form.append('pinataOptions', JSON.stringify({ cidVersion: 1 }));
    const { IpfsHash } = await this.pin(form);
    return { uri: `ipfs://${IpfsHash}`, type: mimeFor(filePath), cid: IpfsHash };
  }

  async uploadDirectory(dirPath: string): Promise<UploadedDirectory> {
    const root = path.basename(path.resolve(dirPath));
    const rels = await listFilesRecursive(dirPath);
    if (rels.length === 0) throw new Error(`Pinata: directory is empty: ${dirPath}`);
    const form = new FormData();
    for (const rel of rels) {
      const buf = await fs.readFile(path.join(dirPath, rel));
      // Filenames share the `${root}/` prefix so Pinata groups them into one directory;
      // the returned CID is that directory, with children at `<cid>/<rel>`.
      form.append('file', new Blob([new Uint8Array(buf)], { type: mimeFor(rel) }), `${root}/${rel}`);
    }
    form.append('pinataMetadata', JSON.stringify({ name: root }));
    form.append('pinataOptions', JSON.stringify({ cidVersion: 1 }));
    const { IpfsHash } = await this.pin(form);
    const baseUri = `ipfs://${IpfsHash}/`;
    const files: Record<string, string> = {};
    for (const rel of rels) files[rel] = `${baseUri}${rel}`;
    return { baseUri, cid: IpfsHash, files };
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
