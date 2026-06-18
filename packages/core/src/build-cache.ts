import fs from 'node:fs/promises';
import path from 'node:path';
import { sha256 } from '@noble/hashes/sha256';
import { utf8ToBytes, bytesToHex } from '@noble/hashes/utils';

// Incremental-build cache. A build records a content hash per edition (index → hash);
// on a later build into the same out dir, editions whose hash still matches AND whose
// output files still exist are skipped (the expensive render is avoided, metadata is
// still rewritten). Because skipping only happens on a byte-identical match, outputs are
// never stale and the build remains deterministic.

const CACHE_FILE = '.build-cache.json';

export interface BuildCache {
  version: 1;
  seed: string;
  entries: Record<string, string>;
}

export function hashString(s: string): string {
  return bytesToHex(sha256(utf8ToBytes(s)));
}

/** Cheap content fingerprint for an asset file (mtime + size). Missing → '0:0'. */
export async function statFingerprint(filePath: string): Promise<string> {
  try {
    const s = await fs.stat(filePath);
    return `${Math.round(s.mtimeMs)}:${s.size}`;
  } catch {
    return '0:0';
  }
}

export async function loadBuildCache(outDir: string, seed: string): Promise<BuildCache> {
  try {
    const raw = await fs.readFile(path.join(outDir, CACHE_FILE), 'utf8');
    const c = JSON.parse(raw) as BuildCache;
    // A different seed reshuffles every edition, so its cache is irrelevant.
    if (c && c.version === 1 && c.seed === seed && c.entries && typeof c.entries === 'object') {
      return { version: 1, seed, entries: c.entries };
    }
  } catch {
    /* no/invalid cache */
  }
  return { version: 1, seed, entries: {} };
}

export async function saveBuildCache(outDir: string, cache: BuildCache): Promise<void> {
  try {
    await fs.writeFile(path.join(outDir, CACHE_FILE), JSON.stringify(cache));
  } catch {
    /* best-effort */
  }
}
