import { describe, expect, it } from 'vitest';
import * as browserEvm from '../lib/chainEvmBrowser.mjs';

describe('browser bundle boundaries', () => {
  it('exposes only browser-safe chain adapter exports', () => {
    expect(Object.keys(browserEvm).sort()).toEqual([
      'LAUNCH_PHASES',
      'buildMintCall',
      'conkernftzLaunchAbi',
      'conkernftzLaunchBytecode',
      'dumpAllowlist',
      'explorerTxUrl',
      'parseAllowlist',
      'planMint',
      'toAddEthereumChainParams',
    ]);
  });
});
