import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';
import fssync from 'node:fs';
import { execa } from 'execa';

async function mkdtemp(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'foundry-e2e-'));
  return dir;
}

async function writePng(p: string, b64: string): Promise<void> {
  const buf = Buffer.from(b64, 'base64');
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, buf);
}

// 1x1 red and green PNGs
const RED_PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGMAAQAABQABDQottQAAAABJRU5ErkJggg==';
const GRN_PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGP4DwQAAhoB9m9k5dIAAAAASUVORK5CYII=';

describe('CLI e2e build (tiny project)', () => {
  let projDir: string;
  const outDirRel = 'build';

  beforeAll(async () => {
    projDir = await mkdtemp();
    // Write tiny layer assets
    await writePng(path.join(projDir, 'layers', 'background', 'Red#1.png'), RED_PNG);
    await writePng(path.join(projDir, 'layers', 'background', 'Green#1.png'), GRN_PNG);
    await writePng(path.join(projDir, 'layers', 'body', 'Red#1.png'), RED_PNG);
    await writePng(path.join(projDir, 'layers', 'body', 'Green#1.png'), GRN_PNG);
    // Write config
    const cfg = {
      name: 'Tiny',
      symbol: 'TNY',
      description: 'Tiny test',
      editionSize: 3,
      image: { width: 8, height: 8, background: 'transparent' },
      layers: [
        { name: 'Background', path: 'layers/background', rarity: 'filename', required: true },
        { name: 'Body', path: 'layers/body', rarity: 'filename', required: true },
      ],
      rules: {},
      rarity: { mode: 'filenameDelimiter', delimiter: '#', defaultWeight: 1 },
      uniqueness: { hash: 'sha256', ignore: [] },
      export: { outDir: outDirRel, imageFormat: 'png', includePreviewContactSheet: false },
      storage: { provider: 'arweave', arweave: { bundlrNode: 'https://node1.bundlr.network', currency: 'sol', keyPath: './keys/bundlr.json' }, ipfs: {} },
      chain: { target: 'solana', solana: { cluster: 'devnet', rpcUrl: '', walletKeypairPath: './keys/solana.json', sellerFeeBasisPoints: 0, creators: [{ address: '11111111111111111111111111111111', share: 100 }], collection: { mint: null }, isMutable: true, usePnft: false, rulesetPda: null } },
    } as const;
    await fs.writeFile(path.join(projDir, 'foundry.config.json'), JSON.stringify(cfg, null, 2));
  });

  afterAll(async () => {
    try {
      if (projDir && projDir.startsWith(os.tmpdir())) {
        await fs.rm(projDir, { recursive: true, force: true });
      }
    } catch {}
  });

  it('builds images and metadata', async () => {
    const bin = path.resolve(__dirname, '../../dist/bin.js');
    expect(fssync.existsSync(bin)).toBe(true);
    const { exitCode } = await execa('node', [bin, 'build', '--count', '3'], { cwd: projDir });
    expect(exitCode).toBe(0);
    const imagesDir = path.join(projDir, outDirRel, 'images');
    const jsonDir = path.join(projDir, outDirRel, 'json');
    for (const i of [1, 2, 3]) {
      expect(fssync.existsSync(path.join(imagesDir, `${i}.png`))).toBe(true);
      const j = JSON.parse(await fs.readFile(path.join(jsonDir, `${i}.json`), 'utf8'));
      expect(j.image).toContain(`./images/${i}.png`);
      expect(j.properties.files[0].type).toBe('image/png');
    }
  }, 30000);
});


