import { describe, it, expect, vi } from 'vitest';

const handlers: Record<string, any> = {};
const ipcMain = { handle: vi.fn((channel: string, handler: any) => { handlers[channel] = handler; }) };

vi.mock('electron', () => ({ ipcMain }));

const listFiles = vi.fn().mockResolvedValue(['file1']);
const saveBase64 = vi.fn().mockResolvedValue(undefined);
const deleteFile = vi.fn().mockResolvedValue(undefined);
const FileManager = vi.fn().mockImplementation(() => ({ listFiles, saveBase64, deleteFile }));
vi.mock('@foundry/storage', () => ({ FileManager }));

import { initStorageIpc } from '../ipc-storage';
import { setProjectDir } from '../ipc-project';

describe('ipc-storage', () => {
  it('lists files via FileManager', async () => {
    setProjectDir('/tmp/project');
    initStorageIpc();
    const res = await handlers['foundry:fsList']({}, 'dir');
    expect(res).toEqual({ ok: true, files: ['file1'] });
    expect(listFiles).toHaveBeenCalledWith('dir');
  });
});

