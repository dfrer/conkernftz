import { Command } from 'commander';
import fs from 'node:fs/promises';
import fssync from 'node:fs';
import path from 'node:path';
import type { StorageProvider } from '@conkernftz/storage';

type UriMap = Record<string, string>;

export function uploadCmd(): Command {
  const cmd = new Command('upload');
  cmd
    .description('Upload build outputs to storage and rewrite local JSON URIs')
    .option('--provider <name>', 'override storage.provider (irys|pinata|local)')
    .option('--mode <mode>', 'auto | dir | files (auto = dir for EVM, files for Solana)', 'auto')
    .option('--concurrency <n>', 'parallel uploads (files mode)', '4')
    .option('--force', 'ignore existing manifest and re-upload everything', false)
    .addHelpText(
      'afterAll',
      `
Providers (configure under foundry.config.json -> storage):
  - local : copies to build/storage and returns file://(or gatewayBase) URIs. No creds; great for dry-runs.
  - pinata: IPFS via Pinata JWT (storage.pinata.jwt). dir mode -> ipfs://<dirCid>/.
  - irys  : Arweave via Irys (storage.irys.{token,keyPath,rpcUrl}); requires optional @irys/* deps.

Modes:
  - dir  : uploads images/ and json/ as directories. Sets a contract-ready baseUri (token N at <baseUri>N.json). Best for EVM.
  - files: uploads each file individually (per-file URIs). Best for Solana per-token mints.

Examples:
  foundry upload --provider local --mode dir
  foundry upload --provider pinata --mode dir
  foundry upload --provider pinata --mode files --concurrency 6
`,
    )
    .action(async (opts) => {
      const cwd = process.cwd();
      const cfgPath = path.join(cwd, 'foundry.config.json');
      const raw = await fs.readFile(cfgPath, 'utf8');
      const { ProjectConfigSchema } = await import('@conkernftz/core/project-config');
      const cfg = ProjectConfigSchema.parse(JSON.parse(raw));

      const outDir = path.isAbsolute(cfg.export.outDir) ? cfg.export.outDir : path.join(cwd, cfg.export.outDir);
      const imagesDir = path.join(outDir, 'images');
      const jsonDir = path.join(outDir, 'json');
      const manifestPath = path.join(outDir, '.upload-manifest.json');

      const providerName = (opts.provider ?? cfg.storage.provider) as
        | 'irys'
        | 'pinata'
        | 'local'
        | 'arweave'
        | 'ipfs';
      const mode: 'dir' | 'files' =
        opts.mode === 'auto' ? (cfg.chain.target === 'evm' ? 'dir' : 'files') : (opts.mode as 'dir' | 'files');

      const { createProvider } = await import('@conkernftz/storage');
      const provider = await createProvider({
        provider: providerName,
        projectRoot: cwd,
        local: cfg.storage.local,
        pinata: cfg.storage.pinata,
        irys: cfg.storage.irys,
      });

      let existing: Record<string, unknown> = {};
      if (!opts.force && fssync.existsSync(manifestPath)) {
        try {
          existing = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
        } catch {
          /* ignore malformed manifest */
        }
      }

      if (mode === 'dir') {
        await uploadDirMode(provider, { imagesDir, jsonDir, manifestPath, existing, force: !!opts.force });
      } else {
        await uploadFilesMode(provider, {
          imagesDir,
          jsonDir,
          manifestPath,
          existing,
          force: !!opts.force,
          concurrency: Math.max(1, Number(opts.concurrency) || 4),
        });
      }
    });
  return cmd;
}

interface ModeCtx {
  imagesDir: string;
  jsonDir: string;
  manifestPath: string;
  existing: Record<string, unknown>;
  force: boolean;
}

async function uploadDirMode(provider: StorageProvider, ctx: ModeCtx): Promise<void> {
  let imagesBaseUri = ctx.force ? undefined : (ctx.existing.imagesBaseUri as string | undefined);
  let imageFiles = ctx.force ? {} : ((ctx.existing.images as UriMap) ?? {});
  let imagesCid: string | undefined;

  if (!imagesBaseUri) {
    const res = await provider.uploadDirectory(ctx.imagesDir);
    imagesBaseUri = res.baseUri;
    imageFiles = res.files;
    imagesCid = res.cid;
    console.log(`Uploaded images/ -> ${imagesBaseUri}`);
  } else {
    console.log(`Skipping images/ (already uploaded): ${imagesBaseUri}`);
  }

  // Rewrite token JSON to point image/animation URIs at the uploaded images directory.
  const base = imagesBaseUri;
  await rewriteJsonUris(ctx.jsonDir, (rel) => imageFiles[rel] ?? `${base}${rel}`);

  // Upload the json/ directory; its baseUri is the contract baseURI (token N at <baseUri>N.json).
  const jsonRes = await provider.uploadDirectory(ctx.jsonDir);
  console.log(`Uploaded json/ -> ${jsonRes.baseUri}`);

  const manifest = {
    provider: provider.id,
    mode: 'dir' as const,
    baseUri: jsonRes.baseUri,
    jsonCid: jsonRes.cid,
    imagesBaseUri,
    imagesCid,
    images: imageFiles,
    metadata: jsonRes.files,
  };
  await fs.writeFile(ctx.manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`Wrote ${path.basename(ctx.manifestPath)}. Contract baseURI = ${jsonRes.baseUri}`);
}

async function uploadFilesMode(provider: StorageProvider, ctx: ModeCtx & { concurrency: number }): Promise<void> {
  const imageNames = (await fs.readdir(ctx.imagesDir)).filter((f) => /\.(png|webp|gif|mp4|webm)$/i.test(f));
  const imgManifest: UriMap = ctx.force ? {} : { ...((ctx.existing.images as UriMap) ?? {}) };
  await runPool(imageNames, ctx.concurrency, async (name) => {
    if (!ctx.force && imgManifest[name]) return;
    const { uri } = await provider.uploadFile(path.join(ctx.imagesDir, name));
    imgManifest[name] = uri;
  });

  await rewriteJsonUris(ctx.jsonDir, (rel) => imgManifest[rel]);

  const jsonNames = (await fs.readdir(ctx.jsonDir)).filter((f) => f.endsWith('.json'));
  const jsonManifest: UriMap = ctx.force ? {} : { ...((ctx.existing.metadata as UriMap) ?? {}) };
  await runPool(jsonNames, ctx.concurrency, async (name) => {
    if (!ctx.force && jsonManifest[name]) return;
    const { uri } = await provider.uploadFile(path.join(ctx.jsonDir, name));
    jsonManifest[name] = uri;
  });

  const manifest = { provider: provider.id, mode: 'files' as const, images: imgManifest, metadata: jsonManifest };
  await fs.writeFile(ctx.manifestPath, JSON.stringify(manifest, null, 2));
  const failedImages = imageNames.filter((f) => !imgManifest[f]);
  const failedJson = jsonNames.filter((f) => !jsonManifest[f]);
  console.log(`Upload complete (${provider.id}). Local JSON rewritten and manifest saved.`);
  if (failedImages.length || failedJson.length) {
    console.warn(`Some uploads failed. Images: ${failedImages.length}, Metadata: ${failedJson.length}`);
  }
}

/** Rewrite image/animation_url/properties.files URIs in every token JSON by basename lookup. */
async function rewriteJsonUris(jsonDir: string, mapRel: (rel: string) => string | undefined): Promise<void> {
  const names = (await fs.readdir(jsonDir)).filter((f) => f.endsWith('.json'));
  for (const name of names) {
    const p = path.join(jsonDir, name);
    const j = JSON.parse(await fs.readFile(p, 'utf8')) as Record<string, unknown>;
    let changed = false;

    const remap = (value: unknown): string | undefined => {
      if (typeof value !== 'string') return undefined;
      const baseName = value.split(/[\\/]/).pop();
      if (!baseName) return undefined;
      return mapRel(baseName);
    };

    const nextImage = remap(j.image);
    if (nextImage) {
      j.image = nextImage;
      changed = true;
    }
    const nextAnim = remap(j.animation_url);
    if (nextAnim) {
      j.animation_url = nextAnim;
      changed = true;
    }

    const props = j.properties as Record<string, unknown> | undefined;
    const files = props?.files as Array<{ uri?: string; type?: string }> | undefined;
    if (Array.isArray(files)) {
      for (const f of files) {
        const next = remap(f.uri);
        if (next) {
          f.uri = next;
          changed = true;
        }
      }
    }

    if (changed) await fs.writeFile(p, JSON.stringify(j, null, 2));
  }
}

/** Run `worker` over `items` with bounded concurrency. */
async function runPool<T>(items: T[], concurrency: number, worker: (item: T) => Promise<void>): Promise<void> {
  let idx = 0;
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (true) {
      const current = idx++;
      if (current >= items.length) break;
      const item = items[current];
      if (item === undefined) continue;
      await worker(item);
    }
  });
  await Promise.all(runners);
}
