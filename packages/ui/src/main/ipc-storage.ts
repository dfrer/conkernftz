import { FileManager } from '@conkernftz/storage/file-manager';
import { getProjectDir, getFileManager, setFileManager } from './ipc-project.js';
import type { TrustedIpcHandle } from './ipc-security.js';

export function initStorageIpc(handle: TrustedIpcHandle): void {
  handle('foundry:fsSave', async (_evt, base64: string, relPath: string) => {
    try {
      const dir = getProjectDir();
      if (!dir) return { ok: false, error: 'No project selected' };
      let fm = getFileManager();
      if (!fm) {
        fm = new FileManager(dir);
        setFileManager(fm);
      }
      await fm.saveBase64(base64, relPath);
      return { ok: true };
    } catch (e: any) {
      return { ok: false, error: String(e?.message ?? e) };
    }
  });

  handle('foundry:fsList', async (_evt, relDir: string) => {
    try {
      const dir = getProjectDir();
      if (!dir) return { ok: false, error: 'No project selected' };
      let fm = getFileManager();
      if (!fm) {
        fm = new FileManager(dir);
        setFileManager(fm);
      }
      const files = await fm.listFiles(relDir);
      return { ok: true, files };
    } catch (e: any) {
      return { ok: false, error: String(e?.message ?? e) };
    }
  });

  handle('foundry:fsDelete', async (_evt, relPath: string) => {
    try {
      const dir = getProjectDir();
      if (!dir) return { ok: false, error: 'No project selected' };
      let fm = getFileManager();
      if (!fm) {
        fm = new FileManager(dir);
        setFileManager(fm);
      }
      await fm.deleteFile(relPath);
      return { ok: true };
    } catch (e: any) {
      return { ok: false, error: String(e?.message ?? e) };
    }
  });
}
