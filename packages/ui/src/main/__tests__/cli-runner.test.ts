import { describe, it, expect, vi } from 'vitest';
import { EventEmitter } from 'node:events';

const handlers: Record<string, any> = {};
const ipcMain = { handle: vi.fn((channel: string, handler: any) => { handlers[channel] = handler; }) };
const dialog = { showOpenDialog: vi.fn() };

vi.mock('electron', () => ({ ipcMain, dialog }));
vi.mock('node:fs', () => ({ existsSync: vi.fn().mockReturnValue(true) }));
vi.mock('node:child_process', () => ({
  fork: vi.fn((_p: string, _args: string[], _opts: any) => {
    const child = new EventEmitter() as any;
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    setTimeout(() => {
      child.stdout.emit('data', 'output');
      child.emit('exit', 0);
    }, 0);
    return child;
  }),
  execFile: vi.fn((_: any, __: any, ___: any, cb: any) => cb(null, { stdout: '', stderr: '' })),
}));

import { initCliRunner } from '../cli-runner';
import { setProjectDir } from '../ipc-project';

describe('cli-runner', () => {
  it('runs CLI and returns stdout', async () => {
    setProjectDir('/tmp/project');
    initCliRunner();
    const res = await handlers['foundry:run']({}, ['--help']);
    expect(res).toEqual({ ok: true, stdout: 'output' });
  });
});

