import { describe, it, expect, vi } from 'vitest';
import { EventEmitter } from 'node:events';

const { handlers, ipcMain, dialog } = vi.hoisted(() => {
  const handlers: Record<string, any> = {};
  const ipcMain = { handle: vi.fn((channel: string, handler: any) => { handlers[channel] = handler; }) };
  const dialog = { showOpenDialog: vi.fn() };
  return { handlers, ipcMain, dialog };
});

vi.mock('electron', () => ({ ipcMain, dialog }));
vi.mock('node:fs', () => ({ default: { existsSync: vi.fn().mockReturnValue(true) } }));
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

import { initCliRunner } from '../cli-runner.js';
import { setProjectDir } from '../ipc-project.js';

describe('cli-runner', () => {
  it('runs CLI and returns stdout', async () => {
    setProjectDir('/tmp/project');
    initCliRunner();
    const res = await handlers['foundry:run']({}, ['--help']);
    expect(res).toEqual({ ok: true, stdout: 'output' });
  });
});

