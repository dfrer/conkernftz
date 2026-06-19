import type { ProjectConfig } from '../state/project';

export interface NewProjectOpts {
  name: string;
  symbol?: string;
  chain?: 'evm' | 'solana';
  editionSize?: number;
}

/** Starter layer set scaffolded for a fresh collection (empty folders the artist fills). */
export const STARTER_LAYERS = ['Background', 'Body', 'Eyes', 'Headwear'] as const;

/** Derive a ticker symbol from a collection name: alphanumerics, upper-cased, max 8 chars. */
export function deriveSymbol(name: string): string {
  const cleaned = name.replace(/[^A-Za-z0-9]/g, '').slice(0, 8).toUpperCase();
  return cleaned || 'COLL';
}

/**
 * Build the starter foundry.config.json for a new project. Pure so it's unit-tested and
 * the scaffold flow (renderer state) stays a thin orchestrator over the file-writing bridge.
 */
export function makeStarterConfig(opts: NewProjectOpts): ProjectConfig {
  const name = opts.name.trim() || 'Untitled Collection';
  const symbol = opts.symbol?.trim() ? opts.symbol.trim().toUpperCase() : deriveSymbol(name);
  const editionSize = opts.editionSize && opts.editionSize > 0 ? Math.floor(opts.editionSize) : 100;
  return {
    name,
    symbol,
    description: '',
    editionSize,
    image: { width: 1024, height: 1024, background: 'transparent' },
    layers: STARTER_LAYERS.map((layerName, i) => ({
      name: layerName,
      path: `layers/${layerName}`,
      rarity: 'filename',
      required: i < 3, // Headwear (last) is optional by default.
    })),
    rarity: { delimiter: '#', defaultWeight: 1 },
    export: { outDir: 'build', imageFormat: 'png' },
    storage: { provider: 'pinata' },
    chain: { target: opts.chain ?? 'evm' },
  };
}
