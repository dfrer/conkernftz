export * from './types.js';
export * from './providers/arweave-irys.js';
export * from './providers/ipfs-pinata.js';
export * from './providers/local.js';

import type { StorageProvider } from './types.js';
import { createIrysProvider, type IrysConfig } from './providers/arweave-irys.js';
import { createPinataProvider, type PinataConfig } from './providers/ipfs-pinata.js';
import { createLocalProvider, type LocalConfig } from './providers/local.js';

export interface StorageConfig {
  provider: 'irys' | 'pinata' | 'local';
  irys?: IrysConfig;
  pinata?: PinataConfig;
  local?: LocalConfig;
}

/** Instantiate the configured storage provider. */
export async function createStorageProvider(cfg: StorageConfig): Promise<StorageProvider> {
  switch (cfg.provider) {
    case 'irys':
      if (!cfg.irys) throw new Error('storage.irys config is required when provider is "irys"');
      return createIrysProvider(cfg.irys);
    case 'pinata':
      return createPinataProvider(cfg.pinata ?? {});
    case 'local':
      return createLocalProvider(cfg.local ?? {});
    default:
      throw new Error(`Unknown storage provider: ${(cfg as { provider: string }).provider}`);
  }
}
