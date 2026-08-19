import { beforeEach, describe, it, expect, vi } from 'vitest';

const { handlers, ipcMain, dialog, shell } = vi.hoisted(() => {
  const handlers: Record<string, any> = {};
  const ipcMain = { handle: vi.fn((channel: string, handler: any) => { handlers[channel] = handler; }) };
  const dialog = { showOpenDialog: vi.fn() };
  const shell = { openPath: vi.fn(), openExternal: vi.fn() };
  return { handlers, ipcMain, dialog, shell };
});

const importProjectFolder = vi.hoisted(() => vi.fn());

vi.mock('electron', () => ({ ipcMain, dialog, shell }));
vi.mock('node:fs', () => ({ default: { existsSync: vi.fn().mockReturnValue(true) } }));
vi.mock('node:fs/promises', () => ({
  default: {
    readFile: vi.fn(),
    writeFile: vi.fn(),
    mkdir: vi.fn(),
    readdir: vi.fn().mockResolvedValue([]),
    rename: vi.fn(),
  },
}));
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
    setProjectDir(null);
  });

  it('sets project directory', async () => {
    initProjectIpc(createTrustedIpcHandle(TRUSTED_RENDERER_URL));
    const res = await handlers['foundry:setProjectDir'](trustedEvent(), '/tmp/project');
    expect(res).toEqual({ ok: true, projectDir: '/tmp/project' });
    expect(getProjectDir()).toBe('/tmp/project');
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
