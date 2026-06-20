// Site builder model (P2 / GeoCities). A serializable mint page: theme + page settings +
// an ordered list of blocks. Two layout modes — 'flow' (stacked sections) and 'canvas'
// (free-form, absolute-positioned, GeoCities-style). Each block carries a per-breakpoint
// layout (desktop + optional mobile override) so the page can be tuned for both. DOM-free
// and pure so it's unit-tested directly; the React renderer is a thin view, and the SAME
// config + renderer is emitted as the static mint site by P3 (no drift).
import type { AllowlistDump } from '@conkernftz/chain-evm';

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
  | 'underConstruction'
  | 'bestViewed'
  | 'audio'
  | 'guestbook';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface BlockLayout extends Rect {
  z: number;
  /** Rotation in degrees (canvas mode). */
  rot?: number;
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
  /** Optional counter-service image URL (the period-accurate way to get a REAL global count on
   * a static site, e.g. hitwebcounter/counterapi). When set, the service image replaces the
   * static number. */
  src?: string;
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
  /** Optional 88×31 badge image (URL or data URL). When set, replaces the text label. */
  src?: string;
}
export interface WebRingBlock extends BaseBlock {
  kind: 'webRing';
  name: string;
  /** Ring navigation targets — rendered as real links when set (else decorative). */
  prev?: string;
  next?: string;
  random?: string;
  /** The ring hub/home; the ring name links here when set. */
  hub?: string;
}
export interface UnderConstructionBlock extends BaseBlock {
  kind: 'underConstruction';
  text: string;
}
export interface BestViewedBlock extends BaseBlock {
  kind: 'bestViewed';
  text: string;
}
export interface AudioBlock extends BaseBlock {
  kind: 'audio';
  /** MIDI/MP3/OGG URL or data URL. */
  src: string;
  label: string;
  loop: boolean;
  /** Browsers block un-muted autoplay until interaction; we render controls regardless. */
  autoplay: boolean;
}
export interface GuestbookBlock extends BaseBlock {
  kind: 'guestbook';
  label: string;
  /** A static site can't store entries — link to an external guestbook service. */
  href: string;
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
  | UnderConstructionBlock
  | BestViewedBlock
  | AudioBlock
  | GuestbookBlock;

export type SiteLayoutMode = 'flow' | 'canvas';
/** Page-level retro cursor effect (a sparkle/comet trail that follows the pointer). */
export type SiteCursor = 'none' | 'sparkle' | 'comet';
export const SITE_CURSORS: readonly SiteCursor[] = ['none', 'sparkle', 'comet'];
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
/**
 * Live-mint wiring for the generated site's mint widget. When present (a deployed launch
 * contract), the mint block renders a non-custodial connect+mint UI against this contract; when
 * absent, the mint block stays preview-only. Testnet-first — point this at Base-Sepolia/Sepolia
 * until the contract is audited.
 */
export interface MintConfig {
  chainId: number;
  rpcUrl: string;
  contractAddress: string;
  /** Embedded allowlist proofs (the dump from `conkernftz launch allowlist`), if any. */
  allowlist?: AllowlistDump;
}

export interface SiteConfig {
  theme: SiteTheme;
  layout?: SiteLayoutMode;
  canvas?: { width: number; height: number };
  pageBg?: PageBg;
  /** Page-level cursor-trail effect (default none). */
  cursor?: SiteCursor;
  /** Optional live-mint contract wiring (else the mint widget is preview-only). */
  mint?: MintConfig;
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
  'bestViewed',
  'audio',
  'guestbook',
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
  bestViewed: 'Best viewed in…',
  audio: 'Music / MIDI',
  guestbook: 'Guestbook',
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
  'bestViewed',
  'guestbook',
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
    case 'bestViewed':
      return { id, kind, text: 'Best viewed in Netscape Navigator at 800×600' };
    case 'audio':
      return { id, kind, src: '', label: '♪ now playing', loop: true, autoplay: false };
    case 'guestbook':
      return { id, kind, label: '✍ Sign my guestbook', href: '' };
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
  const cursor: SiteCursor = (SITE_CURSORS as readonly string[]).includes(p.cursor as string) ? (p.cursor as SiteCursor) : 'none';
  const blocks = Array.isArray(p.blocks) ? (p.blocks.filter(isBlock) as Block[]) : [];
  const mint = normalizeMint(p.mint);
  return { theme, layout, canvas, pageBg, cursor, ...(mint ? { mint } : {}), blocks };
}

/** Validate optional live-mint wiring so it survives resolveSite → export only when complete. */
function normalizeMint(m: unknown): MintConfig | undefined {
  if (!m || typeof m !== 'object') return undefined;
  const o = m as Partial<MintConfig>;
  if (typeof o.contractAddress !== 'string' || !o.contractAddress) return undefined;
  if (typeof o.rpcUrl !== 'string' || !o.rpcUrl) return undefined;
  if (typeof o.chainId !== 'number' || !Number.isInteger(o.chainId)) return undefined;
  const out: MintConfig = { chainId: o.chainId, rpcUrl: o.rpcUrl, contractAddress: o.contractAddress };
  if (o.allowlist && typeof o.allowlist === 'object') out.allowlist = o.allowlist as AllowlistDump;
  return out;
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
export function removeBlocks(site: SiteConfig, ids: readonly string[]): SiteConfig {
  const drop = new Set(ids);
  return { ...site, blocks: site.blocks.filter((b) => !drop.has(b.id)) };
}
export function moveBlock(site: SiteConfig, id: string, dir: -1 | 1): SiteConfig {
  const i = site.blocks.findIndex((b) => b.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= site.blocks.length) return site;
  const bi = site.blocks[i]!;
  const bj = site.blocks[j]!;
  const blocks = [...site.blocks];
  // Swap list positions, AND keep each canvas z-index with its POSITION — otherwise in
  // free-form/canvas mode reordering does nothing visible (stacking is by z, not list order).
  // Net effect: moving a block down the list also brings it forward (matches the default
  // z = index + 1 convention); in flow mode there's no z so it's a plain reorder.
  blocks[i] = withZ(bj, bi.layout?.z);
  blocks[j] = withZ(bi, bj.layout?.z);
  return { ...site, blocks };
}
function withZ(block: Block, z: number | undefined): Block {
  if (block.layout && typeof z === 'number') return { ...block, layout: { ...block.layout, z } };
  return block;
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
export function setCursor(site: SiteConfig, cursor: SiteCursor): SiteConfig {
  return { ...site, cursor };
}
