import { describe, it, expect } from 'vitest';
import {
  addBlock,
  defaultSite,
  moveBlock,
  newBlock,
  removeBlock,
  resolveSite,
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
});
