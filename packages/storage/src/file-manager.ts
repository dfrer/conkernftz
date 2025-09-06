import fs from 'node:fs/promises';
import fssync from 'node:fs';
import path from 'node:path';

/** Simple file manager used by the UI and other packages.
 *  Provides basic save/list/delete functionality rooted at a base directory.
 */
export class FileManager {
  constructor(private root: string) {}

  private resolve(rel: string): string {
    return path.join(this.root, rel);
  }

  async saveBase64(base64: string, relPath: string): Promise<void> {
    const dest = this.resolve(relPath);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    const buf = Buffer.from(base64, 'base64');
    await fs.writeFile(dest, buf);
  }

  async listFiles(relDir: string): Promise<string[]> {
    const dir = this.resolve(relDir);
    const exists = fssync.existsSync(dir);
    if (!exists) return [];
    const entries = await fs.readdir(dir);
    return entries;
  }

  async deleteFile(relPath: string): Promise<void> {
    const p = this.resolve(relPath);
    try {
      await fs.unlink(p);
    } catch {
      /* ignore */
    }
  }

  async ensureDirs(relPaths: string[]): Promise<void> {
    for (const rel of relPaths) {
      if (!rel) continue;
      const dir = this.resolve(rel);
      await fs.mkdir(dir, { recursive: true });
    }
  }

  async listDir(relDir: string): Promise<{ name: string; isDir: boolean }[]> {
    const dir = this.resolve(relDir || '.');
    const exists = fssync.existsSync(dir);
    if (!exists) return [];
    const dirents = await fs.readdir(dir, { withFileTypes: true });
    return dirents.map((d) => ({ name: d.name, isDir: d.isDirectory() }));
  }

  async readText(relPath: string): Promise<string> {
    const p = this.resolve(relPath);
    return await fs.readFile(p, 'utf8');
  }

  async writeText(relPath: string, content: string): Promise<void> {
    const p = this.resolve(relPath);
    await fs.mkdir(path.dirname(p), { recursive: true });
    await fs.writeFile(p, content, 'utf8');
  }

  async deletePath(relPath: string): Promise<void> {
    const p = this.resolve(relPath);
    if (!fssync.existsSync(p)) return;
    await fs.rm(p, { recursive: true, force: true });
  }

  async move(fromRel: string, toRel: string): Promise<void> {
    const src = this.resolve(fromRel);
    const dst = this.resolve(toRel);
    await fs.mkdir(path.dirname(dst), { recursive: true });
    await fs.rename(src, dst);
  }
}
