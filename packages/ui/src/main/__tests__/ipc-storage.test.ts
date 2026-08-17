
import { describe, it, expect, vi } from 'vitest';

const { handlers, ipcMain, FileManager, listFiles } = vi.hoisted(() => {
  const handlers: Record<string, any> = {};
  const ipcMain = { handle: vi.fn((channel: string, handler: any) => { handlers[channel] = handler; }) };
  const listFiles = vi.fn().mockResolvedValue(['file1']);
  const saveBase64 = vi.fn().mockResolvedValue(undefined);
  const deleteFile = vi.fn().mockResolvedValue(undefined);
  const FileManager = vi.fn().mockImplementation(function FileManagerMock() {
    return { listFiles, saveBase64, deleteFile };
  });
  return { handlers, ipcMain, FileManager, listFiles };
});

vi.mock('electron', () => ({ ipcMain }));
// ipc-storage.ts and ipc-project.ts both import FileManager from the subpath
// '@conkernftz/storage/file-manager', so the mock must target that specifier.
vi.mock('@conkernftz/storage/file-manager', () => ({ FileManager }));

import { initStorageIpc } from '../ipc-storage.js';
import { setProjectDir } from '../ipc-project.js';
import { createTrustedIpcHandle } from '../ipc-security.js';

const TRUSTED_RENDERER_URL = 'file:///opt/conkernftz/dist/renderer-next/index.html';

function trustedEvent() {
  const mainFrame = { url: TRUSTED_RENDERER_URL };
  return { senderFrame: mainFrame, sender: { mainFrame } };
}

describe('ipc-storage', () => {
  it('lists files via FileManager', async () => {
    setProjectDir('/tmp/project');
    initStorageIpc(createTrustedIpcHandle(TRUSTED_RENDERER_URL));
    const res = await handlers['foundry:fsList'](trustedEvent(), 'dir');
    expect(res).toEqual({ ok: true, files: ['file1'] });
    expect(listFiles).toHaveBeenCalledWith('dir');
  });
});
