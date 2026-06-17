import { Command } from 'commander';
import fs from 'node:fs/promises';
import path from 'node:path';

export function initCmd(): Command {
  const cmd = new Command('init');
  cmd.description('Scaffold a foundry project').action(async () => {
    const cwd = process.cwd();
    const cfgPath = path.join(cwd, 'foundry.config.json');
    const has = await exists(cfgPath);
    if (has) {
      console.log('foundry.config.json already exists.');
      return;
    }
    const template = getTemplate();
    await fs.writeFile(cfgPath, JSON.stringify(template, null, 2));
    await fs.mkdir(path.join(cwd, 'layers'), { recursive: true });
    // Create layer directories from template
    const layers = (template.layers as Array<{ path: string }>) ?? [];
    for (const l of layers) {
      const dir = path.join(cwd, String(l.path));
      await fs.mkdir(dir, { recursive: true });
    }
    console.log('Initialized foundry project.');
  });
  return cmd;
}

async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

function getTemplate(): Record<string, unknown> {
  return {
    name: 'Example Collection',
    symbol: 'EXMPL',
    description: 'Example collection.',
    editionSize: 10,
    image: { width: 1024, height: 1024, background: 'transparent' },
    layers: [
      { name: 'Background', path: 'layers/background', rarity: 'filename', required: true },
      { name: 'Body', path: 'layers/body' },
      { name: 'Eyes', path: 'layers/eyes' },
      { name: 'Headwear', path: 'layers/headwear' },
    ],
    rules: {
      mutuallyExclusive: [["Eyes:Laser", "Headwear:Visor"]],
      requires: [{ if: 'Headwear:Crown', thenAnyOf: ['Background:Royal', 'Background:Gold'] }],
      maxOccurrences: [{ trait: 'Headwear:Crown', max: 5 }],
    },
    rarity: { mode: 'filenameDelimiter', delimiter: '#', defaultWeight: 1 },
    uniqueness: { hash: 'sha256', ignore: ['Background'] },
    export: { outDir: 'build', imageFormat: 'png', includePreviewContactSheet: true },
    storage: {
      provider: 'irys',
      irys: { token: 'solana', keyPath: './keys/solana.json' },
      pinata: { jwt: '', gateway: '' },
      local: { baseUri: '' },
    },
    chain: {
      target: 'solana',
      solana: {
        cluster: 'devnet',
        rpcUrl: '',
        walletKeypairPath: './keys/solana.json',
        sellerFeeBasisPoints: 500,
        creators: [{ address: '<WALLET_PUBKEY>', share: 100, verified: true }],
        collection: { mint: null },
        isMutable: true,
        usePnft: false,
        rulesetPda: null,
      },
      // To target an EVM chain instead, set target to 'evm' and fill in this block.
      evm: {
        chainId: 11155111,
        rpcUrl: 'https://rpc.sepolia.org',
        privateKeyPath: './keys/evm.key',
        baseUri: '',
        maxSupply: 0,
        royaltyReceiver: '',
        royaltyBps: 500,
      },
    },
  };
}


