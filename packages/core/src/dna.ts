import { sha256 } from '@noble/hashes/sha256';
import { utf8ToBytes, bytesToHex } from '@noble/hashes/utils';
import type { TraitKV } from './types.js';

export interface DnaConfig {
  hash: 'sha256';
  ignore?: string[]; // trait types to ignore
}

export function canonicalizeTraits(traits: TraitKV, ignore: string[] = []): string {
  const keys = Object.keys(traits)
    .filter((k) => !ignore.includes(k))
    .sort((a, b) => a.localeCompare(b));
  const pairs = keys.map((k) => `${k}:${traits[k]}`);
  return pairs.join('|');
}

export function makeDna(traits: TraitKV, cfg: DnaConfig): string {
  const canonical = canonicalizeTraits(traits, cfg.ignore ?? []);
  if (cfg.hash === 'sha256') {
    const hash = sha256(utf8ToBytes(canonical));
    return bytesToHex(hash);
  }
  throw new Error(`Unsupported hash: ${cfg.hash}`);
}


