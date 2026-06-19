import { describe, it, expect, afterEach } from 'vitest';
import { listPacks, readPackDataUrl, importPack, deletePack } from '../lib/packLibrary';

afterEach(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (window as any).foundry;
});

describe('packLibrary', () => {
  it('returns an empty list off-bridge', async () => {
    expect(await listPacks()).toEqual([]);
    expect(await readPackDataUrl('x')).toBeNull();
    expect(await importPack('pack')).toBeNull();
    expect(await deletePack('x')).toBe(false);
  });

  it('maps the bridge pack list', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).foundry = {
      packsList: async () => ({ ok: true, packs: [{ id: 'conkerco-default', name: 'CONKERCO Default', kind: 'pack', builtin: true }] }),
    };
    const packs = await listPacks();
    expect(packs).toHaveLength(1);
    expect(packs[0]).toMatchObject({ id: 'conkerco-default', builtin: true, kind: 'pack' });
  });

  it('resolves a pack id to a data URL', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).foundry = { packsRead: async () => ({ ok: true, base64: 'QUJD', mime: 'image/png' }) };
    expect(await readPackDataUrl('lib-uniq-1')).toBe('data:image/png;base64,QUJD');
  });

  it('imports + deletes via the bridge', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).foundry = {
      packsImport: async (o: { kind: string }) => ({ ok: true, pack: { id: 'p1', name: 'Mine', kind: o.kind, builtin: false } }),
      packsDelete: async () => ({ ok: true }),
    };
    const p = await importPack('back', 'Mine');
    expect(p).toMatchObject({ id: 'p1', kind: 'back', builtin: false });
    expect(await deletePack('p1')).toBe(true);
  });
});
