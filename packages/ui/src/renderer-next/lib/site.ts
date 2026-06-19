// Site builder model (P2 / GeoCities). A serializable mint page: theme + page settings +
// an ordered list of blocks. Two layout modes — 'flow' (stacked sections) and 'canvas'
// (free-form, absolute-positioned, GeoCities-style). Each block carries a per-breakpoint
// layout (desktop + optional mobile override) so the page can be tuned for both. DOM-free
// and pure so it's unit-tested directly; the React renderer is a thin view, and the SAME
// config + renderer is emitted as the static mint site by P3 (no drift).

export type BlockKind =
  | 'hero'
  | 'richText'
  | 'gallery'
  | 'mint'
  | 'faq'
  | 'divider'
  | 'marquee'
  | 'blink'
  | 'image'
  | 'hitCounter'
  | 'html'
  | 'wordArt'
  | 'button'
  | 'webRing'
  | 'underConstruction';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface BlockLayout extends Rect {
  z: number;
  mobile?: Rect;
}

export type SiteAlign = 'left' | 'center' | 'right';

export interface BaseBlock {
  id: string;
  kind: BlockKind;
  /** Free-form (canvas) placement. Ignored in 'flow' mode. */
  layout?: BlockLayout;
  /** Text size multiplier (1 = default). Scales the block's TEXT only. */
  fontScale?: number;
  /** Whole-widget size multiplier (1 = default) — scales everything in the block (the mint
   * pack, images, text…) via CSS zoom, reserving the scaled space. */
  scale?: number;
  /** Text alignment override (default: inherit / left). */
  align?: SiteAlign;
  /** Text color override (default: theme color). */
  color?: string;
}
export interface HeroBlock extends BaseBlock {
  kind: 'hero';
  title: string;
  subtitle: string;
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
export interface BlinkBlock extends BaseBlock {
  kind: 'blink';
  text: string;
  color: string;
}
export interface ImageBlock extends BaseBlock {
  kind: 'image';
  src: string;
  alt: string;
}
export interface HitCounterBlock extends BaseBlock {
  kind: 'hitCounter';
  label: string;
  start: number;
}
export interface HtmlBlock extends BaseBlock {
  kind: 'html';
  html: string;
}
export interface WordArtBlock extends BaseBlock {
  kind: 'wordArt';
  text: string;
  style: 'rainbow' | 'chrome' | 'fire';
}
export interface ButtonBlock extends BaseBlock {
  kind: 'button';
  text: string;
  href: string;
}
export interface WebRingBlock extends BaseBlock {
  kind: 'webRing';
  name: string;
}
export interface UnderConstructionBlock extends BaseBlock {
  kind: 'underConstruction';
  text: string;
}

export type Block =
  | HeroBlock
  | RichTextBlock
  | GalleryBlock
  | MintBlock
  | FaqBlock
  | DividerBlock
  | MarqueeBlock
  | BlinkBlock
  | ImageBlock
  | HitCounterBlock
  | HtmlBlock
  | WordArtBlock
  | ButtonBlock
  | WebRingBlock
  | UnderConstructionBlock;

export type SiteLayoutMode = 'flow' | 'canvas';
export type SiteBackground = 'ink' | 'manila' | 'void' | 'paper';
export type SiteFont = 'mono' | 'sans' | 'display';
export type SiteBgKind = 'theme' | 'color' | 'tile';

export interface SiteTheme {
  accent: string;
  background: SiteBackground;
  font: SiteFont;
}
/** Page-level background fill (the GeoCities tiled-wallpaper slot). */
export interface PageBg {
  kind: SiteBgKind;
  color: string;
  /** Tiled wallpaper: a data URL / asset path. */
  tile: string;
}
export interface SiteConfig {
  theme: SiteTheme;
  layout?: SiteLayoutMode;
  canvas?: { width: number; height: number };
  pageBg?: PageBg;
  blocks: Block[];
}

export const BLOCK_KINDS: BlockKind[] = [
  'hero',
  'richText',
  'gallery',
  'mint',
  'faq',
  'divider',
  'marquee',
  'blink',
  'image',
  'hitCounter',
  'html',
  'wordArt',
  'button',
  'webRing',
  'underConstruction',
];
export const BLOCK_LABELS: Record<BlockKind, string> = {
  hero: 'Hero',
  richText: 'Text',
  gallery: 'Gallery',
  mint: 'Mint widget',
  faq: 'FAQ',
  divider: 'Divider',
  marquee: 'Marquee',
  blink: 'Blink text',
  image: 'Image / GIF',
  hitCounter: 'Hit counter',
  html: 'Raw HTML',
  wordArt: 'WordArt',
  button: '88×31 button',
  webRing: 'Web ring',
  underConstruction: 'Under construction',
};

export const SITE_ALIGNS: readonly SiteAlign[] = ['left', 'center', 'right'];
/** Validate an untrusted alignment; returns undefined (inherit) when not a known value. */
export function normalizeAlign(v: unknown): SiteAlign | undefined {
  return (SITE_ALIGNS as readonly string[]).includes(v as string) ? (v as SiteAlign) : undefined;
}

// Per-block multiplier bounds (text size + whole-widget scale).
export const MIN_FONT_SCALE = 0.5;
export const MAX_FONT_SCALE = 4;
export const MIN_BLOCK_SCALE = 0.25;
export const MAX_BLOCK_SCALE = 4;
function clampMul(v: unknown, min: number, max: number): number {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) return 1;
  return Math.max(min, Math.min(max, Math.round(n * 100) / 100));
}
/** Clamp an untrusted font-size multiplier; defaults to 1 (unscaled). */
export function clampFontScale(v: unknown): number {
  return clampMul(v, MIN_FONT_SCALE, MAX_FONT_SCALE);
}
/** Clamp an untrusted whole-widget scale; defaults to 1 (unscaled). */
export function clampScale(v: unknown): number {
  return clampMul(v, MIN_BLOCK_SCALE, MAX_BLOCK_SCALE);
}
// Blocks whose text the font-size control applies to. Excludes image/divider/gallery/raw-HTML
// (no own text) and the 88×31 button (a fixed-dimension retro badge — scaling overflows it).
export const TEXT_BLOCK_KINDS: ReadonlySet<BlockKind> = new Set<BlockKind>([
  'hero',
  'richText',
  'faq',
  'mint',
  'marquee',
  'blink',
  'wordArt',
  'webRing',
  'underConstruction',
  'hitCounter',
]);
export function blockHasText(kind: BlockKind): boolean {
  return TEXT_BLOCK_KINDS.has(kind);
}

const DEFAULT_THEME: SiteTheme = { accent: '#ffb000', background: 'ink', font: 'sans' };
const DEFAULT_CANVAS = { width: 960, height: 1400 };
const DEFAULT_PAGE_BG: PageBg = { kind: 'theme', color: '#101312', tile: '' };

let _seq = 0;
export function blockId(kind: BlockKind): string {
  _seq += 1;
  return `${kind}-${Date.now().toString(36)}-${_seq.toString(36)}`;
}

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
    case 'blink':
      return { id, kind, text: 'NEW!!!', color: '#ff2d2d' };
    case 'image':
      return { id, kind, src: '', alt: 'image' };
    case 'hitCounter':
      return { id, kind, label: 'You are visitor #', start: 1337 };
    case 'html':
      return { id, kind, html: '<!-- your HTML here -->\n<b>Hello, web.</b>' };
    case 'wordArt':
      return { id, kind, text: 'WELCOME', style: 'rainbow' };
    case 'button':
      return { id, kind, text: 'cool site', href: '' };
    case 'webRing':
      return { id, kind, name: 'The NFT Web Ring' };
    case 'underConstruction':
      return { id, kind, text: 'UNDER CONSTRUCTION' };
  }
}

/** A reasonable default canvas rect for the Nth block when none is stored. */
export function defaultLayout(index: number): BlockLayout {
  const col = index % 2;
  const row = Math.floor(index / 2);
  return { x: 40 + col * 440, y: 40 + row * 200, w: 400, h: 160, z: index + 1 };
}

export function defaultSite(): SiteConfig {
  return {
    theme: { ...DEFAULT_THEME },
    layout: 'flow',
    canvas: { ...DEFAULT_CANVAS },
    pageBg: { ...DEFAULT_PAGE_BG },
    blocks: [newBlock('hero'), newBlock('gallery'), newBlock('mint'), newBlock('faq')],
  };
}

function isBlock(b: unknown): b is Block {
  return !!b && typeof b === 'object' && BLOCK_KINDS.includes((b as Block).kind) && typeof (b as Block).id === 'string';
}

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
  const layout: SiteLayoutMode = p.layout === 'canvas' ? 'canvas' : 'flow';
  const canvas = {
    width: clampNum(p.canvas?.width, 320, 4096, DEFAULT_CANVAS.width),
    height: clampNum(p.canvas?.height, 320, 12000, DEFAULT_CANVAS.height),
  };
  const bg = (p.pageBg ?? {}) as Partial<PageBg>;
  const pageBg: PageBg = {
    kind: (['theme', 'color', 'tile'] as const).includes(bg.kind as SiteBgKind) ? (bg.kind as SiteBgKind) : 'theme',
    color: typeof bg.color === 'string' && bg.color ? bg.color : DEFAULT_PAGE_BG.color,
    tile: typeof bg.tile === 'string' ? bg.tile : '',
  };
  const blocks = Array.isArray(p.blocks) ? (p.blocks.filter(isBlock) as Block[]) : [];
  return { theme, layout, canvas, pageBg, blocks };
}

function clampNum(v: unknown, min: number, max: number, fallback: number): number {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

// --- Pure operations (immutable) ---

export function addBlock(site: SiteConfig, kind: BlockKind): SiteConfig {
  const block = newBlock(kind);
  if (site.layout === 'canvas') block.layout = defaultLayout(site.blocks.length);
  return { ...site, blocks: [...site.blocks, block] };
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
  return {
    ...site,
    blocks: site.blocks.map((b) => (b.id === id ? ({ ...b, ...patch, id: b.id, kind: b.kind } as Block) : b)),
  };
}
/** Set/merge a block's desktop canvas rect (z preserved unless patched). */
export function setBlockLayout(site: SiteConfig, id: string, patch: Partial<BlockLayout>): SiteConfig {
  return {
    ...site,
    blocks: site.blocks.map((b) => {
      if (b.id !== id) return b;
      const base = b.layout ?? defaultLayout(site.blocks.indexOf(b));
      return { ...b, layout: { ...base, ...patch } };
    }),
  };
}
/** Set/merge a block's mobile-override rect. */
export function setBlockMobile(site: SiteConfig, id: string, patch: Partial<Rect>): SiteConfig {
  return {
    ...site,
    blocks: site.blocks.map((b) => {
      if (b.id !== id) return b;
      const base = b.layout ?? defaultLayout(site.blocks.indexOf(b));
      const mobile = { ...(base.mobile ?? { x: base.x, y: base.y, w: base.w, h: base.h }), ...patch };
      return { ...b, layout: { ...base, mobile } };
    }),
  };
}
export function setTheme(site: SiteConfig, patch: Partial<SiteTheme>): SiteConfig {
  return { ...site, theme: { ...site.theme, ...patch } };
}
export function setLayoutMode(site: SiteConfig, mode: SiteLayoutMode): SiteConfig {
  // Seed canvas rects for any block missing one when entering canvas mode.
  if (mode === 'canvas') {
    const blocks = site.blocks.map((b, i) => (b.layout ? b : { ...b, layout: defaultLayout(i) }));
    return { ...site, layout: mode, blocks };
  }
  return { ...site, layout: mode };
}
export function setCanvas(site: SiteConfig, patch: Partial<{ width: number; height: number }>): SiteConfig {
  const cur = site.canvas ?? DEFAULT_CANVAS;
  return { ...site, canvas: { ...cur, ...patch } };
}
export function setPageBg(site: SiteConfig, patch: Partial<PageBg>): SiteConfig {
  const cur = site.pageBg ?? DEFAULT_PAGE_BG;
  return { ...site, pageBg: { ...cur, ...patch } };
}
