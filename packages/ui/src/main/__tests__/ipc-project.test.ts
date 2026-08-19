import { beforeEach, describe, it, expect, vi } from 'vitest';
import path from 'node:path';

const { handlers, ipcMain, dialog, shell } = vi.hoisted(() => {
  const handlers: Record<string, any> = {};
  const ipcMain = { handle: vi.fn((channel: string, handler: any) => { handlers[channel] = handler; }) };
  const dialog = { showOpenDialog: vi.fn() };
  const shell = { openPath: vi.fn(), openExternal: vi.fn() };
  return { handlers, ipcMain, dialog, shell };
});

const importProjectFolder = vi.hoisted(() => vi.fn());
const fsPromises = vi.hoisted(() => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  mkdir: vi.fn(),
  readdir: vi.fn().mockResolvedValue([]),
  rename: vi.fn(),
  lstat: vi.fn().mockResolvedValue({ isFile: () => true }),
  realpath: vi.fn(async (p: string) => p),
  link: vi.fn(),
  unlink: vi.fn(),
}));

vi.mock('electron', () => ({ ipcMain, dialog, shell }));
vi.mock('node:fs', () => ({ default: { existsSync: vi.fn().mockReturnValue(true) } }));
vi.mock('node:fs/promises', () => ({ default: fsPromises }));
vi.mock('@conkernftz/storage', () => ({ FileManager: vi.fn().mockImplementation(() => ({})) }));
vi.mock('../project-import.js', () => ({ importProjectFolder }));

import {
  getProjectDir,
  initProjectIpc,
  setProjectDir,
} from '../ipc-project.js';
import {
  createTrustedIpcHandle,
  hardenPrimaryWindowNavigation,
  isSafeExternalUrl,
  isTrustedIpcSender,
} from '../ipc-security.js';

const TRUSTED_RENDERER_URL = 'file:///opt/conkernftz/dist/renderer-next/index.html';

function trustedEvent(url = TRUSTED_RENDERER_URL) {
  const mainFrame = { url };
  return { senderFrame: mainFrame, sender: { mainFrame } };
}

describe('ipc-project', () => {
  beforeEach(() => {
    for (const channel of Object.keys(handlers)) delete handlers[channel];
    vi.clearAllMocks();
    shell.openExternal.mockResolvedValue(undefined);
    importProjectFolder.mockReset();
    fsPromises.realpath.mockImplementation(async (p: string) => p);
    setProjectDir(null);
  });

  it('sets project directory', async () => {
    initProjectIpc(createTrustedIpcHandle(TRUSTED_RENDERER_URL));
    const res = await handlers['foundry:setProjectDir'](trustedEvent(), '/tmp/project');
    expect(res).toEqual({ ok: true, projectDir: '/tmp/project' });
    expect(getProjectDir()).toBe('/tmp/project');
  });

  it('renames one file to the exact destination without using batch suffix behavior', async () => {
    initProjectIpc(createTrustedIpcHandle(TRUSTED_RENDERER_URL));
    setProjectDir('/tmp/project');
    const src = path.resolve('/tmp/project/Layers/Gold#1.png');
    const dst = path.resolve('/tmp/project/Layers/Gold#3.png');

    await expect(
      handlers['foundry:renameFileExact'](trustedEvent(), 'Layers/Gold#1.png', 'Layers/Gold#3.png'),
    ).resolves.toEqual({ ok: true, renamed: 1 });

    expect(fsPromises.link).toHaveBeenCalledWith(src, dst);
    expect(fsPromises.unlink).toHaveBeenCalledOnce();
    expect(fsPromises.unlink).toHaveBeenCalledWith(src);
  });

  it('does not mutate the source when the exact destination already exists', async () => {
    initProjectIpc(createTrustedIpcHandle(TRUSTED_RENDERER_URL));
    setProjectDir('/tmp/project');
    fsPromises.link.mockRejectedValueOnce(Object.assign(new Error('exists'), { code: 'EEXIST' }));

    await expect(
      handlers['foundry:renameFileExact'](trustedEvent(), 'Layers/Gold#1.png', 'Layers/Gold#3.png'),
    ).resolves.toEqual({ ok: false, error: 'Destination already exists' });

    expect(fsPromises.unlink).not.toHaveBeenCalled();
  });

  it('rejects exact-rename traversal before touching the filesystem', async () => {
    initProjectIpc(createTrustedIpcHandle(TRUSTED_RENDERER_URL));
    setProjectDir('/tmp/project');

    await expect(
      handlers['foundry:renameFileExact'](trustedEvent(), '../outside.png', 'Layers/Gold#3.png'),
    ).resolves.toEqual({ ok: false, error: 'Rename paths must be inside the project directory' });

    expect(fsPromises.lstat).not.toHaveBeenCalled();
    expect(fsPromises.link).not.toHaveBeenCalled();
    expect(fsPromises.unlink).not.toHaveBeenCalled();
  });

  it('rejects an exact-rename source redirected outside by a project symlink', async () => {
    initProjectIpc(createTrustedIpcHandle(TRUSTED_RENDERER_URL));
    setProjectDir('/tmp/project');
    const src = path.resolve('/tmp/project/Layers/Gold#1.png');
    fsPromises.realpath.mockImplementation(async (p: string) =>
      p === src ? path.resolve('/tmp/outside/Gold#1.png') : p,
    );

    await expect(
      handlers['foundry:renameFileExact'](trustedEvent(), 'Layers/Gold#1.png', 'Layers/Gold#3.png'),
    ).resolves.toEqual({ ok: false, error: 'Rename paths must be inside the project directory' });

    expect(fsPromises.link).not.toHaveBeenCalled();
    expect(fsPromises.unlink).not.toHaveBeenCalled();
  });

  it('returns a no-mutation error when the exact-rename source is missing', async () => {
    initProjectIpc(createTrustedIpcHandle(TRUSTED_RENDERER_URL));
    setProjectDir('/tmp/project');
    fsPromises.lstat.mockRejectedValueOnce(Object.assign(new Error('missing'), { code: 'ENOENT' }));

    await expect(
      handlers['foundry:renameFileExact'](trustedEvent(), 'Layers/missing.png', 'Layers/Gold#3.png'),
    ).resolves.toEqual({ ok: false, error: 'Source file or destination directory does not exist' });

    expect(fsPromises.link).not.toHaveBeenCalled();
    expect(fsPromises.unlink).not.toHaveBeenCalled();
  });

  it('rolls back the destination link when removing the source fails', async () => {
    initProjectIpc(createTrustedIpcHandle(TRUSTED_RENDERER_URL));
    setProjectDir('/tmp/project');
    const src = path.resolve('/tmp/project/Layers/Gold#1.png');
    const dst = path.resolve('/tmp/project/Layers/Gold#3.png');
    fsPromises.unlink
      .mockRejectedValueOnce(new Error('source locked'))
      .mockResolvedValueOnce(undefined);

    await expect(
      handlers['foundry:renameFileExact'](trustedEvent(), 'Layers/Gold#1.png', 'Layers/Gold#3.png'),
    ).resolves.toEqual({
      ok: false,
      error: 'Source could not be removed; destination was rolled back: source locked',
    });

    expect(fsPromises.unlink).toHaveBeenNthCalledWith(1, src);
    expect(fsPromises.unlink).toHaveBeenNthCalledWith(2, dst);
  });

  it('reports a rollback failure that leaves the duplicate destination visible', async () => {
    initProjectIpc(createTrustedIpcHandle(TRUSTED_RENDERER_URL));
    setProjectDir('/tmp/project');
    fsPromises.unlink
      .mockRejectedValueOnce(new Error('source locked'))
      .mockRejectedValueOnce(new Error('destination locked'));

    await expect(
      handlers['foundry:renameFileExact'](trustedEvent(), 'Layers/Gold#1.png', 'Layers/Gold#3.png'),
    ).resolves.toEqual({
      ok: false,
      error: 'Source could not be removed, and destination rollback failed: destination locked',
    });

    expect(fsPromises.unlink).toHaveBeenCalledTimes(2);
  });

  it('keeps the active project on import cancellation and adopts it after a successful import', async () => {
    initProjectIpc(createTrustedIpcHandle(TRUSTED_RENDERER_URL));
    setProjectDir('/tmp/current');
    importProjectFolder.mockResolvedValueOnce({ ok: false, cancelled: true });

    await expect(handlers['foundry:importProjectFolder'](trustedEvent())).resolves.toEqual({ ok: false, cancelled: true });
    expect(getProjectDir()).toBe('/tmp/current');

    importProjectFolder.mockResolvedValueOnce({
      ok: false,
      error: 'Existing foundry.config.json is not a valid ConkerNFTZ project',
    });
    await expect(handlers['foundry:importProjectFolder'](trustedEvent())).resolves.toMatchObject({ ok: false });
    expect(getProjectDir()).toBe('/tmp/current');

    const importedConfig = { name: 'Imported', layers: [] };
    importProjectFolder.mockResolvedValueOnce({
      ok: true,
      projectDir: '/tmp/imported',
      config: importedConfig,
      created: true,
      layerCount: 2,
    });
    await expect(handlers['foundry:importProjectFolder'](trustedEvent())).resolves.toMatchObject({
      ok: true,
      projectDir: '/tmp/imported',
      config: importedConfig,
    });
    expect(getProjectDir()).toBe('/tmp/imported');
  });

  it('refuses an incomplete success payload without changing the active project', async () => {
    initProjectIpc(createTrustedIpcHandle(TRUSTED_RENDERER_URL));
    setProjectDir('/tmp/current');
    importProjectFolder.mockResolvedValueOnce({ ok: true, projectDir: '/tmp/imported', created: true });

    await expect(handlers['foundry:importProjectFolder'](trustedEvent())).resolves.toEqual({
      ok: false,
      error: 'Project import did not return a complete validated project',
    });
    expect(getProjectDir()).toBe('/tmp/current');
  });

  it('accepts only the trusted app document main frame for IPC', () => {
    const mainFrame = { url: TRUSTED_RENDERER_URL };
    const subframe = { url: TRUSTED_RENDERER_URL };

    expect(isTrustedIpcSender(trustedEvent(`${TRUSTED_RENDERER_URL}#help`), TRUSTED_RENDERER_URL)).toBe(true);
    expect(isTrustedIpcSender(trustedEvent(`${TRUSTED_RENDERER_URL}?payload=1`), TRUSTED_RENDERER_URL)).toBe(false);
    expect(isTrustedIpcSender({ senderFrame: subframe, sender: { mainFrame } }, TRUSTED_RENDERER_URL)).toBe(false);
    expect(isTrustedIpcSender(trustedEvent('file:///tmp/attacker.html'), TRUSTED_RENDERER_URL)).toBe(false);
    expect(isTrustedIpcSender(trustedEvent('https://attacker.example/'), TRUSTED_RENDERER_URL)).toBe(false);
    expect(isTrustedIpcSender({}, TRUSTED_RENDERER_URL)).toBe(false);
  });

  it('rejects an unexpected sender before a project handler performs work', async () => {
    initProjectIpc(createTrustedIpcHandle(TRUSTED_RENDERER_URL));

    const res = await handlers['foundry:setProjectDir'](
      trustedEvent('file:///tmp/attacker.html'),
      '/tmp/project',
    );

    expect(res).toEqual({ ok: false, error: 'Unauthorized IPC sender' });
    expect(getProjectDir()).toBeNull();
  });

  it('allows bounded credential-free HTTP(S) external URLs', () => {
    expect(isSafeExternalUrl('https://example.com/help')).toBe(true);
    expect(isSafeExternalUrl('http://127.0.0.1:4321/')).toBe(true);
    expect(isSafeExternalUrl('https://user:secret@example.com/')).toBe(false);
    expect(isSafeExternalUrl(`https://example.com/${'x'.repeat(2050)}`)).toBe(false);
  });

  it.each([
    'file:///tmp/payload',
    'javascript:alert(1)',
    'data:text/html,payload',
    'mailto:attacker@example.com',
    'custom-handler://payload',
    'not a url',
    ' https://example.com/',
  ])('does not pass an unsafe external URL to the operating system: %s', async (url) => {
    initProjectIpc(createTrustedIpcHandle(TRUSTED_RENDERER_URL));

    const res = await handlers['foundry:openExternal'](trustedEvent(), url);

    expect(res).toEqual({ ok: false, error: 'Only HTTP(S) URLs can be opened' });
    expect(shell.openExternal).not.toHaveBeenCalled();
  });

  it('preserves Help and deployment web-link launches', async () => {
    initProjectIpc(createTrustedIpcHandle(TRUSTED_RENDERER_URL));

    await expect(
      handlers['foundry:openExternal'](trustedEvent(), 'https://example.com/help'),
    ).resolves.toEqual({ ok: true });
    expect(shell.openExternal).toHaveBeenCalledWith('https://example.com/help');
  });

  it('denies renderer-created windows and top-level navigation', () => {
    const setWindowOpenHandler = vi.fn();
    const on = vi.fn();
    hardenPrimaryWindowNavigation({ setWindowOpenHandler, on } as never);

    const openHandler = setWindowOpenHandler.mock.calls[0]![0];
    expect(openHandler({ url: 'https://attacker.example/' })).toEqual({ action: 'deny' });

    const navigateHandler = on.mock.calls.find(([event]) => event === 'will-navigate')![1];
    const navigationEvent = { preventDefault: vi.fn() };
    navigateHandler(navigationEvent, 'https://attacker.example/');
    expect(navigationEvent.preventDefault).toHaveBeenCalledOnce();
  });
});
