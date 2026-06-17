import { Command } from 'commander';
import fs from 'node:fs/promises';
import path from 'node:path';
// Lazy import to avoid loading heavy deps on startup

interface UploadOpts {
  mode: string;
  concurrency: string;
  retries: string;
}

export function uploadCmd(): Command {
  const cmd = new Command('upload');
  cmd
    .description('Upload images and metadata to the configured storage provider and rewrite local JSON URIs')
    .option(
      '--mode <mode>',
      'upload mode: "file" (per-file URIs, for Solana) or "dir" (one base CID, for an EVM baseURI)',
      'file',
    )
    .option('--concurrency <n>', 'parallel uploads', '4')
    .option('--retries <n>', 'retry attempts per file on failure', '3')
    .action(async (opts: UploadOpts) => {
      const cfgPath = path.join(process.cwd(), 'foundry.config.json');
      const raw = await fs.readFile(cfgPath, 'utf8');
      const { ProjectConfigSchema } = await import('@conkernftz/core/dist/project-config.js');
      const cfg = ProjectConfigSchema.parse(JSON.parse(raw));
      const outBase = path.isAbsolute(cfg.export.outDir)
        ? cfg.export.outDir
        : path.join(process.cwd(), cfg.export.outDir);
      const outDir = path.resolve(outBase);
      const imagesDir = path.join(outDir, 'images');
      const jsonDir = path.join(outDir, 'json');

      const { createStorageProvider } = await import('@conkernftz/storage');
      const provider = await createStorageProvider(cfg.storage);

      const mode: 'file' | 'dir' = opts.mode === 'dir' ? 'dir' : 'file';
      const concurrency = Math.max(1, Number(opts.concurrency) || 4);
      const retries = Math.max(0, Number(opts.retries) || 0);

      if (mode === 'dir') {
        if (!provider.uploadDir) {
          throw new Error(`Provider "${provider.id}" does not support directory uploads. Use --mode file.`);
        }
        const imagesBase = await provider.uploadDir(imagesDir);
        const jsonFiles = (await fs.readdir(jsonDir)).filter((f) => f.endsWith('.json'));
        for (const jf of jsonFiles) {
          const p = path.join(jsonDir, jf);
          const j = JSON.parse(await fs.readFile(p, 'utf8'));
          const imgName = String(j.image).replace('./images/', '');
          j.image = `${imagesBase.uri}${imgName}`;
          j.properties = j.properties || {};
          j.properties.files = [{ uri: j.image, type: imgName.endsWith('.webp') ? 'image/webp' : 'image/png' }];
          await fs.writeFile(p, JSON.stringify(j, null, 2));
        }
        const metadataBase = await provider.uploadDir(jsonDir);
        const manifest = {
          provider: provider.id,
          mode,
          imagesBaseUri: imagesBase.uri,
          baseUri: metadataBase.uri,
        };
        await fs.writeFile(path.join(outDir, '.upload-manifest.json'), JSON.stringify(manifest, null, 2));
        console.log(
          `Uploaded images and metadata as directories (${provider.id}).\n  imagesBaseUri: ${imagesBase.uri}\n  baseUri: ${metadataBase.uri}`,
        );
        return;
      }

      // File mode: per-file content-addressed URIs (used by the Solana mint flow).
      const imageFiles = (await fs.readdir(imagesDir)).filter((f) => /\.(png|webp|gif)$/i.test(f));
      const jsonFiles = (await fs.readdir(jsonDir)).filter((f) => f.endsWith('.json'));
      const imgManifest: Record<string, string> = {};
      const jsonManifest: Record<string, string> = {};
      const errors: Array<{ file: string; error: string }> = [];

      async function uploadWithRetry(filePath: string): Promise<{ uri: string } | null> {
        let lastErr: unknown;
        for (let attempt = 0; attempt <= retries; attempt++) {
          try {
            return await provider.uploadFile(filePath);
          } catch (e) {
            lastErr = e;
            if (attempt < retries) await delay(250 * (attempt + 1));
          }
        }
        errors.push({ file: filePath, error: String((lastErr as Error)?.message ?? lastErr) });
        return null;
      }

      await runPool(imageFiles, concurrency, async (f) => {
        const res = await uploadWithRetry(path.join(imagesDir, f));
        if (res) imgManifest[f] = res.uri;
      });

      // Rewrite each JSON's image field to the uploaded image URI.
      for (const jf of jsonFiles) {
        const p = path.join(jsonDir, jf);
        const j = JSON.parse(await fs.readFile(p, 'utf8'));
        const imgName = String(j.image).replace('./images/', '');
        const newUri = imgManifest[imgName];
        if (newUri) {
          j.image = newUri;
          j.properties = j.properties || {};
          j.properties.files = [{ uri: newUri, type: imgName.endsWith('.webp') ? 'image/webp' : 'image/png' }];
          await fs.writeFile(p, JSON.stringify(j, null, 2));
        }
      }

      await runPool(jsonFiles, concurrency, async (f) => {
        const res = await uploadWithRetry(path.join(jsonDir, f));
        if (res) jsonManifest[f] = res.uri;
      });

      const manifest = { provider: provider.id, mode, images: imgManifest, metadata: jsonManifest };
      await fs.writeFile(path.join(outDir, '.upload-manifest.json'), JSON.stringify(manifest, null, 2));

      if (errors.length > 0) {
        console.error(`Upload completed with ${errors.length} error(s):`);
        for (const e of errors) console.error(`  ${path.basename(e.file)}: ${e.error}`);
        process.exitCode = 1;
      } else {
        console.log(`Upload complete (${provider.id}). Rewrote ${jsonFiles.length} JSON files; manifest saved.`);
      }
    });
  return cmd;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runPool<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  let idx = 0;
  const runners = Array.from({ length: Math.min(concurrency, items.length || 1) }, async () => {
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
