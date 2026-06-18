// Site builder model (P2). A serializable description of a mint page: a theme + an ordered
// list of blocks. DOM-free and pure so it's unit-tested directly; the React renderer
// (components/site/SiteRenderer) is a thin view over it, and the SAME config + renderer will
// be emitted as the static mint site by P3 (no drift between builder preview and shipped site).

export type BlockKind = 'hero' | 'richText' | 'gallery' | 'mint' | 'faq' | 'divider' | 'marquee';

export interface BaseBlock {
  id: string;
  kind: BlockKind;
}
export interface HeroBlock extends BaseBlock {
  kind: 'hero';
  title: string;
  subtitle: string;
  align: 'left' | 'center';
}
export interface RichTextBlock extends BaseBlock {
  kind: 'richText';
  heading: string;
  text: string;
}
export interface GalleryBlock extends BaseBlock {
  kind: 'gallery';
  heading: string;
  columns: number;
  count: number;
}
export interface MintBlock extends BaseBlock {
  kind: 'mint';
  heading: string;
  price: string;
}
export interface FaqBlock extends BaseBlock {
  kind: 'faq';
  heading: string;
  items: Array<{ q: string; a: string }>;
}
export interface DividerBlock extends BaseBlock {
  kind: 'divider';
}
export interface MarqueeBlock extends BaseBlock {
  kind: 'marquee';
  text: string;
}

export type Block = HeroBlock | RichTextBlock | GalleryBlock | MintBlock | FaqBlock | DividerBlock | MarqueeBlock;

export type SiteBackground = 'ink' | 'manila' | 'void' | 'paper';
export type SiteFont = 'mono' | 'sans' | 'display';

export interface SiteTheme {
  accent: string;
  background: SiteBackground;
  font: SiteFont;
}
export interface SiteConfig {
  theme: SiteTheme;
  blocks: Block[];
}

export const BLOCK_KINDS: BlockKind[] = ['hero', 'richText', 'gallery', 'mint', 'faq', 'divider', 'marquee'];
export const BLOCK_LABELS: Record<BlockKind, string> = {
  hero: 'Hero',
  richText: 'Text',
  gallery: 'Gallery',
  mint: 'Mint widget',
  faq: 'FAQ',
  divider: 'Divider',
  marquee: 'Marquee',
};

const DEFAULT_THEME: SiteTheme = { accent: '#ffb000', background: 'ink', font: 'sans' };

let _seq = 0;
/** Unique-enough block id (monotonic + random; ids are opaque). */
export function blockId(kind: BlockKind): string {
  _seq += 1;
  return `${kind}-${Date.now().toString(36)}-${_seq.toString(36)}`;
}

/** Factory for a new block of the given kind, with sensible defaults. */
export function newBlock(kind: BlockKind, id: string = blockId(kind)): Block {
  switch (kind) {
    case 'hero':
      return { id, kind, title: 'Untitled Collection', subtitle: 'A generative drop.', align: 'center' };
    case 'richText':
      return { id, kind, heading: 'About', text: 'Tell your collection’s story here.' };
    case 'gallery':
      return { id, kind, heading: 'Gallery', columns: 3, count: 6 };
    case 'mint':
      return { id, kind, heading: 'Mint', price: '' };
    case 'faq':
      return { id, kind, heading: 'FAQ', items: [{ q: 'When does it mint?', a: 'Soon™.' }] };
    case 'divider':
      return { id, kind };
    case 'marquee':
      return { id, kind, text: '★ MINTING NOW ★ DON’T MISS OUT ★' };
  }
}

/** A sensible starter page for a fresh project. */
export function defaultSite(): SiteConfig {
  return {
    theme: { ...DEFAULT_THEME },
    blocks: [newBlock('hero'), newBlock('gallery'), newBlock('mint'), newBlock('faq')],
  };
}

function isBlock(b: unknown): b is Block {
  return !!b && typeof b === 'object' && BLOCK_KINDS.includes((b as Block).kind) && typeof (b as Block).id === 'string';
}

/** Fill an untrusted/partial site with defaults (keeps only well-formed blocks). */
export function resolveSite(partial?: Partial<SiteConfig> | null): SiteConfig {
  const p = partial ?? {};
  const t = (p.theme ?? {}) as Partial<SiteTheme>;
  const theme: SiteTheme = {
    accent: typeof t.accent === 'string' && t.accent ? t.accent : DEFAULT_THEME.accent,
    background: (['ink', 'manila', 'void', 'paper'] as const).includes(t.background as SiteBackground)
      ? (t.background as SiteBackground)
      : DEFAULT_THEME.background,
    font: (['mono', 'sans', 'display'] as const).includes(t.font as SiteFont) ? (t.font as SiteFont) : DEFAULT_THEME.font,
  };
  const blocks = Array.isArray(p.blocks) ? (p.blocks.filter(isBlock) as Block[]) : [];
  return { theme, blocks };
}

// --- Pure list operations (return a new SiteConfig; never mutate) ---

export function addBlock(site: SiteConfig, kind: BlockKind): SiteConfig {
  return { ...site, blocks: [...site.blocks, newBlock(kind)] };
}
export function removeBlock(site: SiteConfig, id: string): SiteConfig {
  return { ...site, blocks: site.blocks.filter((b) => b.id !== id) };
}
export function moveBlock(site: SiteConfig, id: string, dir: -1 | 1): SiteConfig {
  const i = site.blocks.findIndex((b) => b.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= site.blocks.length) return site;
  const blocks = [...site.blocks];
  const tmp = blocks[i]!;
  blocks[i] = blocks[j]!;
  blocks[j] = tmp;
  return { ...site, blocks };
}
export function updateBlock(site: SiteConfig, id: string, patch: Record<string, unknown>): SiteConfig {
  // Blocks are a discriminated union, so the patch is loosely typed; id/kind are pinned so a
  // field edit can never change a block's identity or kind.
  return {
    ...site,
    blocks: site.blocks.map((b) => (b.id === id ? ({ ...b, ...patch, id: b.id, kind: b.kind } as Block) : b)),
  };
}
export function setTheme(site: SiteConfig, patch: Partial<SiteTheme>): SiteConfig {
  return { ...site, theme: { ...site.theme, ...patch } };
}
