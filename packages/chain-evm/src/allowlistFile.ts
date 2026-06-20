import type { AllowlistEntry } from './merkle.js';

/**
 * Parse an allowlist from CSV or JSON text into `AllowlistEntry[]` for the Merkle builder. Shared
 * by the CLI (`launch allowlist <file>`) and the app (drag-in-a-CSV). Validation of address/qty is
 * left to the Merkle helper (which throws on bad/duplicate entries) — one source of truth.
 *
 * - **CSV**: one `address,maxQty` per line. A header row (`address,…`) is skipped if present;
 *   blank lines and `#` comments are ignored.
 * - **JSON**: an array of `{ address, maxQty }` (also accepts `qty` / `quantity`), or an object
 *   map `{ "0xabc…": 3, … }`.
 */
export function parseAllowlist(text: string, format: 'csv' | 'json'): AllowlistEntry[] {
  return format === 'json' ? parseJson(text) : parseCsv(text);
}

/** Pick the format from a file name/extension (`.json` → json, else csv). */
export function formatFromPath(filePath: string): 'csv' | 'json' {
  return /\.json$/i.test(filePath) ? 'json' : 'csv';
}

function toQty(raw: unknown): number {
  return typeof raw === 'string' ? Number(raw.trim()) : Number(raw);
}

function parseCsv(text: string): AllowlistEntry[] {
  const out: AllowlistEntry[] = [];
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const parts = trimmed.split(',').map((s) => s.trim());
    const addr = parts[0];
    if (!addr) continue;
    if (/^address$/i.test(addr)) continue; // skip a header row
    out.push({ address: addr, maxQty: toQty(parts[1]) });
  }
  return out;
}

function parseJson(text: string): AllowlistEntry[] {
  const data = JSON.parse(text);
  if (Array.isArray(data)) {
    return data.map((e) => ({
      address: String(e.address),
      maxQty: toQty(e.maxQty ?? e.qty ?? e.quantity),
    }));
  }
  if (data && typeof data === 'object') {
    return Object.entries(data as Record<string, unknown>).map(([address, qty]) => ({
      address,
      maxQty: toQty(qty),
    }));
  }
  throw new Error('allowlist JSON must be an array of {address, maxQty} or an address→qty object');
}
