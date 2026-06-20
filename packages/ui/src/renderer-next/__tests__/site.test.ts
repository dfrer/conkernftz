import { describe, it, expect } from 'vitest';
import {
  BLOCK_KINDS,
  addBlock,
  blockHasText,
  clampFontScale,
  clampScale,
  normalizeAlign,
  defaultSite,
  moveBlock,
  newBlock,
  removeBlock,
  removeBlocks,
  resolveSite,
  setBlockLayout,
  setBlockMobile,
  setCanvas,
  setLayoutMode,
  setMint,
  setPageBg,
  setTheme,
  updateBlock,
  type SiteConfig,
} from '../lib/site';

const emptySite = (): SiteConfig => ({ theme: resolveSite({}).theme, blocks: [] });

describe('site model', () => {
  it('defaultSite is a sensible starter page', () => {
    const s = defaultSite();
    expect(s.blocks.map((b) => b.kind)).toEqual(['hero', 'gallery', 'mint', 'faq']);
    expect(s.theme.background).toBe('ink');
  });

  it('resolveSite fills theme defaults and drops malformed blocks', () => {
    const r = resolveSite({
      theme: { accent: '#fff', background: 'bogus' },
      blocks: [{ id: 'x', kind: 'hero', title: 't', subtitle: '', align: 'left' }, { nope: 1 }],
    } as unknown as Partial<SiteConfig>);
    expect(r.theme.accent).toBe('#fff');
    expect(r.theme.background).toBe('ink'); // invalid → default
    expect(r.blocks).toHaveLength(1);
  });

  it('add / remove / move / update are immutable and correct', () => {
    let s = emptySite();
    s = addBlock(s, 'hero');
    s = addBlock(s, 'gallery');
    expect(s.blocks.map((b) => b.kind)).toEqual(['hero', 'gallery']);

    const galleryId = s.blocks[1]!.id;
    const moved = moveBlock(s, galleryId, -1);
    expect(moved.blocks.map((b) => b.kind)).toEqual(['gallery', 'hero']);
    expect(s.blocks.map((b) => b.kind)).toEqual(['hero', 'gallery']); // original untouched

    const updated = updateBlock(s, s.blocks[0]!.id, { title: 'Hello' });
    expect((updated.blocks[0] as { title?: string }).title).toBe('Hello');

    expect(removeBlock(s, galleryId).blocks.map((b) => b.kind)).toEqual(['hero']);
  });

  it('removeBlocks drops every id in the set (group delete)', () => {
    let s = emptySite();
    s = addBlock(s, 'hero');
    s = addBlock(s, 'gallery');
    s = addBlock(s, 'mint');
    const [a, , c] = s.blocks.map((b) => b.id);
    const out = removeBlocks(s, [a!, c!]);
    expect(out.blocks.map((b) => b.kind)).toEqual(['gallery']);
  });

  it('moveBlock restacks in canvas mode: z follows position so reordering changes stacking', () => {
    const s = setLayoutMode(defaultSite(), 'canvas'); // seeds z = index + 1
    const [id0, id1] = [s.blocks[0]!.id, s.blocks[1]!.id];
    const z0 = s.blocks[0]!.layout!.z;
    const z1 = s.blocks[1]!.layout!.z;
    expect(z0).not.toBe(z1);
    const moved = moveBlock(s, id0, 1); // move first block down one
    expect(moved.blocks[1]!.id).toBe(id0); // list order changed
    // z stays with the position, so the moved block takes the other's z (and restacks)
    expect(moved.blocks.find((b) => b.id === id0)!.layout!.z).toBe(z1);
    expect(moved.blocks.find((b) => b.id === id1)!.layout!.z).toBe(z0);
  });

  it('moveBlock is a no-op at the edges', () => {
    const s: SiteConfig = { theme: emptySite().theme, blocks: [newBlock('hero', 'a'), newBlock('mint', 'b')] };
    expect(moveBlock(s, 'a', -1)).toBe(s);
    expect(moveBlock(s, 'b', 1)).toBe(s);
  });

  it('updateBlock cannot change a block id or kind', () => {
    const s: SiteConfig = { theme: emptySite().theme, blocks: [newBlock('hero', 'a')] };
    const u = updateBlock(s, 'a', { id: 'evil', kind: 'mint', title: 'X' });
    expect(u.blocks[0]!.id).toBe('a');
    expect(u.blocks[0]!.kind).toBe('hero');
  });

  it('setTheme merges into the theme', () => {
    expect(setTheme(defaultSite(), { font: 'mono' }).theme.font).toBe('mono');
  });

  it('per-block fontScale survives updateBlock + resolveSite round-trips', () => {
    let s = addBlock(emptySite(), 'richText');
    const id = s.blocks[0]!.id;
    s = updateBlock(s, id, { fontScale: 1.75 });
    expect(s.blocks[0]!.fontScale).toBe(1.75);
    // not stripped by a resolve (save → reload)
    expect(resolveSite(s).blocks[0]!.fontScale).toBe(1.75);
  });

  it('clampFontScale bounds + defaults untrusted values', () => {
    expect(clampFontScale(1.5)).toBe(1.5);
    expect(clampFontScale(99)).toBe(4); // max
    expect(clampFontScale(0.1)).toBe(0.5); // min
    expect(clampFontScale('nope')).toBe(1); // default
  });

  it('clampScale (whole-widget) bounds 0.25–4 and round-trips on a block', () => {
    expect(clampScale(2)).toBe(2);
    expect(clampScale(99)).toBe(4);
    expect(clampScale(0.01)).toBe(0.25);
    expect(clampScale('nope')).toBe(1);
    let s = addBlock(emptySite(), 'mint');
    s = updateBlock(s, s.blocks[0]!.id, { scale: 1.75 });
    expect(resolveSite(s).blocks[0]!.scale).toBe(1.75);
  });

  it('blockHasText covers text widgets but not image/divider/gallery/html/button', () => {
    expect(blockHasText('richText')).toBe(true);
    expect(blockHasText('hero')).toBe(true);
    expect(blockHasText('divider')).toBe(false);
    expect(blockHasText('image')).toBe(false);
    expect(blockHasText('button')).toBe(false); // fixed-size badge
  });

  it('per-block align + color survive round-trips; normalizeAlign validates', () => {
    let s = addBlock(emptySite(), 'richText');
    const id = s.blocks[0]!.id;
    s = updateBlock(s, id, { align: 'right', color: '#0ff' });
    expect(s.blocks[0]!.align).toBe('right');
    expect(s.blocks[0]!.color).toBe('#0ff');
    const r = resolveSite(s).blocks[0]!;
    expect(r.align).toBe('right');
    expect(r.color).toBe('#0ff');
    expect(normalizeAlign('center')).toBe('center');
    expect(normalizeAlign('bogus')).toBeUndefined();
  });
});

describe('site model — canvas + widgets', () => {
  it('resolveSite defaults layout/canvas/pageBg (backward compatible)', () => {
    const r = resolveSite({ theme: defaultSite().theme, blocks: [] });
    expect(r.layout).toBe('flow');
    expect(r.canvas!.width).toBeGreaterThan(0);
    expect(r.pageBg!.kind).toBe('theme');
  });

  it('switching to canvas mode seeds a layout for every block', () => {
    const s = setLayoutMode(defaultSite(), 'canvas');
    expect(s.layout).toBe('canvas');
    expect(s.blocks.every((b) => !!b.layout)).toBe(true);
  });

  it('addBlock seeds a layout in canvas mode but not in flow', () => {
    const flowAdd = addBlock(defaultSite(), 'blink');
    expect(flowAdd.blocks[flowAdd.blocks.length - 1]!.layout).toBeUndefined();
    const canvasAdd = addBlock(setLayoutMode(defaultSite(), 'canvas'), 'blink');
    expect(canvasAdd.blocks[canvasAdd.blocks.length - 1]!.layout).toBeTruthy();
  });

  it('setBlockLayout / setBlockMobile merge rects', () => {
    let s = setLayoutMode(defaultSite(), 'canvas');
    const id = s.blocks[0]!.id;
    s = setBlockLayout(s, id, { x: 100, y: 50 });
    expect(s.blocks[0]!.layout!.x).toBe(100);
    s = setBlockMobile(s, id, { x: 5 });
    expect(s.blocks[0]!.layout!.mobile!.x).toBe(5);
  });

  it('setCanvas / setPageBg update page settings', () => {
    const s = setPageBg(setCanvas(defaultSite(), { width: 800 }), { kind: 'tile', tile: 'data:x' });
    expect(s.canvas!.width).toBe(800);
    expect(s.pageBg!.kind).toBe('tile');
  });

  it('newBlock supports the GeoCities widgets', () => {
    expect(newBlock('blink').kind).toBe('blink');
    expect((newBlock('hitCounter') as { start: number }).start).toBeGreaterThan(0);
    expect((newBlock('html') as { html: string }).html).toContain('<');
  });

  it('newBlock supports the extra nostalgia widgets', () => {
    expect((newBlock('wordArt') as { style: string }).style).toBe('rainbow');
    expect(newBlock('button').kind).toBe('button');
    expect(newBlock('webRing').kind).toBe('webRing');
    expect(newBlock('underConstruction').kind).toBe('underConstruction');
    expect(BLOCK_KINDS).toContain('wordArt');
  });

  it('newBlock supports the nostalgia-zoo additions (best-viewed / audio / guestbook)', () => {
    expect(newBlock('bestViewed').kind).toBe('bestViewed');
    expect((newBlock('audio') as { loop: boolean }).loop).toBe(true);
    expect(newBlock('guestbook').kind).toBe('guestbook');
    for (const k of ['bestViewed', 'audio', 'guestbook'] as const) expect(BLOCK_KINDS).toContain(k);
  });

  it('resolveSite validates the page cursor effect', () => {
    expect(resolveSite({ cursor: 'sparkle', blocks: [] } as unknown as Partial<SiteConfig>).cursor).toBe('sparkle');
    expect(resolveSite({ cursor: 'bogus', blocks: [] } as unknown as Partial<SiteConfig>).cursor).toBe('none');
    expect(resolveSite({ blocks: [] }).cursor).toBe('none');
  });

  it('resolveSite carries complete mint wiring through (so it survives export)', () => {
    const mint = { chainId: 84532, rpcUrl: 'https://sepolia.base.org', contractAddress: '0xabc' };
    expect(resolveSite({ mint, blocks: [] } as unknown as Partial<SiteConfig>).mint).toEqual(mint);
  });

  it('setMint merges and persists partial wiring (chain/RPC before the address)', () => {
    const s1 = setMint(resolveSite({ blocks: [] }), { chainId: 84532 });
    expect(s1.mint).toEqual({ chainId: 84532, rpcUrl: '', contractAddress: '' });
    const s2 = setMint(s1, { rpcUrl: 'https://x', contractAddress: '0xabc' });
    expect(s2.mint).toEqual({ chainId: 84532, rpcUrl: 'https://x', contractAddress: '0xabc' });
  });

  it('resolveSite drops incomplete/invalid mint wiring', () => {
    const cases = [
      { chainId: 84532, rpcUrl: 'https://x', contractAddress: '' }, // no address
      { chainId: 84532, contractAddress: '0xabc' }, // no rpcUrl
      { rpcUrl: 'https://x', contractAddress: '0xabc' }, // no chainId
    ];
    for (const m of cases) {
      expect(resolveSite({ mint: m, blocks: [] } as unknown as Partial<SiteConfig>).mint).toBeUndefined();
    }
  });
});
