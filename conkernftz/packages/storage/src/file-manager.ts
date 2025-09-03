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
}
