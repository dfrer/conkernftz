// Renderer-side helper for the app-level pack/card-back library (project-independent).
// Thin wrappers over the bridge + a small data-URL cache used to resolve a packId to an
// image for the Mint FX preview and the site export.
import { bridge, type PackEntry, type PackKind } from './bridge';

export type { PackEntry, PackKind } from './bridge';

export async function listPacks(): Promise<PackEntry[]> {
  const fb = bridge();
  if (!fb) return [];
  try {
    const r = await fb.packsList();
    return r.ok && Array.isArray(r.packs) ? r.packs : [];
  } catch {
    return [];
  }
}

const dataUrlCache = new Map<string, string>();

/** Resolve a library pack id to an inline data URL (cached). */
export async function readPackDataUrl(id: string): Promise<string | null> {
  if (!id) return null;
  const cached = dataUrlCache.get(id);
  if (cached) return cached;
  const fb = bridge();
  if (!fb) return null;
  try {
    const r = await fb.packsRead(id);
    if (r.ok && r.base64) {
      const url = `data:${r.mime || 'image/png'};base64,${r.base64}`;
      dataUrlCache.set(id, url);
      return url;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export async function importPack(kind: PackKind, name?: string): Promise<PackEntry | null> {
  const fb = bridge();
  if (!fb) return null;
  try {
    const r = await fb.packsImport({ kind, name });
    return r.ok && r.pack ? r.pack : null;
  } catch {
    return null;
  }
}

export async function deletePack(id: string): Promise<boolean> {
  const fb = bridge();
  if (!fb) return false;
  try {
    const r = await fb.packsDelete(id);
    dataUrlCache.delete(id);
    return !!r.ok;
  } catch {
    return false;
  }
}
