import { describe, it, expect, vi } from 'vitest';

const handlers: Record<string, any> = {};
const ipcMain = { handle: vi.fn((channel: string, handler: any) => { handlers[channel] = handler; }) };
const dialog = { showOpenDialog: vi.fn() };
const shell = { openPath: vi.fn(), openExternal: vi.fn() };

vi.mock('electron', () => ({ ipcMain, dialog, shell }));
vi.mock('node:fs', () => ({ existsSync: vi.fn().mockReturnValue(true) }));
vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  mkdir: vi.fn(),
  readdir: vi.fn().mockResolvedValue([]),
  rename: vi.fn(),
}));
vi.mock('@foundry/storage', () => ({ FileManager: vi.fn().mockImplementation(() => ({})) }));

import { initProjectIpc, getProjectDir } from '../ipc-project';

describe('ipc-project', () => {
  it('sets project directory', async () => {
    initProjectIpc();
    const res = await handlers['foundry:setProjectDir']({}, '/tmp/project');
    expect(res).toEqual({ ok: true, projectDir: '/tmp/project' });
    expect(getProjectDir()).toBe('/tmp/project');
  });
});

