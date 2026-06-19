// Starter mint-site layouts so the builder isn't a blank page. Each template builds a fresh
// SiteConfig (new block ids every call) from the same block factories the editor uses, so
// applying one is identical to having hand-added the blocks. Pure + unit-tested.

import { newBlock, type Block, type BlockKind, type SiteConfig, type SiteTheme, type PageBg } from './site';

function mk(kind: BlockKind, overrides: Record<string, unknown> = {}): Block {
  // newBlock supplies a valid block of `kind` (incl. id); overrides set known fields only.
  return { ...newBlock(kind), ...overrides } as Block;
}

function site(theme: SiteTheme, blocks: Block[], pageBg?: PageBg): SiteConfig {
  return {
    theme,
    layout: 'flow',
    canvas: { width: 960, height: 1400 },
    pageBg: pageBg ?? { kind: 'theme', color: '#101312', tile: '' },
    blocks,
  };
}

// A small tiled starfield for the GeoCities template (same shape as the builder's presets).
const STARS_TILE =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='60'%3E%3Ccircle cx='10' cy='12' r='1' fill='white'/%3E%3Ccircle cx='42' cy='30' r='1.3' fill='white'/%3E%3Ccircle cx='26' cy='50' r='.8' fill='white'/%3E%3C/svg%3E";

export interface SiteTemplate {
  id: string;
  label: string;
  description: string;
  build(): SiteConfig;
}

export const SITE_TEMPLATES: SiteTemplate[] = [
  {
    id: 'minimal',
    label: 'Minimal mint',
    description: 'Hero, mint widget, FAQ. Clean and to the point.',
    build: () =>
      site({ accent: '#ffb000', background: 'ink', font: 'sans' }, [
        mk('hero', { title: 'Untitled Collection', subtitle: 'A generative drop.', align: 'center' }),
        mk('mint', { heading: 'Mint' }),
        mk('faq'),
      ]),
  },
  {
    id: 'gallery',
    label: 'Gallery drop',
    description: 'Hero, a big gallery, an about section, mint, and FAQ.',
    build: () =>
      site({ accent: '#ffb000', background: 'ink', font: 'display' }, [
        mk('hero', { title: 'Untitled Collection', subtitle: 'Now revealing.', align: 'center' }),
        mk('gallery', { heading: 'The collection', columns: 4, count: 12 }),
        mk('richText', { heading: 'About', text: 'Tell your collection’s story here.' }),
        mk('mint', { heading: 'Mint yours' }),
        mk('faq'),
      ]),
  },
  {
    id: 'geocities',
    label: 'GeoCities',
    description: 'WordArt, marquee, blink, hit counter, web ring — peak 1999.',
    build: () =>
      site(
        { accent: '#00ffff', background: 'void', font: 'mono' },
        [
          mk('wordArt', { text: 'WELCOME', style: 'rainbow' }),
          mk('marquee', { text: '★ MINTING NOW ★ TELL YOUR FRIENDS ★' }),
          mk('blink', { text: 'NEW!!!', color: '#ff2d2d' }),
          mk('gallery', { heading: 'My Kool NFTs', columns: 3, count: 9 }),
          mk('mint', { heading: 'Mint one!!' }),
          mk('hitCounter', { label: 'You are visitor #', start: 1337 }),
          mk('webRing', { name: 'The NFT Web Ring' }),
          mk('underConstruction', { text: 'UNDER CONSTRUCTION' }),
        ],
        { kind: 'tile', color: '#080014', tile: STARS_TILE },
      ),
  },
];
