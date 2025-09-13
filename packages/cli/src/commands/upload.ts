import { Command } from 'commander';
import fs from 'node:fs/promises';
import path from 'node:path';
// Lazy import to avoid loading heavy deps on startup

export function uploadCmd(): Command {
  const cmd = new Command('upload');
  cmd
    .description('Upload assets to storage (Arweave/IPFS) and rewrite local JSON URIs')
    .option('--provider <name>', 'arweave or ipfs', 'arweave')
    .option('--concurrency <n>', 'parallel uploads', '4')
    .action(async (opts) => {
      const cfgPath = path.join(process.cwd(), 'foundry.config.json');
      const raw = await fs.readFile(cfgPath, 'utf8');
      const { ProjectConfigSchema } = await import('@foundry/core/dist/project-config.js');
      const cfg = ProjectConfigSchema.parse(JSON.parse(raw));
      const outDir = path.join(process.cwd(), cfg.export.outDir);
      const imagesDir = path.join(outDir, 'images');
      const jsonDir = path.join(outDir, 'json');

      const imageFiles = (await fs.readdir(imagesDir)).filter((f) => /\.(png|webp|gif)$/i.test(f));
      const jsonFiles = (await fs.readdir(jsonDir)).filter((f) => f.endsWith('.json'));

      const concurrency = Math.max(1, Number(opts.concurrency));
      const imgManifest: Record<string, string> = {};
      const jsonManifest: Record<string, string> = {};

      async function uploadOne(filePath: string): Promise<{ uri: string; type: string }> {
        if (opts.provider === 'arweave') {
          if (!cfg.storage.arweave) throw new Error('Arweave config missing');
          const { uploadFileViaBundlr } = await import('@foundry/storage');
          return uploadFileViaBundlr(filePath, cfg.storage.arweave);
        }
        if (opts.provider === 'ipfs') {
          const { uploadViaNftStorage, uploadViaPinata } = await import('@foundry/storage');
          const ipfs = cfg.storage.ipfs;
          if (!ipfs) throw new Error('IPFS config missing');
          if (ipfs.nftStorageKey) return uploadViaNftStorage(filePath, ipfs.nftStorageKey);
          if (ipfs.pinataKey && ipfs.pinataSecret) return uploadViaPinata(filePath, ipfs.pinataKey, ipfs.pinataSecret);
          throw new Error('No IPFS credentials provided');
        }
        throw new Error(`Unknown provider: ${opts.provider}`);
      }

      async function uploadWithRetry(filePath: string, attempts = 3): Promise<{ uri: string; type: string }> {
        let lastErr: unknown = null;
        for (let i = 0; i < attempts; i++) {
          try {
            return await uploadOne(filePath);
          } catch (e) {
            lastErr = e;
            const backoff = Math.min(1000 * Math.pow(2, i), 8000);
            await new Promise((r) => setTimeout(r, backoff));
          }
        }
        throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
      }

      // Upload images with bounded concurrency
      {
        let idx = 0;
        const workers = Array.from({ length: Math.min(concurrency, imageFiles.length) }, async () => {
          while (true) {
            const current = idx++;
            if (current >= imageFiles.length) break;
            const f = imageFiles[current];
            if (!f) continue;
            const p = path.join(imagesDir, f);
            const { uri } = await uploadWithRetry(p);
            imgManifest[f] = uri;
          }
        });
        await Promise.all(workers);
      }

      // Rewrite JSON files to point to uploaded image URIs
      for (const jf of jsonFiles) {
        const p = path.join(jsonDir, jf);
        const j = JSON.parse(await fs.readFile(p, 'utf8'));
        const imgName = String(j.image).replace('./images/', '');
        const newUri = imgManifest[imgName];
        if (newUri) {
          j.image = newUri;
          j.properties = j.properties || {};
          // Infer MIME from configured output format first, falling back to URI suffix
          const ext = (cfg.export?.imageFormat === 'webp') ? 'image/webp' : 'image/png';
          const inferred = /\.webp(\b|$)/i.test(newUri) ? 'image/webp' : (/\.png(\b|$)/i.test(newUri) ? 'image/png' : ext);
          j.properties.files = [{ uri: newUri, type: inferred }];
          await fs.writeFile(p, JSON.stringify(j, null, 2));
        }
      }

      // Optionally upload JSON files too and produce jsonManifest
      {
        let idx = 0;
        const workers = Array.from({ length: Math.min(concurrency, jsonFiles.length) }, async () => {
          while (true) {
            const current = idx++;
            if (current >= jsonFiles.length) break;
            const f = jsonFiles[current];
            if (!f) continue;
            const p = path.join(jsonDir, f);
            const { uri } = await uploadWithRetry(p);
            jsonManifest[f] = uri;
          }
        });
        await Promise.all(workers);
      }

      const manifest = { images: imgManifest, metadata: jsonManifest, provider: opts.provider };
      await fs.writeFile(path.join(outDir, '.upload-manifest.json'), JSON.stringify(manifest, null, 2));
      const failedImages = (await fs.readdir(imagesDir)).filter((f) => !(f in imgManifest));
      const failedJson = jsonFiles.filter((f) => !(f in jsonManifest));
      console.log('Upload complete. Local JSON rewritten and manifest saved.');
      if (failedImages.length || failedJson.length) {
        console.warn(`Some uploads failed. Images failed: ${failedImages.length}, Metadata failed: ${failedJson.length}`);
      }
    });
  return cmd;
}


