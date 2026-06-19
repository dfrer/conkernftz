import * as electron from 'electron';
import path from 'node:path';
import fs from 'node:fs/promises';
import fssync from 'node:fs';

// App-level (project-independent) pack & card-back library. Built-in packs ship bundled in
// dist/assets/packs; user-added packs live in the Electron userData dir so they persist across
// every project and app updates. Projects reference a pack by id (resolved here / at export).

export type PackKind = 'pack' | 'back';
interface UserPack {
  id: string;
  name: string;
  kind: PackKind;
  file: string;
}

const BUILTINS: { id: string; name: string; kind: PackKind; file: string }[] = [
  { id: 'conkerco-default', name: 'CONKERCO Default', kind: 'pack', file: 'conkerco-default.png' },
];

const MIME: Record<string, string> = {
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
};

// dist/main/ipc-packs.js → dist/assets/packs
const builtinsDir = (): string => path.resolve(__dirname, '..', 'assets', 'packs');
const userDir = (): string => path.join(electron.app.getPath('userData'), 'packs');
const manifestPath = (): string => path.join(userDir(), 'library.json');

async function readUserManifest(): Promise<UserPack[]> {
  try {
    const raw = await fs.readFile(manifestPath(), 'utf8');
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? (arr as UserPack[]) : [];
  } catch {
    return [];
  }
}
async function writeUserManifest(list: UserPack[]): Promise<void> {
  await fs.mkdir(userDir(), { recursive: true });
  await fs.writeFile(manifestPath(), JSON.stringify(list, null, 2), 'utf8');
}

export function initPacksIpc(): void {
  electron.ipcMain.handle('foundry:packsList', async () => {
    try {
      const user = await readUserManifest();
      return {
        ok: true,
        packs: [
          ...BUILTINS.map((b) => ({ id: b.id, name: b.name, kind: b.kind, builtin: true })),
          ...user.map((u) => ({ id: u.id, name: u.name, kind: u.kind, builtin: false })),
        ],
      };
    } catch (e) {
      return { ok: false, error: String((e as Error)?.message ?? e) };
    }
  });

  electron.ipcMain.handle('foundry:packsRead', async (_evt, id: string) => {
    try {
      const b = BUILTINS.find((x) => x.id === id);
      let file: string | null = b ? path.join(builtinsDir(), b.file) : null;
      if (!file) {
        const u = (await readUserManifest()).find((x) => x.id === id);
        if (u) file = path.join(userDir(), u.file);
      }
      if (!file || !fssync.existsSync(file)) return { ok: false, error: 'Pack not found' };
      const buf = await fs.readFile(file);
      return { ok: true, base64: buf.toString('base64'), mime: MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' };
    } catch (e) {
      return { ok: false, error: String((e as Error)?.message ?? e) };
    }
  });

  // Open a file picker and import the chosen image into the app library (userData).
  electron.ipcMain.handle('foundry:packsImport', async (_evt, opts: { name?: string; kind?: PackKind }) => {
    try {
      const res = await electron.dialog.showOpenDialog({
        title: 'Add pack / card-back image to the library',
        properties: ['openFile'],
        filters: [{ name: 'Images', extensions: ['png', 'webp', 'gif', 'jpg', 'jpeg'] }],
      });
      if (res.canceled || res.filePaths.length === 0) return { ok: false, error: 'Canceled' };
      const src = res.filePaths[0] as string;
      const ext = path.extname(src).toLowerCase();
      const kind: PackKind = opts?.kind === 'back' ? 'back' : 'pack';
      const id = `${kind}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
      const fileName = `${id}${ext}`;
      await fs.mkdir(userDir(), { recursive: true });
      await fs.copyFile(src, path.join(userDir(), fileName));
      const name = opts?.name?.trim() || path.basename(src, ext);
      const list = await readUserManifest();
      list.push({ id, name, kind, file: fileName });
      await writeUserManifest(list);
      return { ok: true, pack: { id, name, kind, builtin: false } };
    } catch (e) {
      return { ok: false, error: String((e as Error)?.message ?? e) };
    }
  });

  electron.ipcMain.handle('foundry:packsDelete', async (_evt, id: string) => {
    try {
      if (BUILTINS.some((b) => b.id === id)) return { ok: false, error: 'Cannot delete a built-in pack' };
      const list = await readUserManifest();
      const entry = list.find((x) => x.id === id);
      if (!entry) return { ok: false, error: 'Pack not found' };
      await fs.rm(path.join(userDir(), entry.file), { force: true });
      await writeUserManifest(list.filter((x) => x.id !== id));
      return { ok: true };
    } catch (e) {
      return { ok: false, error: String((e as Error)?.message ?? e) };
    }
  });
}
