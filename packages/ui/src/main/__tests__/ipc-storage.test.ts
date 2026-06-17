
import { describe, it, expect, vi } from 'vitest';

const { handlers, ipcMain, FileManager, listFiles } = vi.hoisted(() => {
  const handlers: Record<string, any> = {};
  const ipcMain = { handle: vi.fn((channel: string, handler: any) => { handlers[channel] = handler; }) };
  const listFiles = vi.fn().mockResolvedValue(['file1']);
  const saveBase64 = vi.fn().mockResolvedValue(undefined);
  const deleteFile = vi.fn().mockResolvedValue(undefined);
  const FileManager = vi.fn().mockImplementation(() => ({ listFiles, saveBase64, deleteFile }));
  return { handlers, ipcMain, FileManager, listFiles };
});

vi.mock('electron', () => ({ ipcMain }));
// ipc-storage.ts and ipc-project.ts both import FileManager from the subpath
// '@conkernftz/storage/file-manager', so the mock must target that specifier.
vi.mock('@conkernftz/storage/file-manager', () => ({ FileManager }));

import { initStorageIpc } from '../ipc-storage.js';
import { setProjectDir } from '../ipc-project.js';

describe('ipc-storage', () => {
  it('lists files via FileManager', async () => {
    setProjectDir('/tmp/project');
    initStorageIpc();
    const res = await handlers['foundry:fsList']({}, 'dir');
    expect(res).toEqual({ ok: true, files: ['file1'] });
    expect(listFiles).toHaveBeenCalledWith('dir');
  });
});

